import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Generator } from '../src/lib/Generator.js';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { ExecutionResult } from '../mcp/types.js';
import { join } from 'path';

describe('Generator', () => {
  const testDir = join(process.cwd(), 'test-temp-generator');
  const testKnowledgePath = join(testDir, 'AGENT.md');
  const testTracePath = join(testDir, 'execution_traces.jsonl');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });

    const mockKnowledge = `# ACE Knowledge Base

## Build & Test Patterns

[Bullet #test-001, helpful:5, harmful:0] Always run npm run build before npm test to catch type errors early
[Bullet #test-002, helpful:2, harmful:1] Use async/await for all promises to improve readability
[Bullet #test-003, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files
`;

    await writeFile(testKnowledgePath, mockKnowledge, 'utf-8');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load knowledge bullets on task start', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task description');

    const bullets = generator.getAvailableBullets();
    expect(bullets).toHaveLength(3);
    expect(bullets[0].id).toBe('test-001');
    expect(bullets[0].helpful).toBe(5);
    expect(bullets[0].harmful).toBe(0);
  });

  it('should track consulted bullets', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');

    await generator.consultBullet('test-001', 'Needed to understand build order');

    const trace = generator.getCurrentTrace();
    expect(trace?.bullets_consulted).toHaveLength(1);
    expect(trace?.bullets_consulted[0].bullet_id).toBe('test-001');
    expect(trace?.bullets_consulted[0].feedback).toBe('ignored');
  });

  it('should mark bullets as helpful', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');

    await generator.consultBullet('test-001', 'Checking build order');
    await generator.markBulletHelpful('test-001', 'Prevented TypeScript errors');

    const trace = generator.getCurrentTrace();
    const bullet = trace?.bullets_consulted.find((b) => b.bullet_id === 'test-001');
    expect(bullet?.feedback).toBe('helpful');
    expect(bullet?.reason).toBe('Prevented TypeScript errors');
  });

  it('should mark bullets as harmful', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');

    await generator.consultBullet('test-002', 'Trying async/await pattern');
    await generator.markBulletHarmful('test-002', 'Made synchronous code unnecessarily complex');

    const trace = generator.getCurrentTrace();
    const bullet = trace?.bullets_consulted.find((b) => b.bullet_id === 'test-002');
    expect(bullet?.feedback).toBe('harmful');
    expect(bullet?.reason).toBe('Made synchronous code unnecessarily complex');
  });

  it('should record execution results', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');

    const result: ExecutionResult = {
      status: 'pass',
      errors: [],
      stdout: 'Tests passed',
      stderr: '',
      exitCode: 0,
      duration: 1234,
      timestamp: new Date().toISOString(),
    };

    await generator.recordExecution(result);

    const trace = generator.getCurrentTrace();
    expect(trace?.execution_results).toHaveLength(1);
    expect(trace?.execution_results[0].status).toBe('pass');
  });

  it('should update outcome based on execution failures', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');

    const failedResult: ExecutionResult = {
      status: 'fail',
      errors: [
        {
          tool: 'tsc',
          file: 'src/test.ts',
          line: 42,
          message: 'Type error',
          severity: 'error',
        },
      ],
      stdout: '',
      stderr: 'Compilation failed',
      exitCode: 1,
      duration: 500,
      timestamp: new Date().toISOString(),
    };

    await generator.recordExecution(failedResult);

    const trace = generator.getCurrentTrace();
    expect(trace?.outcome).toBe('failure');
  });

  it('should record discovered issues', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');

    await generator.recordDiscoveredIssue('test-bead-2');
    await generator.recordDiscoveredIssue('test-bead-3');

    const trace = generator.getCurrentTrace();
    expect(trace?.discovered_issues).toEqual(['test-bead-2', 'test-bead-3']);
  });

  it('should write execution trace on task completion', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');

    await generator.consultBullet('test-001', 'Build order check');
    await generator.markBulletHelpful('test-001', 'Helped avoid errors');

    const result: ExecutionResult = {
      status: 'pass',
      errors: [],
      stdout: 'Success',
      stderr: '',
      exitCode: 0,
      duration: 1000,
      timestamp: new Date().toISOString(),
    };
    await generator.recordExecution(result);

    const completedTrace = await generator.completeTask('success');

    expect(completedTrace.completed).toBe(true);
    expect(completedTrace.outcome).toBe('success');

    const traceFile = await readFile(testTracePath, 'utf-8');
    const traces = traceFile
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(traces).toHaveLength(1);
    expect(traces[0].bead_id).toBe('test-bead-1');
    expect(traces[0].bullets_consulted).toHaveLength(1);
    expect(traces[0].execution_results).toHaveLength(1);
  });

  it('should handle multiple bullets with mixed feedback', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');

    await generator.consultBullet('test-001', 'Build order');
    await generator.markBulletHelpful('test-001', 'Prevented errors');

    await generator.consultBullet('test-002', 'Async pattern');
    await generator.markBulletHarmful('test-002', 'Not applicable');

    await generator.consultBullet('test-003', 'Import extensions');

    const completedTrace = await generator.completeTask('success');

    expect(completedTrace.bullets_consulted).toHaveLength(3);
    expect(completedTrace.bullets_consulted.filter((b) => b.feedback === 'helpful')).toHaveLength(1);
    expect(completedTrace.bullets_consulted.filter((b) => b.feedback === 'harmful')).toHaveLength(1);
    expect(completedTrace.bullets_consulted.filter((b) => b.feedback === 'ignored')).toHaveLength(1);
  });

  it('should clear trace after completion', async () => {
    const generator = new Generator(testKnowledgePath, testTracePath);
    await generator.startTask('test-bead-1', 'Test task');
    await generator.completeTask('success');

    expect(generator.getCurrentTrace()).toBeNull();
  });
});
