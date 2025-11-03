import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { KnowledgeAnalyzer, type ParsedBullet } from '../src/lib/knowledge-analyzer.js';

const b = (id: string, text: string, helpful: number, harmful: number, line: number, opts?: { section?: string; aggregatedFrom?: number }): ParsedBullet => ({
  id, text, helpfulCount: helpful, harmfulCount: harmful, lineNumber: line, section: opts?.section, aggregatedFrom: opts?.aggregatedFrom,
});

describe('KnowledgeAnalyzer', () => {
  let analyzer: KnowledgeAnalyzer;
  const testDir = join(process.cwd(), 'test-temp-knowledge-analyzer');
  const testAgentsMd = join(testDir, 'AGENTS.md');

  beforeEach(() => {
    analyzer = new KnowledgeAnalyzer();
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  describe('detectDuplicates', () => {
    it('should detect exact duplicates', () => {
      const bullets = [
        b('bullet-1', 'Always validate user input before processing', 5, 0, 1, { section: 'Build' }),
        b('bullet-2', 'Always validate user input before processing', 3, 1, 2, { section: 'Build' }),
      ];

      const clusters = analyzer.detectDuplicates(bullets);

      expect(clusters).toHaveLength(1);
      expect(clusters[0].duplicates).toHaveLength(1);
      expect(clusters[0].mergedHelpfulCount).toBe(8);
      expect(clusters[0].mergedHarmfulCount).toBe(1);
    });

    it('should not detect dissimilar bullets', () => {
      const bullets = [
        b('bullet-1', 'TypeScript module imports require .js extension', 10, 0, 1, { section: 'TypeScript' }),
        b('bullet-2', 'Always run build before tests to catch type errors', 8, 0, 2, { section: 'Build' }),
      ];

      expect(analyzer.detectDuplicates(bullets)).toHaveLength(0);
    });

    it('should select representative with highest score', () => {
      const bullets = [
        b('bullet-1', 'Run tests before committing code', 2, 1, 1, { section: 'Testing' }), // score: 1
        b('bullet-2', 'Run tests before committing code', 10, 0, 2, { section: 'Testing' }), // score: 10
        b('bullet-3', 'Run tests before committing code', 5, 2, 3, { section: 'Testing' }), // score: 3
      ];

      const clusters = analyzer.detectDuplicates(bullets);

      expect(clusters).toHaveLength(1);
      expect(clusters[0].representative.id).toBe('bullet-2');
      expect(clusters[0].duplicates.map(b => b.id)).toEqual(['bullet-1', 'bullet-3']);
    });

    it('should aggregate counts from all duplicates', () => {
      const bullets = [
        b('bullet-1', 'Pattern A', 5, 1, 1, { section: 'Section', aggregatedFrom: 3 }),
        b('bullet-2', 'Pattern A', 10, 2, 2, { section: 'Section', aggregatedFrom: 5 }),
      ];

      const clusters = analyzer.detectDuplicates(bullets);

      expect(clusters[0].mergedHelpfulCount).toBe(15);
      expect(clusters[0].mergedHarmfulCount).toBe(3);
      expect(clusters[0].mergedAggregatedFrom).toBe(8);
    });
  });

  describe('identifyArchivalCandidates', () => {
    it('should identify bullets with zero engagement', () => {
      const bullets = [b('bullet-1', 'Never used pattern', 0, 0, 1, { section: 'Unused' })];
      const candidates = analyzer.identifyArchivalCandidates(bullets);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].reason).toBe('zero-helpful');
    });

    it('should identify bullets with zero helpful but some harmful', () => {
      const bullets = [b('bullet-1', 'Harmful pattern', 0, 5, 1, { section: 'Bad' })];
      const candidates = analyzer.identifyArchivalCandidates(bullets);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].reason).toBe('low-signal');
    });

    it('should identify bullets with high harmful ratio (>2:1)', () => {
      const bullets = [b('bullet-1', 'Mostly harmful pattern', 3, 10, 1, { section: 'Patterns' })];
      const candidates = analyzer.identifyArchivalCandidates(bullets);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].reason).toBe('high-harmful');
      expect(candidates[0].harmfulToHelpfulRatio).toBeCloseTo(10 / 3, 2);
    });

    it('should not identify high-quality bullets', () => {
      const bullets = [b('bullet-1', 'Great pattern', 20, 2, 1, { section: 'Patterns' })];
      expect(analyzer.identifyArchivalCandidates(bullets)).toHaveLength(0);
    });
  });

  describe('generateReviewReport', () => {
    it('should generate complete review report from AGENTS.md', async () => {
      const agentsMdContent = `# AGENTS.md

## Learned Patterns

### Build Patterns

[Bullet #abc123, helpful:10, harmful:0] Always run build before tests
[Bullet #def456, helpful:5, harmful:1] Run linter after build
[Bullet #ghi789, helpful:5, harmful:1] Run linter after build

### Low Quality

[Bullet #jkl012, helpful:0, harmful:0] Unused pattern
[Bullet #mno345, helpful:1, harmful:5] Bad pattern
`;

      writeFileSync(testAgentsMd, agentsMdContent, 'utf-8');

      const report = await analyzer.generateReviewReport(testAgentsMd);

      expect(report.totalBullets).toBe(5);
      expect(report.duplicateClusters.length).toBeGreaterThan(0);
      expect(report.archivalCandidates.length).toBeGreaterThan(0);
      expect(report.estimatedTokenSavings).toBeGreaterThan(0);
      expect(report.timestamp).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty bullet list', () => {
      expect(analyzer.detectDuplicates([])).toHaveLength(0);
      expect(analyzer.identifyArchivalCandidates([])).toHaveLength(0);
    });

    it('should handle single bullet', () => {
      const bullets = [b('bullet-1', 'Single bullet', 5, 0, 1, { section: 'Section' })];

      expect(analyzer.detectDuplicates(bullets)).toHaveLength(0);
      expect(analyzer.identifyArchivalCandidates(bullets)).toHaveLength(0);
    });

    it('should handle bullets with missing aggregatedFrom field', () => {
      const bullets = [
        b('bullet-1', 'Pattern', 5, 0, 1, { section: 'Section' }),
        b('bullet-2', 'Pattern', 3, 0, 2, { section: 'Section' }),
      ];

      const clusters = analyzer.detectDuplicates(bullets);

      expect(clusters[0].mergedAggregatedFrom).toBe(2); // defaults to 1 per bullet
    });
  });
});
