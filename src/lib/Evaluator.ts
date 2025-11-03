import { readFile } from 'fs/promises';
import { loadConfig } from './config.js';
import type { KnowledgeBullet, PlaybookMetrics } from './types.js';
import { parseKnowledgeBullets, FLEXIBLE_BULLET_PATTERN } from './knowledge-utils.js';

export interface EvaluationResult {
  improved: boolean;
  currentMetrics: PlaybookMetrics;
  candidateMetrics: PlaybookMetrics;
  delta: {
    totalBullets: number;
    netScore: number;
    avgHelpful: number;
  };
  reason: string;
}

export class Evaluator {
  private knowledgePath: string;

  constructor(knowledgePath?: string) {
    const config = loadConfig();
    this.knowledgePath = knowledgePath ?? config.agentsPath;
  }

  async evaluate(currentPlaybook: string, candidatePlaybook: string): Promise<EvaluationResult> {
    console.log('[Evaluator] Comparing playbooks...');

    const currentBullets = await this.parsePlaybook(currentPlaybook);
    const candidateBullets = await this.parsePlaybook(candidatePlaybook);

    const currentMetrics = this.computeMetrics(currentBullets);
    const candidateMetrics = this.computeMetrics(candidateBullets);

    const improved = this.isImproved(currentMetrics, candidateMetrics);
    const reason = this.generateReason(currentMetrics, candidateMetrics, improved);

    return {
      improved,
      currentMetrics,
      candidateMetrics,
      delta: {
        totalBullets: candidateMetrics.totalBullets - currentMetrics.totalBullets,
        netScore: candidateMetrics.netScore - currentMetrics.netScore,
        avgHelpful: candidateMetrics.avgHelpfulScore - currentMetrics.avgHelpfulScore,
      },
      reason,
    };
  }

  async evaluateFromFile(candidatePath?: string): Promise<EvaluationResult> {
    const currentContent = await readFile(this.knowledgePath, 'utf-8');
    const candidateContent = candidatePath
      ? await readFile(candidatePath, 'utf-8')
      : currentContent;

    return this.evaluate(currentContent, candidateContent);
  }

  private async parsePlaybook(content: string): Promise<KnowledgeBullet[]> {
    const parsedBullets = parseKnowledgeBullets(content, { trackSections: true });
    
    return parsedBullets.map(bullet => ({
      id: bullet.id,
      helpful: bullet.helpfulCount,
      harmful: bullet.harmfulCount,
      content: bullet.text,
      section: bullet.section || '',
    }));
  }

  private computeMetrics(bullets: KnowledgeBullet[]): PlaybookMetrics {
    if (bullets.length === 0) {
      return {
        totalBullets: 0,
        avgHelpfulScore: 0,
        avgHarmfulScore: 0,
        netScore: 0,
        sectionDistribution: {},
        topPerformingBullets: [],
        lowPerformingBullets: [],
      };
    }

    const totalHelpful = bullets.reduce((sum, b) => sum + b.helpful, 0);
    const totalHarmful = bullets.reduce((sum, b) => sum + b.harmful, 0);

    const sectionDistribution: Record<string, number> = {};
    for (const bullet of bullets) {
      sectionDistribution[bullet.section] = (sectionDistribution[bullet.section] || 0) + 1;
    }

    const sorted = bullets
      .map(b => ({ ...b, netScore: b.helpful - b.harmful }))
      .sort((a, b) => b.netScore - a.netScore);

    return {
      totalBullets: bullets.length,
      avgHelpfulScore: totalHelpful / bullets.length,
      avgHarmfulScore: totalHarmful / bullets.length,
      netScore: totalHelpful - totalHarmful,
      sectionDistribution,
      topPerformingBullets: sorted.slice(0, 5).map(({ netScore, ...b }) => b),
      lowPerformingBullets: sorted.slice(-5).map(({ netScore, ...b }) => b),
    };
  }

  private isImproved(current: PlaybookMetrics, candidate: PlaybookMetrics): boolean {
    if (candidate.netScore > current.netScore) return true;
    
    if (
      candidate.netScore === current.netScore &&
      candidate.avgHelpfulScore > current.avgHelpfulScore
    ) {
      return true;
    }

    if (
      candidate.totalBullets > current.totalBullets &&
      candidate.avgHelpfulScore >= current.avgHelpfulScore
    ) {
      return true;
    }

    return false;
  }

  private generateReason(
    current: PlaybookMetrics,
    candidate: PlaybookMetrics,
    improved: boolean
  ): string {
    if (!improved) {
      if (candidate.netScore < current.netScore) {
        return `Net score decreased from ${current.netScore} to ${candidate.netScore}`;
      }
      if (candidate.avgHelpfulScore < current.avgHelpfulScore) {
        const currentAvg = current.avgHelpfulScore.toFixed(2);
        const candidateAvg = candidate.avgHelpfulScore.toFixed(2);
        return `Average helpful score decreased from ${currentAvg} to ${candidateAvg}`;
      }
      return 'No measurable improvement detected';
    }

    const reasons: string[] = [];
    if (candidate.netScore > current.netScore) {
      reasons.push(`Net score improved from ${current.netScore} to ${candidate.netScore}`);
    }
    if (candidate.avgHelpfulScore > current.avgHelpfulScore) {
      const currentAvg = current.avgHelpfulScore.toFixed(2);
      const candidateAvg = candidate.avgHelpfulScore.toFixed(2);
      reasons.push(`Avg helpful increased from ${currentAvg} to ${candidateAvg}`);
    }
    if (
      candidate.totalBullets > current.totalBullets &&
      candidate.avgHelpfulScore >= current.avgHelpfulScore
    ) {
      const bulletsDiff = candidate.totalBullets - current.totalBullets;
      reasons.push(`Added ${bulletsDiff} new bullets without degrading quality`);
    }

    return reasons.join('; ');
  }

  async pruneUnhelpfulBullets(threshold: number = -3): Promise<number> {
    console.log(`[Evaluator] Pruning bullets with net score < ${threshold}...`);
    
    const content = await readFile(this.knowledgePath, 'utf-8');
    const bullets = await this.parsePlaybook(content);
    
    const toPrune = bullets.filter(b => (b.helpful - b.harmful) < threshold);
    
    if (toPrune.length === 0) {
      console.log('[Evaluator] No bullets to prune');
      return 0;
    }

    let updatedContent = content;
    for (const bullet of toPrune) {
      const bulletRegex = new RegExp(`\\[Bullet #${bullet.id}[^\\]]+\\][^\\n]*\\n?`, 'g');
      updatedContent = updatedContent.replace(bulletRegex, '');
    }

    const { writeFile } = await import('fs/promises');
    await writeFile(this.knowledgePath, updatedContent);
    
    console.log(`[Evaluator] Pruned ${toPrune.length} bullets`);
    return toPrune.length;
  }
}
