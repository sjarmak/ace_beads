import { readFile } from 'fs/promises';
import { resolve } from 'path';

export interface ParsedBullet {
  id: string;
  helpfulCount: number;
  harmfulCount: number;
  text: string;
  lineNumber: number;
  aggregatedFrom?: number;
}

export interface DuplicateCluster {
  representative: ParsedBullet;
  duplicates: ParsedBullet[];
  mergedHelpfulCount: number;
  mergedHarmfulCount: number;
  mergedAggregatedFrom: number;
}

export interface ArchivalCandidate {
  bullet: ParsedBullet;
  reason: 'low-signal' | 'high-harmful' | 'zero-helpful';
  harmfulToHelpfulRatio?: number;
}

export interface ReviewReport {
  timestamp: string;
  totalBullets: number;
  duplicateClusters: DuplicateCluster[];
  archivalCandidates: ArchivalCandidate[];
  estimatedTokenSavings: number;
}

const BULLET_PATTERN = /^\s*\[Bullet #([a-zA-Z0-9]+), helpful:(\d+), harmful:(\d+)(?:, Aggregated from (\d+) instances)?\] (.+)$/;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.90;

export class KnowledgeAnalyzer {
  async parseAgentsMd(filePath?: string): Promise<ParsedBullet[]> {
    const path = filePath || resolve(process.cwd(), 'AGENTS.md');
    const content = await readFile(path, 'utf-8');
    const lines = content.split('\n');
    const bullets: ParsedBullet[] = [];

    lines.forEach((line, index) => {
      const match = line.match(BULLET_PATTERN);
      if (match) {
        const [, id, helpful, harmful, aggregated, text] = match;
        bullets.push({
          id,
          helpfulCount: parseInt(helpful, 10),
          harmfulCount: parseInt(harmful, 10),
          text: text.trim(),
          lineNumber: index + 1,
          aggregatedFrom: aggregated ? parseInt(aggregated, 10) : undefined,
        });
      }
    });

    return bullets;
  }

  detectDuplicates(bullets: ParsedBullet[]): DuplicateCluster[] {
    const clusters: DuplicateCluster[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < bullets.length; i++) {
      if (processed.has(bullets[i].id)) continue;

      const cluster: ParsedBullet[] = [bullets[i]];
      processed.add(bullets[i].id);

      for (let j = i + 1; j < bullets.length; j++) {
        if (processed.has(bullets[j].id)) continue;

        const similarity = this.computeSimilarity(bullets[i].text, bullets[j].text);
        if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
          cluster.push(bullets[j]);
          processed.add(bullets[j].id);
        }
      }

      if (cluster.length > 1) {
        const representative = this.selectRepresentative(cluster);
        const duplicates = cluster.filter(b => b.id !== representative.id);
        
        clusters.push({
          representative,
          duplicates,
          mergedHelpfulCount: cluster.reduce((sum, b) => sum + b.helpfulCount, 0),
          mergedHarmfulCount: cluster.reduce((sum, b) => sum + b.harmfulCount, 0),
          mergedAggregatedFrom: cluster.reduce((sum, b) => sum + (b.aggregatedFrom || 1), 0),
        });
      }
    }

    return clusters;
  }

  identifyArchivalCandidates(bullets: ParsedBullet[]): ArchivalCandidate[] {
    const candidates: ArchivalCandidate[] = [];

    for (const bullet of bullets) {
      if (bullet.helpfulCount === 0 && bullet.harmfulCount === 0) {
        candidates.push({
          bullet,
          reason: 'zero-helpful',
        });
      } else if (bullet.helpfulCount === 0 && bullet.harmfulCount > 0) {
        candidates.push({
          bullet,
          reason: 'low-signal',
        });
      } else if (bullet.harmfulCount > bullet.helpfulCount * 2) {
        candidates.push({
          bullet,
          reason: 'high-harmful',
          harmfulToHelpfulRatio: bullet.harmfulCount / bullet.helpfulCount,
        });
      }
    }

    return candidates;
  }

  async generateReviewReport(filePath?: string): Promise<ReviewReport> {
    const bullets = await this.parseAgentsMd(filePath);
    const duplicateClusters = this.detectDuplicates(bullets);
    const archivalCandidates = this.identifyArchivalCandidates(bullets);

    const estimatedTokenSavings = this.estimateTokenSavings(duplicateClusters, archivalCandidates);

    return {
      timestamp: new Date().toISOString(),
      totalBullets: bullets.length,
      duplicateClusters,
      archivalCandidates,
      estimatedTokenSavings,
    };
  }

  private computeSimilarity(text1: string, text2: string): number {
    const tokens1 = this.tokenize(text1.toLowerCase());
    const tokens2 = this.tokenize(text2.toLowerCase());

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  private selectRepresentative(cluster: ParsedBullet[]): ParsedBullet {
    return cluster.reduce((best, current) => {
      const bestScore = best.helpfulCount - best.harmfulCount;
      const currentScore = current.helpfulCount - current.harmfulCount;
      return currentScore > bestScore ? current : best;
    });
  }

  private estimateTokenSavings(
    duplicateClusters: DuplicateCluster[],
    archivalCandidates: ArchivalCandidate[]
  ): number {
    const TOKENS_PER_BULLET = 50;
    const duplicateSavings = duplicateClusters.reduce((sum, cluster) => sum + cluster.duplicates.length, 0);
    const archivalSavings = archivalCandidates.length;
    return (duplicateSavings + archivalSavings) * TOKENS_PER_BULLET;
  }
}
