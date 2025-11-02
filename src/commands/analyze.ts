import { readFileSync, appendFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { loadConfig } from '../lib/config.js';
import type { ExecutionTrace } from '../lib/mcp-types.js';

interface AnalyzeOptions {
  mode: 'single' | 'batch';
  trace?: string;
  beads?: string;
  minConfidence?: number;
  minFrequency?: number;
  dryRun?: boolean;
  json?: boolean;
}

interface Insight {
  id: string;
  timestamp: string;
  taskId: string;
  source: {
    runner?: string;
    beadIds: string[];
  };
  signal: {
    pattern: string;
    evidence: string[];
  };
  recommendation: string;
  scope: {
    files?: string[];
    glob?: string;
  };
  confidence: number;
  onlineEligible: boolean;
  metaTags: string[];
  thread_refs?: string[];
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const config = loadConfig();
  
  if (!existsSync(config.tracesPath)) {
    throw new Error(`Traces file not found: ${config.tracesPath}`);
  }
  
  // Load traces
  const tracesContent = readFileSync(config.tracesPath, 'utf-8');
  const allTraces = tracesContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  let tracesToAnalyze = allTraces;
  
  // Filter by mode
  if (options.mode === 'single') {
    if (!options.trace) {
      throw new Error('--trace <id> required for single mode');
    }
    tracesToAnalyze = allTraces.filter(t => t.trace_id === options.trace);
    if (tracesToAnalyze.length === 0) {
      throw new Error(`Trace not found: ${options.trace}`);
    }
  } else if (options.mode === 'batch' && options.beads) {
    const beadIds = options.beads.split(',').map(s => s.trim());
    tracesToAnalyze = allTraces.filter(t => beadIds.includes(t.bead_id));
  }
  
  // Analyze traces and generate insights
  const insights: Insight[] = [];

  // Group traces by thread context for enhanced pattern analysis
  const tracesByThread = new Map<string, ExecutionTrace[]>();
  const threadlessTraces: ExecutionTrace[] = [];

  for (const trace of tracesToAnalyze) {
  if (trace.thread_refs && trace.thread_refs.length > 0) {
  // Use the first thread ref as the primary thread context
  const threadId = trace.thread_refs[0];
  if (!tracesByThread.has(threadId)) {
    tracesByThread.set(threadId, []);
  }
  tracesByThread.get(threadId)!.push(trace);
  } else {
  threadlessTraces.push(trace);
  }
  }

  // Analyze traces within thread context
  for (const [threadId, threadTraces] of tracesByThread) {
  const threadInsights = analyzeTracesInContext(threadTraces, threadId, 'thread');
  insights.push(...threadInsights);
  }

  // Analyze threadless traces
  const generalInsights = analyzeTracesInContext(threadlessTraces, undefined, 'general');
  insights.push(...generalInsights);

  // Also analyze all traces together for cross-thread patterns
  if (tracesByThread.size > 1) {
  const crossThreadInsights = analyzeCrossThreadPatterns(tracesToAnalyze);
  insights.push(...crossThreadInsights);
  }
  
  // Write insights
  if (!options.dryRun && insights.length > 0) {
    for (const insight of insights) {
      appendFileSync(config.insightsPath, JSON.stringify(insight) + '\n', 'utf-8');
    }
  }
  
  // Output
  if (options.json) {
    console.log(JSON.stringify({
      insights,
      tracesAnalyzed: tracesToAnalyze.length,
      written: !options.dryRun
    }, null, 2));
  } else {
    console.log(`✅ Analysis complete`);
    console.log(`   Traces analyzed: ${tracesToAnalyze.length}`);
    console.log(`   Insights generated: ${insights.length}`);
    if (!options.dryRun) {
      console.log(`   Saved to: ${config.insightsPath}`);
    } else {
      console.log(`   (Dry run - not saved)`);
    }
    
    if (insights.length > 0) {
      console.log(`\n📊 Top insights:`);
      insights.slice(0, 3).forEach(i => {
        console.log(`   • ${i.signal.pattern} (confidence: ${i.confidence.toFixed(2)})`);
      });
    }
  }
}

function inferPattern(error: any): string {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('explicit file extensions') || (msg.includes('relative import') && msg.includes('.js'))) {
    return 'TypeScript ESM import missing .js extension';
  }
  if (msg.includes('cannot find module') && msg.includes('.js')) {
    return 'TypeScript ESM import missing .js extension';
  }
  if (msg.includes('cannot find module')) {
    return 'Module not found';
  }
  if (msg.includes('type') && msg.includes('not assignable')) {
    return 'Type mismatch';
  }
  if (msg.includes('undefined') || msg.includes('null')) {
    return 'Null/undefined reference';
  }
  
  return 'Generic error pattern';
}

function calculateConfidence(errors: any[], totalTraces: number): number {
  // Simple confidence: more errors = higher confidence
  // Start with higher base to ensure single errors can pass default threshold
  const base = Math.min(errors.length / 2, 0.7);
  const frequency = Math.min(errors.length / totalTraces, 0.3);
  return Math.min(base + frequency, 1.0);
}

function generateRecommendation(pattern: string, error: any): string {
  if (pattern.includes('ESM import missing .js')) {
    return 'Always use .js extensions in import statements for TypeScript files when using ESM module resolution';
  }
  if (pattern.includes('Module not found')) {
    return `Verify the module exists and the import path is correct: ${error.message}`;
  }
  return `Address the error pattern: ${pattern}`;
}

function inferGlob(files: string[]): string {
  if (files.every(f => f.endsWith('.ts'))) return '**/*.ts';
  if (files.every(f => f.endsWith('.tsx'))) return '**/*.tsx';
  return '**/*';
}

function inferTags(runner: string, error: any): string[] {
  const tags = [runner];

  if (error.message.includes('module')) tags.push('import', 'module');
  if (error.message.includes('type')) tags.push('type-error');
  if (runner === 'tsc') tags.push('typescript', 'build');
  if (runner === 'vitest') tags.push('test');
  if (runner === 'eslint') tags.push('lint');

  return tags;
}

function analyzeTracesInContext(traces: ExecutionTrace[], contextId: string | undefined, contextType: 'thread' | 'general'): Insight[] {
  const insights: Insight[] = [];

  for (const trace of traces) {
    // Skip successful traces
    if (trace.outcome === 'success') continue;

    // Analyze each execution result
    for (const exec of trace.execution_results || []) {
      // Broaden failure detection to handle various status formats
      const status = (exec.status || '').toLowerCase();
      const failStatuses = new Set(['fail', 'failed', 'error']);

      if (failStatuses.has(status) && exec.errors?.length) {
        // Group errors by pattern
        const errorsByPattern = new Map<string, any[]>();

        for (const error of exec.errors) {
          const pattern = inferPattern(error);
          if (!errorsByPattern.has(pattern)) {
            errorsByPattern.set(pattern, []);
          }
          errorsByPattern.get(pattern)!.push(error);
        }

        // Create insights for each pattern
        for (const [pattern, errors] of errorsByPattern) {
          const confidence = calculateConfidence(errors, traces.length);

          // Boost confidence for thread-specific patterns
          let adjustedConfidence = confidence;
          if (contextType === 'thread') {
            // Thread-specific patterns get higher confidence
            adjustedConfidence = Math.min(confidence * 1.2, 1.0);
          }

          const insight: Insight = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            taskId: trace.bead_id,
            source: {
              runner: exec.runner,
              beadIds: [trace.bead_id]
            },
            signal: {
              pattern: contextType === 'thread' ? `${pattern} (Thread: ${contextId})` : pattern,
              evidence: errors.map(e => `${e.file}:${e.line}: ${e.message}`)
            },
            recommendation: generateRecommendation(pattern, errors[0]),
            scope: {
              files: errors.map(e => e.file),
              glob: inferGlob(errors.map(e => e.file))
            },
            confidence: adjustedConfidence,
            onlineEligible: true, // Let Curator decide based on confidence
            metaTags: [...inferTags(exec.runner || 'unknown', errors[0]), contextType === 'thread' ? 'thread-specific' : 'general'],
            thread_refs: trace.thread_refs
          };

          insights.push(insight);
        }
      }
    }
  }

  return insights;
}

function analyzeCrossThreadPatterns(allTraces: ExecutionTrace[]): Insight[] {
  const insights: Insight[] = [];

  // Look for patterns that occur across multiple threads
  const errorsByPattern = new Map<string, { errors: any[], threads: Set<string>, traces: ExecutionTrace[] }>();

  for (const trace of allTraces) {
    if (trace.outcome === 'success' || !trace.thread_refs) continue;

    for (const exec of trace.execution_results || []) {
      const status = (exec.status || '').toLowerCase();
      const failStatuses = new Set(['fail', 'failed', 'error']);

      if (failStatuses.has(status) && exec.errors?.length) {
        for (const error of exec.errors) {
          const pattern = inferPattern(error);

          if (!errorsByPattern.has(pattern)) {
            errorsByPattern.set(pattern, { errors: [], threads: new Set(), traces: [] });
          }

          const patternData = errorsByPattern.get(pattern)!;
          patternData.errors.push(error);
          trace.thread_refs.forEach(tr => patternData.threads.add(tr));
          patternData.traces.push(trace);
        }
      }
    }
  }

  // Create insights for cross-thread patterns
  for (const [pattern, data] of errorsByPattern) {
    if (data.threads.size > 1) { // Only if pattern spans multiple threads
      const confidence = calculateConfidence(data.errors, allTraces.length) * 1.5; // Boost cross-thread patterns

      const insight: Insight = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        taskId: 'cross-thread-analysis',
        source: {
          runner: 'cross-thread',
          beadIds: data.traces.map(t => t.bead_id)
        },
        signal: {
          pattern: `${pattern} (Cross-thread pattern across ${data.threads.size} threads)`,
          evidence: data.errors.map(e => `${e.file}:${e.line}: ${e.message}`)
        },
        recommendation: `Address ${pattern} - this pattern appears across multiple threads, indicating a systemic issue`,
        scope: {
          files: data.errors.map(e => e.file),
          glob: inferGlob(data.errors.map(e => e.file))
        },
        confidence: Math.min(confidence, 1.0),
        onlineEligible: true,
        metaTags: ['cross-thread', 'systemic-issue'],
        thread_refs: Array.from(data.threads)
      };

      insights.push(insight);
    }
  }

  return insights;
}
