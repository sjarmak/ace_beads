import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Generator } from '../agents/Generator.js';
import { Reflector } from '../agents/Reflector.js';
import { KnowledgeAnalyzer } from '../mcp/knowledge-analyzer.js';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Bullet Feedback Mechanism', () => {
  const testDir = resolve(process.cwd(), 'test-temp-bullet-feedback');
  const knowledgePath = resolve(testDir, 'AGENTS.md');
  const tracesPath = resolve(testDir, 'execution_traces.jsonl');
  const insightsPath = resolve(testDir, 'insights.jsonl');
  
  let generator: Generator;
  let reflector: Reflector;
  let analyzer: KnowledgeAnalyzer;

  beforeEach(async () => {
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }

    // Create initial AGENTS.md with a generic bullet
    const initialKnowledge = `# Knowledge Base

## TypeScript Patterns

[Bullet #async-001, helpful:0, harmful:0] Use async/await for all promises to improve readability and error handling
`;
    await writeFile(knowledgePath, initialKnowledge);

    generator = new Generator(knowledgePath, tracesPath);
    reflector = new Reflector(tracesPath, insightsPath);
    analyzer = new KnowledgeAnalyzer();
  });

  afterEach(async () => {
    if (existsSync(tracesPath)) await unlink(tracesPath);
    if (existsSync(insightsPath)) await unlink(insightsPath);
    if (existsSync(knowledgePath)) await unlink(knowledgePath);
  });

  it('should increment helpful counter when bullet provides value', async () => {
    await generator.startTask('test-bead-1', 'Test helpful feedback');
    await generator.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator.markBulletHelpful('async-001', 'Helped avoid callback hell in API client');
    await generator.completeTask();

    // Read updated AGENTS.md
    const content = await readFile(knowledgePath, 'utf-8');
    expect(content).toContain('[Bullet #async-001, helpful:1, harmful:0]');
  });

  it('should increment harmful counter when bullet causes issues', async () => {
    await generator.startTask('test-bead-2', 'Test harmful feedback');
    await generator.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator.markBulletHarmful('async-001', 'Made synchronous code unnecessarily complex');
    await generator.completeTask();

    const content = await readFile(knowledgePath, 'utf-8');
    expect(content).toContain('[Bullet #async-001, helpful:0, harmful:1]');
  });

  it('should track both counters independently with conflicting feedback', async () => {
    // First task: bullet is helpful
    await generator.startTask('test-bead-helpful', 'Test helpful scenario');
    await generator.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator.markBulletHelpful('async-001', 'Simplified promise chain');
    await generator.completeTask();

    let content = await readFile(knowledgePath, 'utf-8');
    expect(content).toContain('[Bullet #async-001, helpful:1, harmful:0]');

    // Second task: same bullet is harmful
    generator = new Generator(knowledgePath, tracesPath); // Reload with updated knowledge
    await generator.startTask('test-bead-harmful', 'Test harmful scenario');
    await generator.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator.markBulletHarmful('async-001', 'Not needed for synchronous operation');
    await generator.completeTask();

    content = await readFile(knowledgePath, 'utf-8');
    expect(content).toContain('[Bullet #async-001, helpful:1, harmful:1]');

    // Third task: helpful again
    generator = new Generator(knowledgePath, tracesPath);
    await generator.startTask('test-bead-helpful-2', 'Test helpful again');
    await generator.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator.markBulletHelpful('async-001', 'Clean error handling');
    await generator.completeTask();

    content = await readFile(knowledgePath, 'utf-8');
    expect(content).toContain('[Bullet #async-001, helpful:2, harmful:1]');
  });

  it('should identify bullets with harmful > helpful * 2 as archival candidates', async () => {
    // Create a bullet with poor feedback ratio
    const knowledgeWithBadBullet = `# Knowledge Base

## TypeScript Patterns

[Bullet #badadvice, helpful:2, harmful:5] Always use classes instead of functions for better structure
`;
    await writeFile(knowledgePath, knowledgeWithBadBullet);

    const bullets = await analyzer.parseAgentsMd(knowledgePath);
    const candidates = analyzer.identifyArchivalCandidates(bullets);

    expect(candidates.length).toBe(1);
    expect(candidates[0].bullet.id).toBe('badadvice');
    expect(candidates[0].reason).toBe('high-harmful');
    expect(candidates[0].harmfulToHelpfulRatio).toBe(2.5);
  });

  it('should not flag bullets with balanced or positive feedback', async () => {
    const knowledgeWithGoodBullet = `# Knowledge Base

## TypeScript Patterns

[Bullet #goodadvice, helpful:10, harmful:2] Run npm run build before npm test to catch type errors
`;
    await writeFile(knowledgePath, knowledgeWithGoodBullet);

    const bullets = await analyzer.parseAgentsMd(knowledgePath);
    const candidates = analyzer.identifyArchivalCandidates(bullets);

    expect(candidates.length).toBe(0);
  });

  it('should detect conflicting feedback patterns across multiple traces', async () => {
    // First task: bullet is helpful
    await generator.startTask('test-bead-helpful-trace', 'Helpful scenario');
    await generator.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator.markBulletHelpful('async-001', 'Helped in API calls');
    await generator.completeTask();

    // Second task: same bullet is harmful
    generator = new Generator(knowledgePath, tracesPath);
    await generator.startTask('test-bead-harmful-trace', 'Harmful scenario');
    await generator.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator.markBulletHarmful('async-001', 'Caused issues in synchronous utils');
    await generator.completeTask();

    // Read both traces
    const traceContent = await readFile(tracesPath, 'utf-8');
    const traces = traceContent.trim().split('\n').map(line => JSON.parse(line));

    expect(traces.length).toBe(2);
    expect(traces[0].bullets_consulted[0].feedback).toBe('helpful');
    expect(traces[1].bullets_consulted[0].feedback).toBe('harmful');
    
    // Verify the counters in AGENTS.md reflect both
    const content = await readFile(knowledgePath, 'utf-8');
    expect(content).toContain('[Bullet #async-001, helpful:1, harmful:1]');
  });

  it('should handle edge case of zero helpful with high harmful', async () => {
    const knowledgeWithZeroHelpful = `# Knowledge Base

## TypeScript Patterns

[Bullet #neverhelpful, helpful:0, harmful:5] Always avoid using type annotations for better flexibility
`;
    await writeFile(knowledgePath, knowledgeWithZeroHelpful);

    const bullets = await analyzer.parseAgentsMd(knowledgePath);
    const candidates = analyzer.identifyArchivalCandidates(bullets);

    expect(candidates.length).toBe(1);
    expect(candidates[0].reason).toBe('low-signal');
  });

  it('should preserve bullet counters across multiple Generator instances', async () => {
    // First instance
    await generator.startTask('test-bead-1', 'First instance task');
    await generator.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator.markBulletHelpful('async-001', 'Helpful reason 1');
    await generator.completeTask();

    // Create new instance (simulates new session)
    const generator2 = new Generator(knowledgePath, tracesPath);
    await generator2.startTask('test-bead-2', 'Second instance task');
    await generator2.consultBullet('async-001', 'Use async/await for all promises to improve readability and error handling');
    await generator2.markBulletHarmful('async-001', 'Harmful reason 1');
    await generator2.completeTask();

    // Verify both updates persisted
    const content = await readFile(knowledgePath, 'utf-8');
    expect(content).toContain('[Bullet #async-001, helpful:1, harmful:1]');
  });
});
