import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Reflector } from '../src/lib/Reflector.js';
import { ExecutionTrace } from '../src/lib/Generator.js';
import { ExecutionResult } from '../mcp/types.js';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';

describe('Reflector', () => {
  const testDir = join(process.cwd(), 'test-temp-reflector');
  const testInsightsPath = join(testDir, 'insights.jsonl');
  const testTracesPath = join(testDir, 'execution_traces.jsonl');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should analyze trace with TypeScript errors', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const trace: ExecutionTrace = {
      trace_id: 'trace-1',
      timestamp: new Date().toISOString(),
      bead_id: 'test-bead-1',
      task_description: 'Fix TypeScript errors',
      bullets_consulted: [],
      execution_results: [
        {
          status: 'fail',
          errors: [
            {
              tool: 'tsc',
              file: 'src/test.ts',
              line: 42,
              message: "Type 'string' is not assignable to type 'number'",
              severity: 'error',
            },
          ],
          stdout: '',
          stderr: 'Compilation failed',
          exitCode: 1,
          duration: 1000,
          timestamp: new Date().toISOString(),
        },
      ],
      discovered_issues: [],
      completed: true,
      outcome: 'failure',
    };

    const insights = await reflector.analyzeTrace(trace);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].source.runner).toBe('tsc');
    expect(insights[0].signal.pattern).toContain('Type');
    expect(insights[0].metaTags).toContain('tsc');
  });

  it('should analyze discovery chain', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const trace: ExecutionTrace = {
      trace_id: 'trace-2',
      timestamp: new Date().toISOString(),
      bead_id: 'test-bead-2',
      task_description: 'Add authentication',
      bullets_consulted: [],
      execution_results: [],
      discovered_issues: ['test-bead-3', 'test-bead-4', 'test-bead-5'],
      completed: true,
      outcome: 'success',
    };

    const insights = await reflector.analyzeTrace(trace);

    expect(insights.length).toBe(1);
    expect(insights[0].signal.pattern).toBe('discovery-chain');
    expect(insights[0].source.beadIds).toContain('test-bead-2');
    expect(insights[0].source.beadIds).toContain('test-bead-3');
    expect(insights[0].confidence).toBeGreaterThanOrEqual(0.85);
    expect(insights[0].onlineEligible).toBe(true);
  });

  it('should analyze harmful bullet feedback', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const trace: ExecutionTrace = {
      trace_id: 'trace-3',
      timestamp: new Date().toISOString(),
      bead_id: 'test-bead-3',
      task_description: 'Test task',
      bullets_consulted: [
        {
          bullet_id: 'bullet-1',
          bullet_content: 'Always use async/await',
          feedback: 'harmful',
          reason: 'Made synchronous code unnecessarily complex',
        },
      ],
      execution_results: [],
      discovered_issues: [],
      completed: true,
      outcome: 'success',
    };

    const insights = await reflector.analyzeTrace(trace);

    expect(insights.length).toBe(1);
    expect(insights[0].signal.pattern).toBe('harmful-bullet-feedback');
    expect(insights[0].metaTags).toContain('review-needed');
    expect(insights[0].onlineEligible).toBe(false);
  });

  it('should cluster recurring errors across multiple traces', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const traces: ExecutionTrace[] = [
      {
        trace_id: 'trace-4',
        timestamp: new Date().toISOString(),
        bead_id: 'test-bead-4',
        task_description: 'Task 1',
        bullets_consulted: [],
        execution_results: [
          {
            status: 'fail',
            errors: [
              {
                tool: 'tsc',
                file: 'src/file1.ts',
                line: 10,
                message: 'Cannot find module',
                severity: 'error',
              },
            ],
            stdout: '',
            stderr: '',
            exitCode: 1,
            duration: 500,
            timestamp: new Date().toISOString(),
          },
        ],
        discovered_issues: [],
        completed: true,
        outcome: 'failure',
      },
      {
        trace_id: 'trace-5',
        timestamp: new Date().toISOString(),
        bead_id: 'test-bead-5',
        task_description: 'Task 2',
        bullets_consulted: [],
        execution_results: [
          {
            status: 'fail',
            errors: [
              {
                tool: 'tsc',
                file: 'src/file2.ts',
                line: 20,
                message: 'Cannot find module',
                severity: 'error',
              },
            ],
            stdout: '',
            stderr: '',
            exitCode: 1,
            duration: 500,
            timestamp: new Date().toISOString(),
          },
        ],
        discovered_issues: [],
        completed: true,
        outcome: 'failure',
      },
    ];

    await writeFile(testTracesPath, traces.map((t) => JSON.stringify(t)).join('\n'));

    const insights = await reflector.analyzeMultipleTraces();

    expect(insights.length).toBeGreaterThan(0);
    const clusterInsight = insights.find((i) => i.metaTags.includes('recurring-error'));
    expect(clusterInsight).toBeDefined();
    expect(clusterInsight?.source.beadIds).toHaveLength(2);
  });

  it('should calculate confidence based on frequency and severity', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const highFrequencyTrace: ExecutionTrace = {
      trace_id: 'trace-6',
      timestamp: new Date().toISOString(),
      bead_id: 'test-bead-6',
      task_description: 'High frequency errors',
      bullets_consulted: [],
      execution_results: [
        {
          status: 'fail',
          errors: [
            {
              tool: 'tsc',
              file: 'src/a.ts',
              line: 1,
              message: 'Type error',
              severity: 'error',
            },
            {
              tool: 'tsc',
              file: 'src/b.ts',
              line: 2,
              message: 'Type error',
              severity: 'error',
            },
            {
              tool: 'tsc',
              file: 'src/c.ts',
              line: 3,
              message: 'Type error',
              severity: 'error',
            },
          ],
          stdout: '',
          stderr: '',
          exitCode: 1,
          duration: 500,
          timestamp: new Date().toISOString(),
        },
      ],
      discovered_issues: [],
      completed: true,
      outcome: 'failure',
    };

    const insights = await reflector.analyzeTrace(highFrequencyTrace);

    expect(insights[0].confidence).toBeGreaterThan(0.5);
  });

  it('should write insights to JSONL file', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const trace: ExecutionTrace = {
      trace_id: 'trace-7',
      timestamp: new Date().toISOString(),
      bead_id: 'test-bead-7',
      task_description: 'Test writing insights',
      bullets_consulted: [],
      execution_results: [
        {
          status: 'fail',
          errors: [
            {
              tool: 'eslint',
              file: 'src/test.ts',
              line: 5,
              message: 'Missing semicolon',
              severity: 'error',
            },
          ],
          stdout: '',
          stderr: '',
          exitCode: 1,
          duration: 300,
          timestamp: new Date().toISOString(),
        },
      ],
      discovered_issues: [],
      completed: true,
      outcome: 'failure',
    };

    await reflector.analyzeTrace(trace);

    const insightsContent = await readFile(testInsightsPath, 'utf-8');
    const insights = insightsContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]).toHaveProperty('id');
    expect(insights[0]).toHaveProperty('timestamp');
    expect(insights[0]).toHaveProperty('signal');
    expect(insights[0]).toHaveProperty('recommendation');
    expect(insights[0]).toHaveProperty('confidence');
  });

  it('should mark high-confidence insights as online eligible', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const traces: ExecutionTrace[] = Array.from({ length: 5 }, (_, i) => ({
      trace_id: `trace-${i}`,
      timestamp: new Date().toISOString(),
      bead_id: `test-bead-${i}`,
      task_description: `Task ${i}`,
      bullets_consulted: [],
      execution_results: [
        {
          status: 'fail',
          errors: [
            {
              tool: 'tsc',
              file: `src/file${i}.ts`,
              line: i * 10,
              message: 'Module requires .js extension',
              severity: 'error',
            },
          ],
          stdout: '',
          stderr: '',
          exitCode: 1,
          duration: 500,
          timestamp: new Date().toISOString(),
        },
      ],
      discovered_issues: [],
      completed: true,
      outcome: 'failure',
    }));

    await writeFile(testTracesPath, traces.map((t) => JSON.stringify(t)).join('\n'));

    const insights = await reflector.analyzeMultipleTraces();

    const highConfidenceInsights = insights.filter((i) => i.onlineEligible);
    expect(highConfidenceInsights.length).toBeGreaterThan(0);
    expect(highConfidenceInsights[0].confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should handle traces with no errors gracefully', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const successTrace: ExecutionTrace = {
      trace_id: 'trace-success',
      timestamp: new Date().toISOString(),
      bead_id: 'test-bead-success',
      task_description: 'Successful task',
      bullets_consulted: [],
      execution_results: [
        {
          status: 'pass',
          errors: [],
          stdout: 'All tests passed',
          stderr: '',
          exitCode: 0,
          duration: 1000,
          timestamp: new Date().toISOString(),
        },
      ],
      discovered_issues: [],
      completed: true,
      outcome: 'success',
    };

    const insights = await reflector.analyzeTrace(successTrace);

    expect(insights.length).toBe(0);
  });

  it('should generate appropriate recommendations for different error types', async () => {
    const reflector = new Reflector(testInsightsPath, testTracesPath);

    const moduleErrorTrace: ExecutionTrace = {
      trace_id: 'trace-module',
      timestamp: new Date().toISOString(),
      bead_id: 'test-bead-module',
      task_description: 'Module error test',
      bullets_consulted: [],
      execution_results: [
        {
          status: 'fail',
          errors: [
            {
              tool: 'tsc',
              file: 'src/import.ts',
              line: 1,
              message: "Cannot find module './utils'",
              severity: 'error',
            },
          ],
          stdout: '',
          stderr: '',
          exitCode: 1,
          duration: 500,
          timestamp: new Date().toISOString(),
        },
      ],
      discovered_issues: [],
      completed: true,
      outcome: 'failure',
    };

    const insights = await reflector.analyzeTrace(moduleErrorTrace);

    expect(insights[0].recommendation).toContain('.js');
  });
});
