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
    
    // Trigger deduplication hook after adding new bullet
    await this.deduplicateAndConsolidate();
  }

  private findSectionIndex(lines: string[], sectionName: string): number {
    const wanted = [`## ${sectionName}`, `### ${sectionName}`];
    return lines.findIndex((line) => wanted.includes(line.trim()));
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
      // Updated regex to handle optional ", Aggregated from X instances" suffix
      const bulletRegex = /\[Bullet #(\S+), helpful:(\d+), harmful:(\d+)(?:, [^\]]+)?\] (.+)/g;
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
    
    // Trigger deduplication hook after update
    await this.deduplicateAndConsolidate();
  }

  /**
   * Deduplication and consolidation hook
   * Runs after any update to AGENTS.md to find and merge duplicate bullets
   */
  async deduplicateAndConsolidate(): Promise<number> {
    console.log('[Curator] Running deduplication and consolidation...');
    
    const bullets = await this.loadKnowledgeBullets();
    if (bullets.length === 0) {
      console.log('[Curator] No bullets found, skipping deduplication');
      return 0;
    }

    const duplicateGroups = this.findDuplicates(bullets);
    
    if (duplicateGroups.length === 0) {
      console.log('[Curator] No duplicates found');
      return 0;
    }

    console.log(`[Curator] Found ${duplicateGroups.length} duplicate groups`);
    
    let consolidatedCount = 0;
    for (const group of duplicateGroups) {
      await this.consolidateGroup(group);
      consolidatedCount++;
    }

    console.log(`[Curator] Consolidated ${consolidatedCount} duplicate groups`);
    return consolidatedCount;
  }

  /**
   * Find duplicate bullets using normalized pattern matching
   * Returns groups of bullets that are duplicates of each other
   */
  private findDuplicates(bullets: KnowledgeBullet[]): KnowledgeBullet[][] {
    const groups: Map<string, KnowledgeBullet[]> = new Map();

    for (const bullet of bullets) {
      const normalized = this.normalizePattern(bullet.content);
      
      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized)!.push(bullet);
    }

    // Only return groups with 2+ bullets (duplicates)
    return Array.from(groups.values()).filter(group => group.length > 1);
  }

  /**
   * Consolidate a group of duplicate bullets
   * - Merges helpful/harmful counters
   * - Keeps the bullet with highest helpful count
   * - Removes other duplicates
   */
  private async consolidateGroup(group: KnowledgeBullet[]): Promise<void> {
    // Sort by helpful count (descending), then by harmful count (ascending)
    const sorted = group.sort((a, b) => {
      if (b.helpful !== a.helpful) return b.helpful - a.helpful;
      return a.harmful - b.harmful;
    });

    const winner = sorted[0];
    const losers = sorted.slice(1);

    // Aggregate counters
    const totalHelpful = group.reduce((sum, b) => sum + b.helpful, 0);
    const totalHarmful = group.reduce((sum, b) => sum + b.harmful, 0);

    console.log(`[Curator] Consolidating ${group.length} duplicates:`);
    console.log(`  Winner: ${winner.id} (helpful:${winner.helpful}, harmful:${winner.harmful})`);
    console.log(`  Merged: helpful:${totalHelpful}, harmful:${totalHarmful}`);

    // Update file: remove losers, update winner with aggregated counts
    const content = await readFile(this.knowledgePath, 'utf-8');
    let lines = content.split('\n');

    // Remove loser bullets
    for (const loser of losers) {
      lines = lines.filter(line => !line.includes(`[Bullet #${loser.id},`));
      console.log(`  Removed: ${loser.id}`);
    }

    // Update winner with aggregated counts
    const winnerRegex = new RegExp(
      `\\[Bullet #${winner.id}, helpful:\\d+, harmful:\\d+(?:, [^\\]]+)?\\] (.+)`
    );

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(winnerRegex);
      if (match) {
        const bulletContent = match[1];
        lines[i] = `[Bullet #${winner.id}, helpful:${totalHelpful}, harmful:${totalHarmful}, Aggregated from ${group.length} instances] ${bulletContent}`;
        console.log(`  Updated: ${winner.id} with aggregated counts`);
        break;
      }
    }

    await writeFile(this.knowledgePath, lines.join('\n'));
  }
}
