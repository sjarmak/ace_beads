import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { ACEConfig } from './mcp-types.js';

export interface ExecutionTrace {
  trace_id: string;
  timestamp: string;
  bead_id: string;
  task_description: string;
  execution_results: any[];
  discovered_issues: string[];
  outcome: string;
  [key: string]: any;
}

export interface CleanupResult {
  tracesArchived: number;
  tracesKept: number;
  insightsArchived: number;
  insightsKept: number;
}

export class TraceCleaner {
  private config: ACEConfig;

  constructor(config: ACEConfig) {
    this.config = config;
  }

  /**
   * Clean up old traces based on retention policy
   * Keeps the most recent N traces per bead and traces newer than M days
   */
  async cleanupTraces(): Promise<CleanupResult> {
    const result: CleanupResult = {
      tracesArchived: 0,
      tracesKept: 0,
      insightsArchived: 0,
      insightsKept: 0,
    };

    // Clean execution traces
    if (existsSync(this.config.tracesPath)) {
      const traceResult = await this.cleanupFile(
        this.config.tracesPath,
        this.config.traceRetention?.archivePath || 'logs/archive/execution_traces.archive.jsonl',
        this.config.traceRetention?.maxTracesPerBead || 10,
        this.config.traceRetention?.maxAgeInDays || 30
      );
      result.tracesArchived = traceResult.archived;
      result.tracesKept = traceResult.kept;
    }

    // Clean insights (similar policy)
    if (existsSync(this.config.insightsPath)) {
      const insightArchivePath = this.config.insightsPath.replace('.jsonl', '.archive.jsonl');
      const insightResult = await this.cleanupFile(
        this.config.insightsPath,
        insightArchivePath,
        this.config.traceRetention?.maxTracesPerBead || 10,
        this.config.traceRetention?.maxAgeInDays || 30
      );
      result.insightsArchived = insightResult.archived;
      result.insightsKept = insightResult.kept;
    }

    return result;
  }

  private async cleanupFile(
    filePath: string,
    archivePath: string,
    maxTracesPerBead: number,
    maxAgeInDays: number
  ): Promise<{ archived: number; kept: number }> {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);
    
    if (lines.length === 0) {
      return { archived: 0, kept: 0 };
    }

    const traces: ExecutionTrace[] = lines.map(line => JSON.parse(line));
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - maxAgeInDays * 24 * 60 * 60 * 1000);

    // Group traces by bead_id
    const tracesByBead = new Map<string, ExecutionTrace[]>();
    for (const trace of traces) {
      const beadId = trace.bead_id || 'unknown';
      if (!tracesByBead.has(beadId)) {
        tracesByBead.set(beadId, []);
      }
      tracesByBead.get(beadId)!.push(trace);
    }

    const toKeep: ExecutionTrace[] = [];
    const toArchive: ExecutionTrace[] = [];

    // For each bead, keep only the most recent N traces and those within age limit
    for (const [beadId, beadTraces] of tracesByBead) {
      // Sort by timestamp descending (newest first)
      beadTraces.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      for (let i = 0; i < beadTraces.length; i++) {
        const trace = beadTraces[i];
        const traceDate = new Date(trace.timestamp);
        
        // Keep if: within top N for this bead OR within age limit
        if (i < maxTracesPerBead || traceDate >= cutoffDate) {
          toKeep.push(trace);
        } else {
          toArchive.push(trace);
        }
      }
    }

    // Archive old traces if any
    if (toArchive.length > 0) {
      this.archiveTraces(toArchive, archivePath);
    }

    // Write back only traces to keep
    if (toKeep.length > 0) {
      // Sort by timestamp ascending for chronological order
      toKeep.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const newContent = toKeep.map(t => JSON.stringify(t)).join('\n') + '\n';
      writeFileSync(filePath, newContent, 'utf-8');
    } else {
      // If nothing to keep, write empty file
      writeFileSync(filePath, '', 'utf-8');
    }

    return { archived: toArchive.length, kept: toKeep.length };
  }

  private archiveTraces(traces: ExecutionTrace[], archivePath: string): void {
    // Ensure archive directory exists
    const archiveDir = dirname(archivePath);
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true });
    }

    // Add header if archive is new
    if (!existsSync(archivePath)) {
      const header = `# Archived Execution Traces\n# Archived at: ${new Date().toISOString()}\n\n`;
      writeFileSync(archivePath, header, 'utf-8');
    }

    // Append archived traces
    for (const trace of traces) {
      appendFileSync(archivePath, JSON.stringify(trace) + '\n', 'utf-8');
    }

    console.log(`[TraceCleaner] Archived ${traces.length} traces to ${archivePath}`);
  }
}
