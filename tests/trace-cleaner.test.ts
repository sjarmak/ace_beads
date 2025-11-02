import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TraceCleaner } from '../src/lib/trace-cleaner.js';
import { writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ACEConfig } from '../src/lib/mcp-types.js';

describe('TraceCleaner', () => {
  const testDir = join(process.cwd(), 'test-temp-trace-cleaner');
  const testTracesPath = join(testDir, 'execution_traces.jsonl');
  const testArchivePath = join(testDir, 'archive', 'execution_traces.archive.jsonl');

  const mockConfig: ACEConfig = {
    agentsPath: join(testDir, 'AGENTS.md'),
    logsDir: testDir,
    insightsPath: join(testDir, 'insights.jsonl'),
    tracesPath: testTracesPath,
    maxDeltas: 3,
    defaultConfidence: 0.8,
    traceRetention: {
      maxTracesPerBead: 5,
      maxAgeInDays: 7,
      archivePath: testArchivePath,
    },
  };

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should keep traces within retention limits', async () => {
    // Create 10 traces for one bead, all older than 7 days
    // This ensures they exceed maxTracesPerBead (5) and are outside age limit
    const now = new Date();
    const traces = [];
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - (10 + i) * 24 * 60 * 60 * 1000); // 10+ days ago
      traces.push({
        trace_id: `trace-${i}`,
        timestamp: timestamp.toISOString(),
        bead_id: 'bead-1',
        task_description: `Task ${i}`,
        execution_results: [],
        discovered_issues: [],
        outcome: 'success',
      });
    }

    writeFileSync(testTracesPath, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

    const cleaner = new TraceCleaner(mockConfig);
    const result = await cleaner.cleanupTraces();

    expect(result.tracesKept).toBe(5);
    expect(result.tracesArchived).toBe(5);

    // Verify archive exists
    expect(existsSync(testArchivePath)).toBe(true);

    // Verify kept traces are the most recent ones
    const keptContent = readFileSync(testTracesPath, 'utf-8');
    const keptTraces = keptContent.trim().split('\n').map(line => JSON.parse(line));
    expect(keptTraces).toHaveLength(5);
    expect(keptTraces[0].trace_id).toBe('trace-4'); // Oldest of the kept
    expect(keptTraces[4].trace_id).toBe('trace-0'); // Most recent
  });

  it('should keep traces from multiple beads separately', async () => {
    const now = new Date();
    const traces = [];
    
    // 8 traces for bead-1, all old (keep 5, archive 3)
    for (let i = 0; i < 8; i++) {
      traces.push({
        trace_id: `bead1-trace-${i}`,
        timestamp: new Date(now.getTime() - (10 + i) * 24 * 60 * 60 * 1000).toISOString(),
        bead_id: 'bead-1',
        task_description: `Task ${i}`,
        execution_results: [],
        discovered_issues: [],
        outcome: 'success',
      });
    }

    // 3 traces for bead-2, all old (keep all 3)
    for (let i = 0; i < 3; i++) {
      traces.push({
        trace_id: `bead2-trace-${i}`,
        timestamp: new Date(now.getTime() - (10 + i) * 24 * 60 * 60 * 1000).toISOString(),
        bead_id: 'bead-2',
        task_description: `Task ${i}`,
        execution_results: [],
        discovered_issues: [],
        outcome: 'success',
      });
    }

    writeFileSync(testTracesPath, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

    const cleaner = new TraceCleaner(mockConfig);
    const result = await cleaner.cleanupTraces();

    expect(result.tracesKept).toBe(8); // 5 from bead-1, 3 from bead-2
    expect(result.tracesArchived).toBe(3); // 3 from bead-1
  });

  it('should keep traces within age limit even if exceeding count', async () => {
    const now = new Date();
    const traces = [];
    
    // Create 10 traces for one bead, all within age limit
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000); // 1 hour apart
      traces.push({
        trace_id: `trace-${i}`,
        timestamp: timestamp.toISOString(),
        bead_id: 'bead-1',
        task_description: `Task ${i}`,
        execution_results: [],
        discovered_issues: [],
        outcome: 'success',
      });
    }

    writeFileSync(testTracesPath, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

    const cleaner = new TraceCleaner(mockConfig);
    const result = await cleaner.cleanupTraces();

    // All traces are within 7 days, so all should be kept despite exceeding count limit
    expect(result.tracesKept).toBe(10);
    expect(result.tracesArchived).toBe(0);
  });

  it('should archive traces older than age limit', async () => {
    const now = new Date();
    const traces = [];
    
    // 5 recent traces (within 7 days)
    for (let i = 0; i < 5; i++) {
      const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000); // 1 day apart
      traces.push({
        trace_id: `recent-${i}`,
        timestamp: timestamp.toISOString(),
        bead_id: 'bead-1',
        task_description: `Recent task ${i}`,
        execution_results: [],
        discovered_issues: [],
        outcome: 'success',
      });
    }

    // 5 old traces (older than 7 days)
    for (let i = 0; i < 5; i++) {
      const timestamp = new Date(now.getTime() - (10 + i) * 24 * 60 * 60 * 1000); // 10+ days ago
      traces.push({
        trace_id: `old-${i}`,
        timestamp: timestamp.toISOString(),
        bead_id: 'bead-1',
        task_description: `Old task ${i}`,
        execution_results: [],
        discovered_issues: [],
        outcome: 'success',
      });
    }

    writeFileSync(testTracesPath, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

    const cleaner = new TraceCleaner(mockConfig);
    const result = await cleaner.cleanupTraces();

    expect(result.tracesKept).toBe(5); // Only recent ones
    expect(result.tracesArchived).toBe(5); // Old ones archived

    // Verify kept traces are all recent
    const keptContent = readFileSync(testTracesPath, 'utf-8');
    const keptTraces = keptContent.trim().split('\n').map(line => JSON.parse(line));
    expect(keptTraces.every(t => t.trace_id.startsWith('recent-'))).toBe(true);
  });

  it('should handle empty trace file', async () => {
    writeFileSync(testTracesPath, '', 'utf-8');

    const cleaner = new TraceCleaner(mockConfig);
    const result = await cleaner.cleanupTraces();

    expect(result.tracesKept).toBe(0);
    expect(result.tracesArchived).toBe(0);
  });

  it('should handle missing trace file', async () => {
    const cleaner = new TraceCleaner(mockConfig);
    const result = await cleaner.cleanupTraces();

    expect(result.tracesKept).toBe(0);
    expect(result.tracesArchived).toBe(0);
  });

  it('should preserve trace order chronologically after cleanup', async () => {
    const now = new Date();
    const traces = [];
    
    // Create traces in random order
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 1000).toISOString();
      traces.push({
        trace_id: `trace-${i}`,
        timestamp,
        bead_id: 'bead-1',
        task_description: `Task ${i}`,
        execution_results: [],
        discovered_issues: [],
        outcome: 'success',
      });
    }

    // Shuffle traces
    traces.sort(() => Math.random() - 0.5);
    writeFileSync(testTracesPath, traces.map(t => JSON.stringify(t)).join('\n') + '\n');

    const cleaner = new TraceCleaner(mockConfig);
    await cleaner.cleanupTraces();

    // Read kept traces
    const keptContent = readFileSync(testTracesPath, 'utf-8');
    const keptTraces = keptContent.trim().split('\n').map(line => JSON.parse(line));

    // Verify they're in chronological order (oldest first)
    for (let i = 1; i < keptTraces.length; i++) {
      const prev = new Date(keptTraces[i - 1].timestamp);
      const curr = new Date(keptTraces[i].timestamp);
      expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
    }
  });
});
