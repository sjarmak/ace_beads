import { readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { Insight } from '../mcp/types.js';

export interface KnowledgeBullet {
  id: string;
  content: string;
  helpful: number;
  harmful: number;
}

export interface CuratorDelta {
  bullet_id: string;
  section: string;
  content: string;
  confidence: number;
  source_insight_ids: string[];
}

export class Curator {
  private insightsPath: string;
  private knowledgePath: string;
  private maxDeltasPerSession: number;

  constructor(
    insightsPath: string = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
    knowledgePath: string = '/Users/sjarmak/ACE_Beads_Amp/knowledge/AGENT.md',
    maxDeltasPerSession: number = 3
  ) {
    this.insightsPath = insightsPath;
    this.knowledgePath = knowledgePath;
    this.maxDeltasPerSession = maxDeltasPerSession;
  }

  async processInsights(minConfidence: number = 0.8): Promise<CuratorDelta[]> {
    console.log(`[Curator] Processing insights with min confidence: ${minConfidence}`);
    
    const insights = await this.loadInsights();
    const highConfidenceInsights = insights.filter(
      (insight) => insight.confidence >= minConfidence && insight.onlineEligible
    );

    console.log(
      `[Curator] Found ${highConfidenceInsights.length} high-confidence insights out of ${insights.length} total`
    );

    if (highConfidenceInsights.length === 0) {
      console.log('[Curator] No insights to process');
      return [];
    }

    const deltas = this.generateDeltas(highConfidenceInsights);
    const limitedDeltas = deltas.slice(0, this.maxDeltasPerSession);

    console.log(
      `[Curator] Generated ${deltas.length} deltas, applying ${limitedDeltas.length} (max: ${this.maxDeltasPerSession})`
    );

    for (const delta of limitedDeltas) {
      await this.applyDelta(delta);
    }

    return limitedDeltas;
  }

  private async loadInsights(): Promise<Insight[]> {
    try {
      const content = await readFile(this.insightsPath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private generateDeltas(insights: Insight[]): CuratorDelta[] {
    const deltas: CuratorDelta[] = [];
    const seenPatterns = new Set<string>();

    for (const insight of insights) {
      const patternKey = this.normalizePattern(insight.signal.pattern);

      if (seenPatterns.has(patternKey)) {
        continue;
      }
      seenPatterns.add(patternKey);

      const section = this.determineSection(insight);
      const bullet = this.formatBullet(insight);

      deltas.push({
        bullet_id: this.generateBulletId(),
        section,
        content: bullet,
        confidence: insight.confidence,
        source_insight_ids: [insight.id],
      });
    }

    return deltas.sort((a, b) => b.confidence - a.confidence);
  }

  private normalizePattern(pattern: string): string {
    return pattern
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private determineSection(insight: Insight): string {
    const tags = insight.metaTags || [];

    if (tags.includes('tsc') || tags.some(tag => tag.includes('type'))) {
      return 'TypeScript Patterns';
    }
    if (tags.includes('vitest') || tags.some(tag => tag.includes('test'))) {
      return 'Build & Test Patterns';
    }
    if (tags.includes('discovery') || tags.includes('meta-pattern')) {
      return 'Architecture Patterns';
    }
    if (tags.includes('discovered-from') || tags.includes('dependency')) {
      return 'Dependency Patterns';
    }

    if (insight.source.runner) {
      return 'Build & Test Patterns';
    }

    return 'Build & Test Patterns';
  }

  private formatBullet(insight: Insight): string {
    const pattern = insight.signal.pattern;
    const recommendation = insight.recommendation;
    
    return `${pattern} - ${recommendation}`;
  }

  private generateBulletId(): string {
    return randomUUID().substring(0, 8);
  }

  private async applyDelta(delta: CuratorDelta): Promise<void> {
    const content = await readFile(this.knowledgePath, 'utf-8');
    const lines = content.split('\n');

    const sectionIndex = this.findSectionIndex(lines, delta.section);
    
    if (sectionIndex === -1) {
      console.warn(`[Curator] Section "${delta.section}" not found, skipping delta`);
      return;
    }

    const bulletLine = this.createBulletLine(delta.bullet_id, delta.content);
    
    const insertIndex = this.findInsertPosition(lines, sectionIndex);
    lines.splice(insertIndex, 0, bulletLine);

    await writeFile(this.knowledgePath, lines.join('\n'));
    console.log(`[Curator] Applied delta to section "${delta.section}": ${delta.bullet_id}`);
  }

  private findSectionIndex(lines: string[], sectionName: string): number {
    return lines.findIndex((line) => line.trim() === `### ${sectionName}`);
  }

  private findInsertPosition(lines: string[], sectionIndex: number): number {
    let insertIndex = sectionIndex + 1;

    while (insertIndex < lines.length) {
      const line = lines[insertIndex].trim();
      
      if ((line.startsWith('### ') || line.startsWith('## ')) && insertIndex > sectionIndex) {
        break;
      }
      
      if (line.startsWith('[Bullet #')) {
        insertIndex++;
        continue;
      }
      
      if (line.startsWith('<!--') || line.length === 0) {
        insertIndex++;
        continue;
      }
      
      break;
    }

    return insertIndex;
  }

  private createBulletLine(bulletId: string, content: string): string {
    return `[Bullet #${bulletId}, helpful:0, harmful:0] ${content}`;
  }

  async loadKnowledgeBullets(): Promise<KnowledgeBullet[]> {
    try {
      const content = await readFile(this.knowledgePath, 'utf-8');
      const bulletRegex = /\[Bullet #(\S+), helpful:(\d+), harmful:(\d+)\] (.+)/g;
      const bullets: KnowledgeBullet[] = [];

      let match;
      while ((match = bulletRegex.exec(content)) !== null) {
        bullets.push({
          id: match[1],
          helpful: parseInt(match[2]),
          harmful: parseInt(match[3]),
          content: match[4],
        });
      }

      return bullets;
    } catch {
      return [];
    }
  }

  async updateKnowledge(_bead: unknown): Promise<void> {
    console.log('[Curator] updateKnowledge is deprecated, use processInsights() instead');
    await this.processInsights();
  }

  private async updateBulletCounter(bulletId: string, feedback: 'helpful' | 'harmful'): Promise<void> {
    const content = await readFile(this.knowledgePath, 'utf-8');
    const lines = content.split('\n');

    const bulletRegex = new RegExp(
      `\\[Bullet #${bulletId}, helpful:(\\d+), harmful:(\\d+)\\] (.+)`
    );

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(bulletRegex);
      if (match) {
        const helpful = parseInt(match[1]);
        const harmful = parseInt(match[2]);
        const bulletContent = match[3];

        const newHelpful = feedback === 'helpful' ? helpful + 1 : helpful;
        const newHarmful = feedback === 'harmful' ? harmful + 1 : harmful;

        lines[i] = `[Bullet #${bulletId}, helpful:${newHelpful}, harmful:${newHarmful}] ${bulletContent}`;
        break;
      }
    }

    await writeFile(this.knowledgePath, lines.join('\n'));
    console.log(`[Curator] Updated bullet ${bulletId} counter: ${feedback}`);
  }
}
