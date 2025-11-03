import { readFileSync, appendFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { loadConfig } from '../lib/config.js';
import { ThreadIndexer } from '../lib/thread-indexer.js';
import type { ExecutionTrace, ThreadCitation, ExecutionResult } from '../lib/types.js';

const SUMMARY_PREVIEW_LEN = 60;

interface CaptureOptions {
  bead: string;
  desc?: string;
  exec?: string;
  discovered?: string;
  outcome?: 'success' | 'failure' | 'partial';
  threadRefs?: string;
  threadSummary?: string;
  threadCitations?: string;
  json?: boolean;
}

/**
 * Parse thread reference from ID or URL
 * Supports formats:
 * - T-xxx... (direct thread ID)
 * - https://ampcode.com/threads/T-xxx... (full URL)
 */
function parseThreadRef(ref: string): string {
  const trimmed = ref.trim();
  
  // Extract thread ID from URL
  const urlMatch = trimmed.match(/threads\/(T-[\w-]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  // Validate direct thread ID format
  if (/^T-[\w-]+$/i.test(trimmed)) {
    return trimmed;
  }
  
  throw new Error(`Invalid thread reference: ${ref}. Expected thread ID (T-xxx...) or URL.`);
}

function parseExecutions(execPath?: string): ExecutionResult[] {
  if (!execPath) {
    return [];
  }

  try {
    const content = execPath === '-' 
      ? readFileSync(0, 'utf-8')
      : readFileSync(execPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse execution JSON: ${errMsg}`);
  }
}

function parseDiscoveredIssues(discovered?: string): string[] {
  return discovered ? discovered.split(',').map(s => s.trim()) : [];
}

function parseThreadRefs(threadRefs?: string): string[] | undefined {
  return threadRefs
    ? threadRefs.split(',').map(ref => parseThreadRef(ref))
    : undefined;
}

function parseThreadCitations(citationsJson?: string): ThreadCitation[] | undefined {
  if (!citationsJson) {
    return undefined;
  }

  try {
    return JSON.parse(citationsJson);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse thread citations JSON: ${errMsg}`);
  }
}

function createTrace(options: CaptureOptions, parsedData: {
  executions: ExecutionResult[];
  discoveredIssues: string[];
  threadRefs?: string[];
  threadCitations?: ThreadCitation[];
}): ExecutionTrace {
  return {
    trace_id: randomUUID(),
    timestamp: new Date().toISOString(),
    bead_id: options.bead,
    task_description: options.desc || options.bead,
    execution_results: parsedData.executions,
    discovered_issues: parsedData.discoveredIssues,
    outcome: options.outcome || 'success',
    ...(parsedData.threadRefs && { thread_refs: parsedData.threadRefs }),
    ...(options.threadSummary && { thread_summary: options.threadSummary }),
    ...(parsedData.threadCitations && { thread_citations: parsedData.threadCitations })
  };
}

function outputTrace(trace: ExecutionTrace, options: CaptureOptions, tracesPath: string): void {
  if (options.json) {
    console.log(JSON.stringify({
      traceId: trace.trace_id,
      timestamp: trace.timestamp,
      written: true,
      executionCount: trace.execution_results.length,
      discoveredCount: trace.discovered_issues.length,
      threadRefsCount: trace.thread_refs?.length || 0,
      threadCitationsCount: trace.thread_citations?.length || 0
    }, null, 2));
  } else {
    console.log(`✅ Trace captured: ${trace.trace_id}`);
    console.log(`   Bead: ${trace.bead_id}`);
    console.log(`   Executions: ${trace.execution_results.length}`);
    console.log(`   Discovered: ${trace.discovered_issues.length}`);
    if (trace.thread_refs && trace.thread_refs.length > 0) {
      console.log(`   Thread refs: ${trace.thread_refs.length}`);
    }
    if (options.threadSummary) {
      const preview = options.threadSummary.substring(0, SUMMARY_PREVIEW_LEN);
      const suffix = options.threadSummary.length > SUMMARY_PREVIEW_LEN ? '...' : '';
      console.log(`   Thread context: ${preview}${suffix}`);
    }
    console.log(`   Outcome: ${trace.outcome}`);
    console.log(`   Saved to: ${tracesPath}`);
  }
}

export async function captureCommand(options: CaptureOptions): Promise<void> {
  const config = loadConfig();
  
  const executions = parseExecutions(options.exec);
  const discoveredIssues = parseDiscoveredIssues(options.discovered);
  const threadRefs = parseThreadRefs(options.threadRefs);
  const threadCitations = parseThreadCitations(options.threadCitations);
  
  const trace = createTrace(options, {
    executions,
    discoveredIssues,
    threadRefs,
    threadCitations
  });
  
  appendFileSync(config.tracesPath, JSON.stringify(trace) + '\n', 'utf-8');
  
  if (threadRefs && threadRefs.length > 0) {
    const indexer = new ThreadIndexer();
    for (const threadId of threadRefs) {
      await indexer.indexThread({
        threadId,
        beadId: options.bead,
        ampMetadata: process.env.AMP_THREAD_ID ? {
          thread_url: `https://ampcode.com/threads/${threadId}`,
          workspace_id: process.env.AMP_WORKSPACE_ID,
          created_by_agent: process.env.ACE_ROLE,
          created_in_context: process.env.AMP_MAIN_THREAD_ID ? 'subagent-thread' : 'main-thread',
          main_thread_id: process.env.AMP_MAIN_THREAD_ID,
          parent_thread_id: process.env.AMP_PARENT_THREAD_ID,
        } : undefined,
      });
    }
  }
  
  outputTrace(trace, options, config.tracesPath);
}
