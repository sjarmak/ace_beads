import { readFileSync, existsSync } from 'fs';
import { loadConfig } from '../lib/config.js';

interface ThreadReportOptions {
  json?: boolean;
  limit?: number;
}

interface ThreadAggregation {
  thread_id: string;
  trace_count: number;
  bead_count: number;
  success_count: number;
  failure_count: number;
  partial_count: number;
  avg_execution_time: number;
  last_activity: string;
  top_patterns: string[];
  thread_summary?: string;
}

export async function threadReportCommand(options: ThreadReportOptions): Promise<void> {
  const config = loadConfig();
  const limit = options.limit || 10;

  if (!existsSync(config.tracesPath)) {
    if (options.json) {
      console.log(JSON.stringify({ threads: [] }, null, 2));
    } else {
      console.log('No traces found. Run `ace capture` to create traces.');
    }
    return;
  }

  // Load all traces
  const content = readFileSync(config.tracesPath, 'utf-8');
  const traces = content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line))
    .filter(trace => trace.thread_refs && trace.thread_refs.length > 0);

  // Aggregate by thread
  const threadMap = new Map<string, ThreadAggregation>();

  for (const trace of traces) {
    for (const threadId of trace.thread_refs) {
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, {
          thread_id: threadId,
          trace_count: 0,
          bead_count: 0,
          success_count: 0,
          failure_count: 0,
          partial_count: 0,
          avg_execution_time: 0,
          last_activity: trace.timestamp,
          top_patterns: [],
          thread_summary: trace.thread_summary
        });
      }

      const agg = threadMap.get(threadId)!;
      agg.trace_count++;

      // Track unique beads
      const uniqueBeads = new Set([trace.bead_id]);

      // Update outcome counts
      if (trace.outcome === 'success') agg.success_count++;
      else if (trace.outcome === 'failure') agg.failure_count++;
      else if (trace.outcome === 'partial') agg.partial_count++;

      // Calculate execution time
      const execTime = trace.execution_results.reduce((sum: number, exec: any) =>
        sum + (exec.duration || 0), 0);
      agg.avg_execution_time = (agg.avg_execution_time * (agg.trace_count - 1) + execTime) / agg.trace_count;

      // Update last activity
      if (trace.timestamp > agg.last_activity) {
        agg.last_activity = trace.timestamp;
      }

      // Update thread summary if not set
      if (!agg.thread_summary && trace.thread_summary) {
        agg.thread_summary = trace.thread_summary;
      }
    }
  }

  // Convert to array and sort by activity
  let threads = Array.from(threadMap.values())
    .sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime())
    .slice(0, limit);

  // Calculate top patterns for each thread (simplified - could be enhanced)
  for (const thread of threads) {
    const threadTraces = traces.filter(t => t.thread_refs.includes(thread.thread_id));
    const patterns = new Map<string, number>();

    for (const trace of threadTraces) {
      for (const exec of trace.execution_results) {
        if (exec.errors) {
          for (const error of exec.errors) {
            const pattern = `${exec.runner}: ${error.message.split(':')[0]}`;
            patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
          }
        }
      }
    }

    thread.top_patterns = Array.from(patterns.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([pattern]) => pattern);
  }

  if (options.json) {
    console.log(JSON.stringify({
      threads,
      total_threads: threadMap.size,
      shown: threads.length
    }, null, 2));
  } else {
    console.log(`\n🧵 Thread-based Aggregation Report\n`);
    console.log(`Total threads: ${threadMap.size}, Showing: ${threads.length}\n`);

    for (const thread of threads) {
      const successRate = thread.trace_count > 0
        ? ((thread.success_count / thread.trace_count) * 100).toFixed(1)
        : '0.0';

      console.log(`Thread: ${thread.thread_id}`);
      console.log(`  Traces: ${thread.trace_count} (${successRate}% success)`);
      console.log(`  Outcomes: ✅${thread.success_count} ❌${thread.failure_count} ⚠️${thread.partial_count}`);
      console.log(`  Avg Exec Time: ${thread.avg_execution_time.toFixed(1)}ms`);
      console.log(`  Last Activity: ${new Date(thread.last_activity).toLocaleString()}`);

      if (thread.thread_summary) {
        console.log(`  Summary: ${thread.thread_summary.substring(0, 60)}${thread.thread_summary.length > 60 ? '...' : ''}`);
      }

      if (thread.top_patterns.length > 0) {
        console.log(`  Top Patterns: ${thread.top_patterns.join(', ')}`);
      }

      console.log('');
    }

    console.log(`💡 Use \`ace trace list --threads <thread_id>\` to view traces for a specific thread
`);
  }
}
