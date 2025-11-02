import { readFileSync, appendFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { loadConfig } from '../lib/config.js';
import type { ExecutionResult } from '../lib/mcp-types.js';

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

interface ThreadCitation {
  thread_id: string;
  message_id?: string;
  quote: string;
  rationale: string;
}

interface ExecutionTrace {
  trace_id: string;
  timestamp: string;
  bead_id: string;
  task_description: string;
  execution_results: ExecutionResult[];
  discovered_issues: string[];
  outcome: 'success' | 'failure' | 'partial';
  thread_refs?: string[];
  thread_summary?: string;
  thread_citations?: ThreadCitation[];
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
  
  // Parse thread references
  const threadRefs = options.threadRefs
    ? options.threadRefs.split(',').map(ref => parseThreadRef(ref))
    : undefined;
  
  // Parse thread citations
  let threadCitations: ThreadCitation[] | undefined;
  if (options.threadCitations) {
    try {
      threadCitations = JSON.parse(options.threadCitations);
    } catch (error) {
      throw new Error(`Failed to parse thread citations JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Create trace
  const trace: ExecutionTrace = {
    trace_id: randomUUID(),
    timestamp: new Date().toISOString(),
    bead_id: options.bead,
    task_description: options.desc || options.bead,
    execution_results: executions,
    discovered_issues: discoveredIssues,
    outcome: options.outcome || 'success',
    ...(threadRefs && { thread_refs: threadRefs }),
    ...(options.threadSummary && { thread_summary: options.threadSummary }),
    ...(threadCitations && { thread_citations: threadCitations })
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
      discoveredCount: discoveredIssues.length,
      threadRefsCount: threadRefs?.length || 0,
      threadCitationsCount: threadCitations?.length || 0
    }, null, 2));
  } else {
    console.log(`✅ Trace captured: ${trace.trace_id}`);
    console.log(`   Bead: ${trace.bead_id}`);
    console.log(`   Executions: ${executions.length}`);
    console.log(`   Discovered: ${discoveredIssues.length}`);
    if (threadRefs && threadRefs.length > 0) {
      console.log(`   Thread refs: ${threadRefs.length}`);
    }
    if (options.threadSummary) {
      console.log(`   Thread context: ${options.threadSummary.substring(0, 60)}${options.threadSummary.length > 60 ? '...' : ''}`);
    }
    console.log(`   Outcome: ${trace.outcome}`);
    console.log(`   Saved to: ${config.tracesPath}`);
  }
}
