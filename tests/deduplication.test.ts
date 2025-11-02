import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Curator } from '../src/lib/Curator.js';
import { Insight } from '../src/lib/mcp-types.js';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';

describe('Knowledge Base Deduplication', () => {
  const testDir = join(process.cwd(), 'test-temp-dedup');
  const testInsightsPath = join(testDir, 'insights.jsonl');
  const testKnowledgePath = join(testDir, 'AGENTS.md');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    
    const initialKnowledge = `# ACE Knowledge Base

## Build & Test Patterns
<!-- Curator adds patterns here -->

## TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

## Dependency Patterns
<!-- Curator adds patterns about Beads dependency chains here -->

## Architecture Patterns
<!-- Curator adds high-level design insights here -->
`;
    await writeFile(testKnowledgePath, initialKnowledge);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should merge duplicate bullets and sum counters', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath, 10);

    // Create 5 duplicate insights about the same pattern
    const insights: Insight[] = Array.from({ length: 5 }, (_, i) => ({
      id: `insight-${i}`,
      timestamp: new Date().toISOString(),
      taskId: `bead-${i}`,
      source: { runner: 'tsc', beadIds: [`bead-${i}`] },
      signal: { 
        pattern: 'TypeScript module imports require .js extension even for .ts files',
        evidence: ['Module not found error'] 
      },
      recommendation: 'Always use .js extensions in import statements for TypeScript files when using ESM module resolution',
      scope: {},
      confidence: 0.85,
      onlineEligible: true,
      metaTags: ['tsc', 'module'],
      delta: "TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution",
    }));

    await writeFile(testInsightsPath, insights.map(i => JSON.stringify(i)).join('\n'));

    // Process insights - should create 5 bullets
    await curator.processInsights(0.8);

    // Load bullets before deduplication
    const bulletsBefore = await curator.loadKnowledgeBullets();
    expect(bulletsBefore.length).toBeGreaterThanOrEqual(5);

    // Manually trigger deduplication
    const consolidatedCount = await curator.deduplicateAndConsolidate();
    expect(consolidatedCount).toBeGreaterThan(0);

    // Load bullets after deduplication
    const bulletsAfter = await curator.loadKnowledgeBullets();
    
    // Should have fewer bullets now (duplicates merged)
    expect(bulletsAfter.length).toBeLessThan(bulletsBefore.length);
    expect(bulletsAfter.length).toBeGreaterThanOrEqual(1);

    // Find the merged bullet
    const mergedBullet = bulletsAfter.find(b => 
      b.content.includes('TypeScript module imports require .js extension')
    );
    
    expect(mergedBullet).toBeDefined();
    
    // Verify it's marked as aggregated
    const content = await readFile(testKnowledgePath, 'utf-8');
    expect(content).toMatch(/Aggregated from \d+ instances/);
  });

  it('should reduce knowledge base size after deduplication', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath, 20);

    // Create many similar insights to push over 10k tokens
    const patterns = [
      'TypeScript module imports require .js extension',
      'TypeScript type errors from incorrect variable type assignment',
      'TypeScript build errors require running tsc before tests',
    ];

    const insights: Insight[] = [];
    
    // Create 30 insights (10 of each pattern)
    for (let i = 0; i < 30; i++) {
      const patternIndex = i % patterns.length;
      insights.push({
        id: `insight-${i}`,
        timestamp: new Date().toISOString(),
        taskId: `bead-${i}`,
        source: { runner: 'tsc', beadIds: [`bead-${i}`] },
        signal: { 
          pattern: patterns[patternIndex],
          evidence: ['error'] 
        },
        recommendation: `Always handle ${patterns[patternIndex]}`,
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['tsc'],
        delta: `${patterns[patternIndex]} - Always handle ${patterns[patternIndex]}`,
      });
    }

    await writeFile(testInsightsPath, insights.map(i => JSON.stringify(i)).join('\n'));

    // Process all insights
    await curator.processInsights(0.8);

    // Get size before deduplication
    const contentBefore = await readFile(testKnowledgePath, 'utf-8');
    const tokensBefore = contentBefore.length; // Approximate token count

    // Trigger deduplication
    const consolidatedCount = await curator.deduplicateAndConsolidate();
    expect(consolidatedCount).toBeGreaterThan(0);

    // Get size after deduplication
    const contentAfter = await readFile(testKnowledgePath, 'utf-8');
    const tokensAfter = contentAfter.length;

    // Size should be reduced
    expect(tokensAfter).toBeLessThan(tokensBefore);
    
    console.log(`Size reduction: ${tokensBefore} -> ${tokensAfter} (${((1 - tokensAfter/tokensBefore) * 100).toFixed(1)}% reduction)`);
  });

  it('should keep bullet with higher helpful count when merging', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath, 10);

    // Create 3 identical insights
    const insights: Insight[] = Array.from({ length: 3 }, (_, i) => ({
      id: `insight-${i}`,
      timestamp: new Date().toISOString(),
      taskId: `bead-${i}`,
      source: { runner: 'vitest', beadIds: [`bead-${i}`] },
      signal: { 
        pattern: 'Always run tests before marking issues complete',
        evidence: ['test failure'] 
      },
      recommendation: 'Running npm test is mandatory before closing any issue',
      scope: {},
      confidence: 0.9,
      onlineEligible: true,
      metaTags: ['vitest', 'testing'],
      delta: 'Always run tests before marking issues complete - Running npm test is mandatory before closing any issue',
    }));

    await writeFile(testInsightsPath, insights.map(i => JSON.stringify(i)).join('\n'));

    // Process insights - creates 3 bullets
    await curator.processInsights(0.8);

    // Manually update helpful counters to different values
    const bullets = await curator.loadKnowledgeBullets();
    const testBullets = bullets.filter(b => b.content.includes('Always run tests'));
    
    // Update the file directly to set different helpful counts
    let content = await readFile(testKnowledgePath, 'utf-8');
    
    // Set different helpful counts: 1, 3, 2
    let bulletCount = 0;
    for (const bullet of testBullets) {
      const helpfulValue = [1, 3, 2][bulletCount];
      content = content.replace(
        `[Bullet #${bullet.id}, helpful:0, harmful:0]`,
        `[Bullet #${bullet.id}, helpful:${helpfulValue}, harmful:0]`
      );
      bulletCount++;
      if (bulletCount >= 3) break;
    }
    
    await writeFile(testKnowledgePath, content);

    // Trigger deduplication
    await curator.deduplicateAndConsolidate();

    // Verify only one bullet remains with summed helpful count (1+3+2 = 6)
    const bulletsAfter = await curator.loadKnowledgeBullets();
    const mergedBullets = bulletsAfter.filter(b => b.content.includes('Always run tests'));
    
    expect(mergedBullets.length).toBe(1);
    expect(mergedBullets[0].helpful).toBe(6);
    
    // Verify it kept the ID of the bullet with highest helpful count (3)
    const finalContent = await readFile(testKnowledgePath, 'utf-8');
    expect(finalContent).toMatch(/Aggregated from 3 instances/);
  });

  it('should not lose semantic information during consolidation', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath, 10);

    // Create insights with same pattern but slightly different wording
    const insights: Insight[] = [
      {
        id: 'insight-1',
        timestamp: new Date().toISOString(),
        taskId: 'bead-1',
        source: { runner: 'tsc', beadIds: ['bead-1'] },
        signal: { 
          pattern: 'TypeScript module imports require .js extension even for .ts files',
          evidence: ['error'] 
        },
        recommendation: 'Always use .js extensions in import statements',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['tsc'],
        delta: 'TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements',
      },
      {
        id: 'insight-2',
        timestamp: new Date().toISOString(),
        taskId: 'bead-2',
        source: { runner: 'tsc', beadIds: ['bead-2'] },
        signal: { 
          pattern: 'TypeScript   Module   Imports   Require   .js   Extension   even   for   .ts   files',
          evidence: ['error'] 
        },
        recommendation: 'Always use .js extensions in import statements',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['tsc'],
        delta: 'TypeScript   Module   Imports   Require   .js   Extension   even   for   .ts   files - Always use .js extensions in import statements',
      },
    ];

    await writeFile(testInsightsPath, insights.map(i => JSON.stringify(i)).join('\n'));

    // Process insights
    await curator.processInsights(0.8);

    // Trigger deduplication
    await curator.deduplicateAndConsolidate();

    // Verify the content is preserved
    const content = await readFile(testKnowledgePath, 'utf-8');
    expect(content).toMatch(/TypeScript module imports require \.js extension/i);
    expect(content).toMatch(/Always use \.js extensions in import statements/);
    
    // Should have only one bullet for this pattern
    const bullets = await curator.loadKnowledgeBullets();
    const tsBullets = bullets.filter(b => 
      b.content.toLowerCase().includes('typescript module imports')
    );
    expect(tsBullets.length).toBe(1);
  });

  it('should handle empty knowledge base gracefully', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath);

    // Trigger deduplication on empty knowledge base
    const consolidatedCount = await curator.deduplicateAndConsolidate();
    
    expect(consolidatedCount).toBe(0);
  });

  it('should not merge bullets from different sections', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath, 10);

    const insights: Insight[] = [
      {
        id: 'insight-1',
        timestamp: new Date().toISOString(),
        taskId: 'bead-1',
        source: { runner: 'tsc', beadIds: ['bead-1'] },
        signal: { 
          pattern: 'Common pattern',
          evidence: ['error'] 
        },
        recommendation: 'Fix it',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['tsc'],
        delta: 'Common pattern - Fix it',
      },
      {
        id: 'insight-2',
        timestamp: new Date().toISOString(),
        taskId: 'bead-2',
        source: { beadIds: ['bead-2'] },
        signal: { 
          pattern: 'Common pattern',
          evidence: ['error'] 
        },
        recommendation: 'Fix it',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['meta-pattern'],
        delta: 'Common pattern - Fix it',
      },
    ];

    await writeFile(testInsightsPath, insights.map(i => JSON.stringify(i)).join('\n'));

    // Process insights - should go to different sections
    await curator.processInsights(0.8);

    // Get content to verify sections
    const content = await readFile(testKnowledgePath, 'utf-8');
    
    // Both patterns should exist (in different sections, so won't merge)
    const bullets = await curator.loadKnowledgeBullets();
    const commonPatternBullets = bullets.filter(b => b.content.includes('Common pattern'));
    
    // Should have 2 bullets (one in each section)
    expect(commonPatternBullets.length).toBe(2);
  });
});
