import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Curator } from '../agents/Curator.js';
import { Insight } from '../mcp/types.js';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';

describe('Curator', () => {
  const testDir = join(process.cwd(), 'test-temp-curator');
  const testInsightsPath = join(testDir, 'insights.jsonl');
  const testKnowledgePath = join(testDir, 'AGENT.md');

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

  it('should filter high-confidence insights', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath);

    const insights: Insight[] = [
      {
        id: 'insight-1',
        timestamp: new Date().toISOString(),
        taskId: 'bead-1',
        source: { runner: 'tsc', beadIds: ['bead-1'] },
        signal: { pattern: 'Type error', evidence: ['error'] },
        recommendation: 'Fix type error',
        scope: {},
        confidence: 0.9,
        onlineEligible: true,
        metaTags: ['tsc'],
      },
      {
        id: 'insight-2',
        timestamp: new Date().toISOString(),
        taskId: 'bead-2',
        source: { beadIds: ['bead-2'] },
        signal: { pattern: 'Low confidence', evidence: ['error'] },
        recommendation: 'Low confidence recommendation',
        scope: {},
        confidence: 0.5,
        onlineEligible: false,
        metaTags: [],
      },
    ];

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    const deltas = await curator.processInsights(0.8);

    expect(deltas.length).toBe(1);
    expect(deltas[0].confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should apply deltas to knowledge base', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath);

    const insights: Insight[] = [
      {
        id: 'insight-1',
        timestamp: new Date().toISOString(),
        taskId: 'bead-1',
        source: { runner: 'tsc', beadIds: ['bead-1'] },
        signal: { pattern: 'Module import error', evidence: ['Missing .js extension'] },
        recommendation: 'Always use .js extension in imports',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['tsc', 'module'],
      },
    ];

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    await curator.processInsights(0.8);

    const knowledgeContent = await readFile(testKnowledgePath, 'utf-8');
    
    expect(knowledgeContent).toContain('Module import error');
    expect(knowledgeContent).toContain('Always use .js extension in imports');
    expect(knowledgeContent).toContain('[Bullet #');
    expect(knowledgeContent).toContain('helpful:0, harmful:0]');
  });

  it('should respect max deltas per session', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath, 2);

    const insights: Insight[] = Array.from({ length: 5 }, (_, i) => ({
      id: `insight-${i}`,
      timestamp: new Date().toISOString(),
      taskId: `bead-${i}`,
      source: { runner: 'tsc', beadIds: [`bead-${i}`] },
      signal: { pattern: `Pattern ${i}`, evidence: [`Evidence ${i}`] },
      recommendation: `Recommendation ${i}`,
      scope: {},
      confidence: 0.9,
      onlineEligible: true,
      metaTags: ['tsc'],
    }));

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    const deltas = await curator.processInsights(0.8);

    expect(deltas.length).toBe(2);
  });

  it('should add bullets to correct section', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath);

    const insights: Insight[] = [
      {
        id: 'insight-ts',
        timestamp: new Date().toISOString(),
        taskId: 'bead-ts',
        source: { runner: 'tsc', beadIds: ['bead-ts'] },
        signal: { pattern: 'TypeScript type mismatch', evidence: ['type error'] },
        recommendation: 'Check types carefully',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['tsc', 'type'],
      },
      {
        id: 'insight-test',
        timestamp: new Date().toISOString(),
        taskId: 'bead-test',
        source: { runner: 'vitest', beadIds: ['bead-test'] },
        signal: { pattern: 'Test failure', evidence: ['test failed'] },
        recommendation: 'Run tests before commit',
        scope: {},
        confidence: 0.9,
        onlineEligible: true,
        metaTags: ['vitest', 'test'],
      },
    ];

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    await curator.processInsights(0.8);

    const knowledgeContent = await readFile(testKnowledgePath, 'utf-8');
    
    const tsSection = knowledgeContent.indexOf('## TypeScript Patterns');
    const testSection = knowledgeContent.indexOf('## Build & Test Patterns');
    const tsBullet = knowledgeContent.indexOf('TypeScript type mismatch');
    const testBullet = knowledgeContent.indexOf('Test failure');

    expect(tsBullet).toBeGreaterThan(tsSection);
    expect(testBullet).toBeGreaterThan(testSection);
  });

  it('should deduplicate similar insights', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath);

    const insights: Insight[] = [
      {
        id: 'insight-1',
        timestamp: new Date().toISOString(),
        taskId: 'bead-1',
        source: { runner: 'tsc', beadIds: ['bead-1'] },
        signal: { pattern: 'Type error in function', evidence: ['error 1'] },
        recommendation: 'Fix type error',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['tsc'],
      },
      {
        id: 'insight-2',
        timestamp: new Date().toISOString(),
        taskId: 'bead-2',
        source: { runner: 'tsc', beadIds: ['bead-2'] },
        signal: { pattern: 'Type Error In Function', evidence: ['error 2'] },
        recommendation: 'Fix type error',
        scope: {},
        confidence: 0.9,
        onlineEligible: true,
        metaTags: ['tsc'],
      },
    ];

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    const deltas = await curator.processInsights(0.8);

    expect(deltas.length).toBe(1);
  });

  it('should preserve existing bullets when adding new ones', async () => {
    const existingKnowledge = `# ACE Knowledge Base

## Build & Test Patterns
<!-- Curator adds patterns here -->

[Bullet #existing1, helpful:5, harmful:0] Run build before tests

## TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

[Bullet #existing2, helpful:3, harmful:1] Use strict mode
`;
    await writeFile(testKnowledgePath, existingKnowledge);

    const curator = new Curator(testInsightsPath, testKnowledgePath);

    const insights: Insight[] = [
      {
        id: 'insight-new',
        timestamp: new Date().toISOString(),
        taskId: 'bead-new',
        source: { runner: 'vitest', beadIds: ['bead-new'] },
        signal: { pattern: 'New pattern', evidence: ['new evidence'] },
        recommendation: 'New recommendation',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['vitest'],
      },
    ];

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    await curator.processInsights(0.8);

    const knowledgeContent = await readFile(testKnowledgePath, 'utf-8');
    
    expect(knowledgeContent).toContain('Bullet #existing1');
    expect(knowledgeContent).toContain('helpful:5, harmful:0');
    expect(knowledgeContent).toContain('Run build before tests');
    expect(knowledgeContent).toContain('Bullet #existing2');
    expect(knowledgeContent).toContain('helpful:3, harmful:1');
    expect(knowledgeContent).toContain('Use strict mode');
    expect(knowledgeContent).toContain('New pattern');
  });

  it('should load existing knowledge bullets', async () => {
    const existingKnowledge = `# ACE Knowledge Base

## Build & Test Patterns
[Bullet #abc123, helpful:5, harmful:0] Run build before tests
[Bullet #def456, helpful:2, harmful:1] Check lint errors

## TypeScript Patterns
[Bullet #ghi789, helpful:10, harmful:0] Use strict types
`;
    await writeFile(testKnowledgePath, existingKnowledge);

    const curator = new Curator(testInsightsPath, testKnowledgePath);
    const bullets = await curator.loadKnowledgeBullets();

    expect(bullets.length).toBe(3);
    expect(bullets[0].id).toBe('abc123');
    expect(bullets[0].helpful).toBe(5);
    expect(bullets[0].harmful).toBe(0);
    expect(bullets[0].content).toBe('Run build before tests');
  });

  it('should handle empty insights file gracefully', async () => {
    await writeFile(testInsightsPath, '');

    const curator = new Curator(testInsightsPath, testKnowledgePath);
    const deltas = await curator.processInsights(0.8);

    expect(deltas.length).toBe(0);
  });

  it('should prioritize insights by confidence', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath, 2);

    const insights: Insight[] = [
      {
        id: 'insight-low',
        timestamp: new Date().toISOString(),
        taskId: 'bead-low',
        source: { beadIds: ['bead-low'] },
        signal: { pattern: 'Low confidence pattern', evidence: ['evidence'] },
        recommendation: 'Low priority',
        scope: {},
        confidence: 0.81,
        onlineEligible: true,
        metaTags: [],
      },
      {
        id: 'insight-high',
        timestamp: new Date().toISOString(),
        taskId: 'bead-high',
        source: { beadIds: ['bead-high'] },
        signal: { pattern: 'High confidence pattern', evidence: ['evidence'] },
        recommendation: 'High priority',
        scope: {},
        confidence: 0.95,
        onlineEligible: true,
        metaTags: [],
      },
      {
        id: 'insight-medium',
        timestamp: new Date().toISOString(),
        taskId: 'bead-medium',
        source: { beadIds: ['bead-medium'] },
        signal: { pattern: 'Medium confidence pattern', evidence: ['evidence'] },
        recommendation: 'Medium priority',
        scope: {},
        confidence: 0.88,
        onlineEligible: true,
        metaTags: [],
      },
    ];

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    const deltas = await curator.processInsights(0.8);

    expect(deltas.length).toBe(2);
    expect(deltas[0].confidence).toBe(0.95);
    expect(deltas[1].confidence).toBe(0.88);
  });

  it('should format bullet lines correctly', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath);

    const insights: Insight[] = [
      {
        id: 'insight-format',
        timestamp: new Date().toISOString(),
        taskId: 'bead-format',
        source: { runner: 'tsc', beadIds: ['bead-format'] },
        signal: { pattern: 'Test pattern', evidence: ['evidence'] },
        recommendation: 'Test recommendation',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['tsc'],
      },
    ];

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    const deltas = await curator.processInsights(0.8);

    const knowledgeContent = await readFile(testKnowledgePath, 'utf-8');
    const bulletMatch = knowledgeContent.match(/\[Bullet #([a-f0-9]+), helpful:0, harmful:0\] (.+)/);
    
    expect(bulletMatch).toBeTruthy();
    expect(bulletMatch![2]).toBe('Test pattern - Test recommendation');
  });

  it('should handle discovery chain insights correctly', async () => {
    const curator = new Curator(testInsightsPath, testKnowledgePath);

    const insights: Insight[] = [
      {
        id: 'insight-discovery',
        timestamp: new Date().toISOString(),
        taskId: 'bead-1',
        source: { beadIds: ['bead-1', 'bead-2', 'bead-3'] },
        signal: { pattern: 'discovery-chain', evidence: ['Discovered issue: bead-2', 'Discovered issue: bead-3'] },
        recommendation: 'When working on similar tasks, consider: bead-2, bead-3',
        scope: {},
        confidence: 0.85,
        onlineEligible: true,
        metaTags: ['discovery', 'meta-pattern'],
      },
    ];

    await writeFile(testInsightsPath, insights.map((i) => JSON.stringify(i)).join('\n'));

    await curator.processInsights(0.8);

    const knowledgeContent = await readFile(testKnowledgePath, 'utf-8');
    
    expect(knowledgeContent).toContain('Architecture Patterns');
    expect(knowledgeContent).toContain('discovery-chain');
  });
});
