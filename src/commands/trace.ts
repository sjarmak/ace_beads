import { openSync, fstatSync, readSync, closeSync } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { loadConfig } from '../lib/config.js';
import type { ExecutionResult } from '../lib/mcp-types.js';

interface ExecutionTrace {
  trace_id: string;
  timestamp: string;
  bead_id: string;
  task_description: string;
  execution_results: ExecutionResult[];
  discovered_issues: string[];
  outcome: 'success' | 'failure' | 'partial';
}

interface TraceListOptions {
  limit?: number;
  json?: boolean;
  beads?: string[];
}

interface TraceShowOptions {
  json?: boolean;
}

/**
 * Efficiently read the last N lines from a file without loading entire file.
 * Reads backwards from the end of the file.
 */
function readLastLines(filePath: string, maxLines: number): string[] {
  const fd = openSync(filePath, 'r');
  try {
    const stats = fstatSync(fd);
    const fileSize = stats.size;
    
    if (fileSize === 0) {
      return [];
    }
    
    const chunkSize = 4096;
    const lines: string[] = [];
    let remainingText = '';
    let position = fileSize;
    
    while (position > 0 && lines.length < maxLines) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;
      
      const buffer = Buffer.allocUnsafe(readSize);
      readSync(fd, buffer, 0, readSize, position);
      
      const chunk = buffer.toString('utf-8') + remainingText;
      const chunkLines = chunk.split('\n');
      
      remainingText = chunkLines[0];
      
      for (let i = chunkLines.length - 1; i > 0; i--) {
        const line = chunkLines[i].trim();
        if (line) {
          lines.push(line);
          if (lines.length >= maxLines) {
            break;
          }
        }
      }
    }
    
    if (position === 0 && remainingText.trim() && lines.length < maxLines) {
      lines.push(remainingText.trim());
    }
    
    return lines;
  } finally {
    closeSync(fd);
  }
}

export async function traceListCommand(options: TraceListOptions): Promise<void> {
  const config = loadConfig();
  const limitRaw = options.limit ?? 20;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : NaN;
  
  if (!Number.isFinite(limit)) {
    const err: any = new Error(`Invalid --limit ${options.limit}. Must be a positive number.`);
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
  
  let traces: ExecutionTrace[] = [];
  try {
    const lines = readLastLines(config.tracesPath, limit);
    for (const line of lines) {
      try {
        const trace = JSON.parse(line) as ExecutionTrace;
        traces.push(trace);
      } catch {
        // Skip malformed lines
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (options.json) {
        console.log(JSON.stringify({ traces: [] }, null, 2));
      } else {
        console.log('No traces found. Run `ace capture` to create traces.');
      }
      return;
    }
    throw error;
  }
  
  // Filter by bead IDs if specified
  if (options.beads && options.beads.length > 0) {
    const beadSet = new Set(options.beads);
    traces = traces.filter(t => beadSet.has(t.bead_id));
  }
  
  if (options.json) {
    console.log(JSON.stringify({
      traces: traces.map(t => ({
        trace_id: t.trace_id,
        timestamp: t.timestamp,
        bead_id: t.bead_id,
        task_description: t.task_description,
        outcome: t.outcome,
        execution_count: t.execution_results.length,
        discovered_count: t.discovered_issues.length
      })),
      total: traces.length
    }, null, 2));
  } else {
    console.log(`\n📋 Recent Execution Traces (${traces.length} shown):\n`);
    
    for (const trace of traces) {
      const outcomeEmoji = trace.outcome === 'success' ? '✅' : trace.outcome === 'failure' ? '❌' : '⚠️';
      const timestamp = new Date(trace.timestamp).toLocaleString();
      
      console.log(`${outcomeEmoji} ${trace.trace_id}`);
      console.log(`   Bead: ${trace.bead_id}`);
      console.log(`   Task: ${trace.task_description}`);
      console.log(`   Time: ${timestamp}`);
      console.log(`   Outcome: ${trace.outcome}`);
      console.log(`   Executions: ${trace.execution_results.length}, Discovered: ${trace.discovered_issues.length}`);
      console.log('');
    }
    
    console.log(`💡 Use \`ace trace show <trace_id>\` to view full details\n`);
  }
}

/**
 * Stream search for a trace by ID without loading entire file.
 * Stops reading as soon as the trace is found.
 */
async function findTraceById(filePath: string, traceId: string): Promise<ExecutionTrace | undefined> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    
    let found = false;
    
    rl.on('line', (line) => {
      if (found) return;
      
      const trimmed = line.trim();
      if (!trimmed) return;
      
      try {
        const trace = JSON.parse(trimmed) as ExecutionTrace;
        if (trace.trace_id === traceId) {
          found = true;
          rl.close();
          stream.destroy();
          resolve(trace);
        }
      } catch (err) {
        // Skip malformed lines
      }
    });
    
    rl.on('close', () => {
      if (!found) {
        resolve(undefined);
      }
    });
    
    rl.on('error', (err) => {
      reject(err);
    });
    
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

export async function traceShowCommand(traceId: string, options: TraceShowOptions): Promise<void> {
  const config = loadConfig();
  
  let trace: ExecutionTrace | undefined;
  try {
    trace = await findTraceById(config.tracesPath, traceId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const err: any = new Error('Traces file not found. Run `ace capture` to create traces.');
      err.code = 'TRACES_FILE_NOT_FOUND';
      throw err;
    }
    throw error;
  }
  
  if (!trace) {
    const err: any = new Error(`Trace not found: ${traceId}`);
    err.code = 'TRACE_NOT_FOUND';
    throw err;
  }
  
  if (options.json) {
    console.log(JSON.stringify(trace, null, 2));
  } else {
    const outcomeEmoji = trace.outcome === 'success' ? '✅' : trace.outcome === 'failure' ? '❌' : '⚠️';
    const timestamp = new Date(trace.timestamp).toLocaleString();
    
    console.log(`\n${outcomeEmoji} Execution Trace: ${trace.trace_id}\n`);
    console.log(`Bead ID: ${trace.bead_id}`);
    console.log(`Task: ${trace.task_description}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Outcome: ${trace.outcome}`);
    console.log('');
    
    if (trace.discovered_issues.length > 0) {
      console.log(`🔍 Discovered Issues (${trace.discovered_issues.length}):`);
      trace.discovered_issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('');
    }
    
    if (trace.execution_results.length > 0) {
      console.log(`⚙️  Execution Results (${trace.execution_results.length}):\n`);
      
      for (const exec of trace.execution_results) {
        const statusEmoji = exec.status === 'pass' ? '✅' : '❌';
        console.log(`${statusEmoji} ${exec.runner}: ${exec.command}`);
        console.log(`   Status: ${exec.status}`);
        
        if (exec.errors.length > 0) {
          console.log(`   Errors: ${exec.errors.length}`);
          exec.errors.forEach(err => {
            const severityBadge = err.severity === 'error' ? '❌' : err.severity === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`     ${severityBadge} [${err.tool}] ${err.file}:${err.line}${err.column ? `:${err.column}` : ''}`);
            console.log(`        ${err.message}`);
          });
        }
        console.log('');
      }
    } else {
      console.log('No execution results recorded.\n');
    }
  }
}
