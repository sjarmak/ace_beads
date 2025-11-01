import { readFileSync, appendFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { loadConfig } from '../lib/config.js';
import type { ExecutionResult } from '../lib/types.js';

interface CaptureOptions {
  bead: string;
  desc?: string;
  exec?: string;
  discovered?: string;
  outcome?: 'success' | 'failure' | 'partial';
  json?: boolean;
}

interface ExecutionTrace {
  trace_id: string;
  timestamp: string;
  bead_id: string;
  task_description: string;
  execution_results: ExecutionResult[];
  discovered_issues: string[];
  outcome: 'success' | 'failure' | 'partial';
}

export async function captureCommand(options: CaptureOptions): Promise<void> {
  const config = loadConfig();
  
  // Parse executions
  let executions: ExecutionResult[] = [];
  if (options.exec) {
    try {
      const content = options.exec === '-' 
        ? readFileSync(0, 'utf-8')  // stdin
        : readFileSync(options.exec, 'utf-8');
      executions = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse execution JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Parse discovered issues
  const discoveredIssues = options.discovered 
    ? options.discovered.split(',').map(s => s.trim())
    : [];
  
  // Create trace
  const trace: ExecutionTrace = {
    trace_id: randomUUID(),
    timestamp: new Date().toISOString(),
    bead_id: options.bead,
    task_description: options.desc || options.bead,
    execution_results: executions,
    discovered_issues: discoveredIssues,
    outcome: options.outcome || 'success'
  };
  
  // Write to traces file
  appendFileSync(config.tracesPath, JSON.stringify(trace) + '\n', 'utf-8');
  
  // Output result
  if (options.json) {
    console.log(JSON.stringify({
      traceId: trace.trace_id,
      timestamp: trace.timestamp,
      written: true,
      executionCount: executions.length,
      discoveredCount: discoveredIssues.length
    }, null, 2));
  } else {
    console.log(`✅ Trace captured: ${trace.trace_id}`);
    console.log(`   Bead: ${trace.bead_id}`);
    console.log(`   Executions: ${executions.length}`);
    console.log(`   Discovered: ${discoveredIssues.length}`);
    console.log(`   Outcome: ${trace.outcome}`);
    console.log(`   Saved to: ${config.tracesPath}`);
  }
}
