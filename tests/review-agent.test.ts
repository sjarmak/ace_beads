import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeAnalyzer } from '../src/lib/knowledge-analyzer.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Knowledge Analyzer', () => {
  let analyzer: KnowledgeAnalyzer;
  const testDir = resolve(process.cwd(), 'test-temp-knowledge-analyzer');
  const testFilePath = resolve(testDir, 'test-agents.md');

  beforeEach(async () => {
    analyzer = new KnowledgeAnalyzer();
    
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
  });

  describe('Bullet Parsing', () => {
    it('should parse bullets with all counters', async () => {
      const content = `
# Test AGENTS.md

[Bullet #abc123, helpful:5, harmful:2] Always use TypeScript for type safety
[Bullet #def456, helpful:0, harmful:0] Check for null values before accessing properties
[Bullet #ghi789, helpful:10, harmful:1, Aggregated from 3 instances] Run tests before committing
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);

      expect(bullets.length).toBe(3);
      expect(bullets[0]).toMatchObject({
        id: 'abc123',
        helpfulCount: 5,
        harmfulCount: 2,
        text: 'Always use TypeScript for type safety',
      });
      expect(bullets[2].aggregatedFrom).toBe(3);

      await unlink(testFilePath);
    });

    it('should handle empty AGENTS.md', async () => {
      await writeFile(testFilePath, '# Empty File\n\nNo bullets here.');

      const bullets = await analyzer.parseAgentsMd(testFilePath);

      expect(bullets.length).toBe(0);

      await unlink(testFilePath);
    });

    it('should skip malformed bullet lines', async () => {
      const content = `
[Bullet #valid1, helpful:1, harmful:0] Valid bullet
This is not a bullet
[Invalid bullet format]
[Bullet #valid2, helpful:2, harmful:1] Another valid bullet
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);

      expect(bullets.length).toBe(2);
      expect(bullets[0].id).toBe('valid1');
      expect(bullets[1].id).toBe('valid2');

      await unlink(testFilePath);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect exact duplicates', async () => {
      const content = `
[Bullet #dup1, helpful:3, harmful:0] TypeScript module imports require .js extension even for .ts files
[Bullet #dup2, helpful:2, harmful:0] TypeScript module imports require .js extension even for .ts files
[Bullet #dup3, helpful:1, harmful:0] TypeScript module imports require .js extension even for .ts files
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);
      const clusters = analyzer.detectDuplicates(bullets);

      expect(clusters.length).toBe(1);
      expect(clusters[0].duplicates.length).toBe(2);
      expect(clusters[0].mergedHelpfulCount).toBe(6);
      expect(clusters[0].mergedHarmfulCount).toBe(0);

      await unlink(testFilePath);
    });

    it('should detect high-similarity duplicates (> 0.90 threshold)', async () => {
      const content = `
[Bullet #sim1, helpful:5, harmful:0] Always validate input before processing
[Bullet #sim2, helpful:3, harmful:0] Always validate input before processing
[Bullet #different, helpful:1, harmful:0] Use async/await for all asynchronous operations
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);
      const clusters = analyzer.detectDuplicates(bullets);

      expect(clusters.length).toBe(1);
      expect(clusters[0].duplicates.length).toBe(1);
      expect(clusters[0].representative.id).toMatch(/sim[12]/);

      await unlink(testFilePath);
    });

    it('should not cluster dissimilar bullets', async () => {
      const content = `
[Bullet #diff1, helpful:2, harmful:0] Use TypeScript for type safety
[Bullet #diff2, helpful:1, harmful:0] Always write unit tests
[Bullet #diff3, helpful:3, harmful:0] Document public APIs
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);
      const clusters = analyzer.detectDuplicates(bullets);

      expect(clusters.length).toBe(0);

      await unlink(testFilePath);
    });

    it('should select representative with highest helpful-harmful score', async () => {
      const content = `
[Bullet #low1, helpful:2, harmful:1] Run tests before committing code
[Bullet #high1, helpful:10, harmful:0] Run tests before committing code
[Bullet #low2, helpful:3, harmful:2] Run tests before committing code
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);
      const clusters = analyzer.detectDuplicates(bullets);

      expect(clusters.length).toBe(1);
      expect(clusters[0].representative.id).toBe('high1');

      await unlink(testFilePath);
    });
  });

  describe('Archival Candidate Identification', () => {
    it('should identify zero-helpful bullets', async () => {
      const content = `
[Bullet #zero1, helpful:0, harmful:0] Unused pattern
[Bullet #zero2, helpful:0, harmful:0] Never applied pattern
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);
      const candidates = analyzer.identifyArchivalCandidates(bullets);

      expect(candidates.length).toBe(2);
      expect(candidates.every(c => c.reason === 'zero-helpful')).toBe(true);

      await unlink(testFilePath);
    });

    it('should identify high-harmful bullets (harmful > helpful * 2)', async () => {
      const content = `
[Bullet #bad1, helpful:2, harmful:5] Bad advice that causes issues
[Bullet #bad2, helpful:1, harmful:10] Another harmful pattern
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);
      const candidates = analyzer.identifyArchivalCandidates(bullets);

      expect(candidates.length).toBe(2);
      expect(candidates.every(c => c.reason === 'high-harmful')).toBe(true);
      expect(candidates[0].harmfulToHelpfulRatio).toBe(2.5);
      expect(candidates[1].harmfulToHelpfulRatio).toBe(10);

      await unlink(testFilePath);
    });

    it('should identify low-signal bullets (zero helpful, some harmful)', async () => {
      const content = `
[Bullet #lowsig1, helpful:0, harmful:3] Pattern that only caused problems
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);
      const candidates = analyzer.identifyArchivalCandidates(bullets);

      expect(candidates.length).toBe(1);
      expect(candidates[0].reason).toBe('low-signal');

      await unlink(testFilePath);
    });

    it('should not flag healthy bullets', async () => {
      const content = `
[Bullet #good1, helpful:10, harmful:2] Good pattern with positive feedback
[Bullet #good2, helpful:5, harmful:1] Another useful pattern
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);
      const candidates = analyzer.identifyArchivalCandidates(bullets);

      expect(candidates.length).toBe(0);

      await unlink(testFilePath);
    });
  });

  describe('Review Report Generation', () => {
    it('should generate comprehensive review report', async () => {
      const content = `
# AGENTS.md

[Bullet #dup1, helpful:5, harmful:0] TypeScript requires .js extension for imports
[Bullet #dup2, helpful:3, harmful:0] TypeScript requires .js extension for imports
[Bullet #good1, helpful:10, harmful:1] Always run tests before committing
[Bullet #zero1, helpful:0, harmful:0] Unused pattern
[Bullet #bad1, helpful:1, harmful:5] Harmful pattern
`;
      await writeFile(testFilePath, content);

      const report = await analyzer.generateReviewReport(testFilePath);

      expect(report.totalBullets).toBe(5);
      expect(report.duplicateClusters.length).toBe(1);
      expect(report.archivalCandidates.length).toBe(2);
      expect(report.estimatedTokenSavings).toBeGreaterThan(0);
      expect(report.timestamp).toBeDefined();

      await unlink(testFilePath);
    });

    it('should estimate token savings correctly', async () => {
      const content = `
[Bullet #dup1, helpful:2, harmful:0] Duplicate pattern A
[Bullet #dup2, helpful:1, harmful:0] Duplicate pattern A
[Bullet #dup3, helpful:1, harmful:0] Duplicate pattern A
[Bullet #zero1, helpful:0, harmful:0] Unused pattern
[Bullet #zero2, helpful:0, harmful:0] Another unused pattern
`;
      await writeFile(testFilePath, content);

      const report = await analyzer.generateReviewReport(testFilePath);

      const expectedSavings = (2 + 2) * 50;
      expect(report.estimatedTokenSavings).toBe(expectedSavings);

      await unlink(testFilePath);
    });
  });

  describe('Edge Cases', () => {
    it('should handle bullets with special characters', async () => {
      const content = `
[Bullet #special1, helpful:1, harmful:0] Use quotes "like this" in strings
[Bullet #special2, helpful:2, harmful:0] Handle $variables and {objects} properly
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);

      expect(bullets.length).toBe(2);
      expect(bullets[0].text).toContain('quotes "like this"');

      await unlink(testFilePath);
    });

    it('should handle very long bullet text', async () => {
      const longText = 'A '.repeat(200) + 'very long pattern description';
      const content = `
[Bullet #long1, helpful:1, harmful:0] ${longText}
`;
      await writeFile(testFilePath, content);

      const bullets = await analyzer.parseAgentsMd(testFilePath);

      expect(bullets.length).toBe(1);
      expect(bullets[0].text).toBe(longText);

      await unlink(testFilePath);
    });
  });
});
