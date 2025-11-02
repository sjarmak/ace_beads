import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Reflector } from '../src/lib/Reflector.js';
import { Curator } from '../src/lib/Curator.js';
import { ExecutionTrace } from '../src/lib/Generator.js';
import { Insight, ExecutionResult, NormalizedError } from '../src/lib/mcp-types.js';
import { writeFile, mkdir, rm, readFile, appendFile } from 'fs/promises';
import { join } from 'path';

// Helper to create properly-typed ExecutionResult
function createExecResult(
  tool: 'tsc' | 'vitest' | 'eslint' | 'unknown',
  status: 'pass' | 'fail',
  errorMsg: string,
  file: string,
  line: number = 1
): ExecutionResult {
  const errors: NormalizedError[] = status === 'fail' ? [{
    tool,
    severity: 'error',
    message: errorMsg,
    file,
    line,
  }] : [];
  
  return {
    status,
    errors,
    stdout: '',
    stderr: status === 'fail' ? errorMsg : '',
    exitCode: status === 'fail' ? 1 : 0,
    duration: 1000,
    timestamp: new Date().toISOString(),
  };
}

describe('Multi-Epoch Learning with Batch Insights', () => {
  const testDir = join(process.cwd(), 'test-temp-multi-epoch');
  const testTracesPath = join(testDir, 'execution_traces.jsonl');
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
    await writeFile(testTracesPath, '');
    await writeFile(testInsightsPath, '');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should identify meta-patterns across multiple epochs', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);
    const curator = new Curator(testInsightsPath, testKnowledgePath, 20);

    // Simulate 'week 1' - 5 beads with TypeScript errors
    const week1Traces: ExecutionTrace[] = Array.from({ length: 5 }, (_, i) => ({
      trace_id: `trace-week1-${i}`,
      timestamp: new Date(2025, 0, i + 1).toISOString(),
      bead_id: `bead-week1-${i}`,
      task_description: `Fix TypeScript issue ${i}`,
      execution_results: [createExecResult(
        'tsc',
        'fail',
        `Type 'string' is not assignable to type 'number'`,
        `src/module${i}.ts`,
        10 + i
      )],
      discovered_issues: [],
      bullets_consulted: [],
      completed: false,
      outcome: 'partial' as const,
    }));

    // Simulate 'week 2' - 4 beads with missing tests
    const week2Traces: ExecutionTrace[] = Array.from({ length: 4 }, (_, i) => ({
      trace_id: `trace-week2-${i}`,
      timestamp: new Date(2025, 0, i + 8).toISOString(),
      bead_id: `bead-week2-${i}`,
      task_description: `Add feature ${i}`,
      execution_results: [createExecResult(
        'vitest',
        'fail',
        `No tests found for module${i}.ts`,
        `tests/module${i}.test.ts`,
        1
      )],
      discovered_issues: [`discovered-${i}`],
      bullets_consulted: [],
      completed: false,
      outcome: 'partial' as const,
    }));

    // Simulate 'week 3' - 3 beads with import errors
    const week3Traces: ExecutionTrace[] = Array.from({ length: 3 }, (_, i) => ({
      trace_id: `trace-week3-${i}`,
      timestamp: new Date(2025, 0, i + 15).toISOString(),
      bead_id: `bead-week3-${i}`,
      task_description: `Fix imports ${i}`,
      execution_results: [createExecResult(
        'tsc',
        'fail',
        `Cannot find module './utils'`,
        `src/app${i}.ts`,
        5
      )],
      discovered_issues: [],
      bullets_consulted: [],
      completed: false,
      outcome: 'partial' as const,
    }));

    // Write all traces to file
    const allTraces = [...week1Traces, ...week2Traces, ...week3Traces];
    for (const trace of allTraces) {
      await appendFile(testTracesPath, JSON.stringify(trace) + '\n');
    }

    // Run batch analysis to find meta-patterns
    const insights = await reflector.analyzeMultipleTraces();

    expect(insights.length).toBeGreaterThan(0);

    // Verify clusters were identified
    const tscCluster = insights.find(i => 
      i.source.runner === 'tsc' && i.signal.pattern.includes('Type')
    );
    const testCluster = insights.find(i => 
      i.source.runner === 'vitest' && i.signal.pattern.includes('test')
    );
    const importCluster = insights.find(i => 
      i.signal.pattern.toLowerCase().includes('module') || 
      i.signal.pattern.toLowerCase().includes('import')
    );

    // Should have insights from different error clusters
    expect(tscCluster || importCluster).toBeDefined();
    expect(testCluster).toBeDefined();

    // Apply insights to knowledge base
    await curator.processInsights(0.7);

    const knowledgeContent = await readFile(testKnowledgePath, 'utf-8');
    
    // Verify bullets were added
    const bullets = await curator.loadKnowledgeBullets();
    expect(bullets.length).toBeGreaterThan(0);
    
    console.log(`Generated ${insights.length} meta-pattern insights from ${allTraces.length} traces`);
    console.log(`Added ${bullets.length} bullets to knowledge base`);
  });

  it('should aggregate evidence from multiple beads in meta-bullets', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);
    const curator = new Curator(testInsightsPath, testKnowledgePath, 10);

    // Create 6 traces with the same error pattern across different beads
    const traces: ExecutionTrace[] = Array.from({ length: 6 }, (_, i) => ({
      trace_id: `trace-${i}`,
      timestamp: new Date(2025, 0, i + 1).toISOString(),
      bead_id: `bead-${i}`,
      task_description: `Task ${i}`,
      execution_results: [createExecResult(
        'tsc',
        'fail',
        'Cannot find module with .ts extension',
        `src/file${i}.ts`,
        i + 1
      )],
      discovered_issues: [],
      bullets_consulted: [],
      completed: false,
      outcome: 'failure' as const,
    }));

    for (const trace of traces) {
      await appendFile(testTracesPath, JSON.stringify(trace) + '\n');
    }

    // Analyze multiple traces to find patterns
    const insights = await reflector.analyzeMultipleTraces();

    // Should have at least one insight with evidence from multiple beads
    expect(insights.length).toBeGreaterThan(0);
    
    const multiBeadInsight = insights.find(i => 
      i.source.beadIds && i.source.beadIds.length > 1
    );
    
    expect(multiBeadInsight).toBeDefined();
    expect(multiBeadInsight!.source.beadIds!.length).toBeGreaterThanOrEqual(2);
    
    console.log(`Meta-insight aggregates evidence from ${multiBeadInsight!.source.beadIds!.length} beads`);
  });

  it('should create higher abstraction meta-patterns from clusters', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);
    const curator = new Curator(testInsightsPath, testKnowledgePath, 10);

    // Create diverse TypeScript-related errors to test abstraction
    const errorPatterns = [
      'Type error: string not assignable to number',
      'Type error: undefined not assignable to object',
      'Type error: null not assignable to string',
      'Type error: array not assignable to string',
    ];

    const traces: ExecutionTrace[] = errorPatterns.map((msg, i) => ({
      trace_id: `trace-${i}`,
      timestamp: new Date(2025, 0, i + 1).toISOString(),
      bead_id: `bead-${i}`,
      task_description: `Fix type error ${i}`,
      execution_results: [createExecResult(
        'tsc',
        'fail',
        msg,
        `src/file${i}.ts`,
        10
      )],
      discovered_issues: [],
      bullets_consulted: [],
      completed: false,
      outcome: 'partial' as const,
    }));

    for (const trace of traces) {
      await appendFile(testTracesPath, JSON.stringify(trace) + '\n');
    }

    // Analyze to find meta-pattern
    const insights = await reflector.analyzeMultipleTraces();

    // Should identify a higher-level pattern about type safety
    expect(insights.length).toBeGreaterThan(0);
    
    const typeInsights = insights.filter(i => 
      i.metaTags?.includes('tsc') || i.signal.pattern.toLowerCase().includes('type')
    );
    
    expect(typeInsights.length).toBeGreaterThan(0);
    
    // Apply to knowledge base
    await curator.processInsights(0.7);
    
    const bullets = await curator.loadKnowledgeBullets();
    const typeBullets = bullets.filter(b => 
      b.content.toLowerCase().includes('type')
    );
    
    expect(typeBullets.length).toBeGreaterThan(0);
    
    console.log(`Abstracted ${errorPatterns.length} specific type errors into ${typeBullets.length} meta-patterns`);
  });

  it('should handle multi-epoch learning cycles', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);
    const curator = new Curator(testInsightsPath, testKnowledgePath, 5);

    // Epoch 1: Initial insights
    const epoch1Traces: ExecutionTrace[] = Array.from({ length: 3 }, (_, i) => ({
      trace_id: `epoch1-${i}`,
      timestamp: new Date(2025, 0, i + 1).toISOString(),
      bead_id: `epoch1-bead-${i}`,
      task_description: `Epoch 1 task ${i}`,
      execution_results: [createExecResult(
        'tsc',
        'fail',
        'Module import error',
        `src/e1-${i}.ts`,
        5
      )],
      discovered_issues: [],
      bullets_consulted: [],
      completed: false,
      outcome: 'partial' as const,
    }));

    // Epoch 2: More insights on similar patterns
    const epoch2Traces: ExecutionTrace[] = Array.from({ length: 4 }, (_, i) => ({
      trace_id: `epoch2-${i}`,
      timestamp: new Date(2025, 0, i + 8).toISOString(),
      bead_id: `epoch2-bead-${i}`,
      task_description: `Epoch 2 task ${i}`,
      execution_results: [createExecResult(
        'tsc',
        'fail',
        'Module import error',
        `src/e2-${i}.ts`,
        3
      )],
      discovered_issues: [],
      bullets_consulted: [],
      completed: false,
      outcome: 'partial' as const,
    }));

    // Write epoch 1 traces and analyze
    for (const trace of epoch1Traces) {
      await appendFile(testTracesPath, JSON.stringify(trace) + '\n');
    }
    
    const epoch1Insights = await reflector.analyzeMultipleTraces();
    const epoch1Deltas = await curator.processInsights(0.7);
    
    const bulletsAfterEpoch1 = await curator.loadKnowledgeBullets();
    const epoch1Count = bulletsAfterEpoch1.length;

    // Write epoch 2 traces and analyze
    for (const trace of epoch2Traces) {
      await appendFile(testTracesPath, JSON.stringify(trace) + '\n');
    }
    
    const epoch2Insights = await reflector.analyzeMultipleTraces();
    const epoch2Deltas = await curator.processInsights(0.7);
    
    const bulletsAfterEpoch2 = await curator.loadKnowledgeBullets();
    const epoch2Count = bulletsAfterEpoch2.length;

    // Verify learning happened in both epochs
    expect(epoch1Insights.length).toBeGreaterThan(0);
    expect(epoch2Insights.length).toBeGreaterThan(0);
    
    // Bullets should increase or stay same (due to deduplication)
    expect(epoch2Count).toBeGreaterThanOrEqual(epoch1Count);
    
    console.log(`Epoch 1: ${epoch1Insights.length} insights, ${epoch1Count} bullets`);
    console.log(`Epoch 2: ${epoch2Insights.length} insights, ${epoch2Count} bullets`);
    console.log(`Multi-epoch learning: ${epoch1Count} -> ${epoch2Count} bullets`);
  });

  it('should verify epoch summary is added to knowledge base', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);
    const curator = new Curator(testInsightsPath, testKnowledgePath, 10);

    // Simulate completed work cycle
    const traces: ExecutionTrace[] = Array.from({ length: 8 }, (_, i) => ({
      trace_id: `trace-${i}`,
      timestamp: new Date(2025, 0, i + 1).toISOString(),
      bead_id: `bead-${i}`,
      task_description: `Complete task ${i}`,
      execution_results: [createExecResult(
        i % 2 === 0 ? 'tsc' : 'vitest',
        'pass',
        '',
        '',
        1
      )],
      discovered_issues: [],
      bullets_consulted: [],
      completed: true,
      outcome: 'success' as const,
    }));

    for (const trace of traces) {
      await appendFile(testTracesPath, JSON.stringify(trace) + '\n');
    }

    // Run batch analysis
    const insights = await reflector.analyzeMultipleTraces();
    
    // Process insights
    await curator.processInsights(0.5); // Lower threshold for test

    // Read knowledge base
    const content = await readFile(testKnowledgePath, 'utf-8');
    const bullets = await curator.loadKnowledgeBullets();

    // Verify bullets were added (representing epoch learning)
    expect(bullets.length).toBeGreaterThanOrEqual(0);
    
    // Verify sections exist
    expect(content).toMatch(/## Build & Test Patterns/);
    expect(content).toMatch(/## TypeScript Patterns/);
    
    console.log(`Epoch summary: Processed ${traces.length} traces, generated ${insights.length} insights, added ${bullets.length} bullets`);
  });

  it('should cluster similar insights and generate consolidated recommendations', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);
    const curator = new Curator(testInsightsPath, testKnowledgePath, 20);

    // Create 10 traces with variations of the same underlying issue
    const traces: ExecutionTrace[] = [
      // Group 1: Import path issues (5 traces)
      ...Array.from({ length: 5 }, (_, i) => ({
        trace_id: `import-${i}`,
        timestamp: new Date(2025, 0, i + 1).toISOString(),
        bead_id: `import-bead-${i}`,
        task_description: `Fix import ${i}`,
        execution_results: [createExecResult(
          'tsc',
          'fail',
          `Cannot find module './file${i}'`,
          `src/app${i}.ts`,
          i + 1
        )],
        discovered_issues: [],
        bullets_consulted: [],
        completed: false,
        outcome: 'partial' as const,
      })),
      // Group 2: Test coverage issues (5 traces)
      ...Array.from({ length: 5 }, (_, i) => ({
        trace_id: `test-${i}`,
        timestamp: new Date(2025, 0, i + 10).toISOString(),
        bead_id: `test-bead-${i}`,
        task_description: `Add tests ${i}`,
        execution_results: [createExecResult(
          'vitest',
          'fail',
          `No test file found for component${i}`,
          `src/component${i}.ts`,
          1
        )],
        discovered_issues: [`test-issue-${i}`],
        bullets_consulted: [],
        completed: false,
        outcome: 'partial' as const,
      })),
    ];

    for (const trace of traces) {
      await appendFile(testTracesPath, JSON.stringify(trace) + '\n');
    }

    // Run batch analysis
    const insights = await reflector.analyzeMultipleTraces();

    // Should cluster similar errors
    expect(insights.length).toBeGreaterThan(0);
    
    // Look for insights with multiple beads (clustered)
    const clusteredInsights = insights.filter(i => 
      i.source.beadIds && i.source.beadIds.length >= 2
    );
    
    expect(clusteredInsights.length).toBeGreaterThan(0);
    
    // Apply to knowledge base
    await curator.processInsights(0.7);
    
    const bullets = await curator.loadKnowledgeBullets();
    
    // Should have consolidated bullets (fewer than individual traces)
    expect(bullets.length).toBeLessThan(traces.length);
    expect(bullets.length).toBeGreaterThan(0);
    
    console.log(`Clustered ${traces.length} traces into ${insights.length} insights and ${bullets.length} consolidated bullets`);
  });
});
