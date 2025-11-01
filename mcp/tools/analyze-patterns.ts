import { Reflector } from '../../agents/Reflector.js';
import { Insight } from '../types.js';
import { ExecutionTrace } from '../../agents/Generator.js';
import { readFile } from 'fs/promises';

export interface AnalyzePatternsParams {
  mode: 'single' | 'batch';
  traceId?: string;
  beadIds?: string[];
  minConfidence?: number;
  minFrequency?: number;
}

export interface AnalyzePatternsResult {
  insights: Array<{
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
  }>;
  tracesAnalyzed: number;
  written: boolean;
}

export interface AnalyzePatternsError {
  error: {
    code: 'INVALID_PARAMS' | 'TRACE_NOT_FOUND' | 'FILE_NOT_FOUND' | 'PARSE_ERROR';
    message: string;
    details?: unknown;
  };
}

export async function analyzePatterns(
  params: AnalyzePatternsParams
): Promise<AnalyzePatternsResult | AnalyzePatternsError> {
  try {
    // Validate parameters
    if (!params.mode) {
      return {
        error: {
          code: 'INVALID_PARAMS',
          message: 'Parameter "mode" is required',
        },
      };
    }

    if (params.mode === 'single' && !params.traceId) {
      return {
        error: {
          code: 'INVALID_PARAMS',
          message: 'Parameter "traceId" is required for single mode',
        },
      };
    }

    if (params.mode === 'batch' && params.beadIds && params.beadIds.length === 0) {
      return {
        error: {
          code: 'INVALID_PARAMS',
          message: 'Parameter "beadIds" must contain at least one bead ID in batch mode',
        },
      };
    }

    // Initialize Reflector with default paths
    const reflector = new Reflector();

    let insights: Insight[] = [];
    let tracesAnalyzed = 0;

    if (params.mode === 'single') {
      // Single mode: load specific trace and analyze it
      const trace = await loadTraceById(params.traceId!);
      if (!trace) {
        return {
          error: {
            code: 'TRACE_NOT_FOUND',
            message: `Trace with ID "${params.traceId}" not found in execution traces`,
          },
        };
      }

      insights = await reflector.analyzeTrace(trace);
      tracesAnalyzed = 1;
    } else {
      // Batch mode: analyze multiple traces with optional bead filter
      insights = await reflector.analyzeMultipleTraces(params.beadIds);
      
      // Count traces analyzed
      const allTraces = await loadAllTraces();
      if (params.beadIds) {
        tracesAnalyzed = allTraces.filter((t) => params.beadIds!.includes(t.bead_id)).length;
      } else {
        tracesAnalyzed = allTraces.length;
      }
    }

    // Filter by minConfidence if provided
    let filteredInsights = insights;
    if (params.minConfidence !== undefined) {
      filteredInsights = insights.filter((i) => i.confidence >= params.minConfidence!);
    }

    // Format results according to MCP design
    const formattedInsights = filteredInsights.map((insight) => ({
      id: insight.id,
      timestamp: insight.timestamp,
      taskId: insight.taskId,
      source: {
        runner: insight.source.runner,
        beadIds: insight.source.beadIds || [],
      },
      signal: {
        pattern: insight.signal.pattern,
        evidence: insight.signal.evidence,
      },
      recommendation: insight.recommendation,
      scope: {
        files: insight.scope.files,
        glob: insight.scope.glob,
      },
      confidence: insight.confidence,
      onlineEligible: insight.onlineEligible,
      metaTags: insight.metaTags,
    }));

    return {
      insights: formattedInsights,
      tracesAnalyzed,
      written: true, // Reflector writes insights in analyzeTrace/analyzeMultipleTraces
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Execution traces file not found',
          details: error,
        },
      };
    }

    if (error instanceof SyntaxError) {
      return {
        error: {
          code: 'PARSE_ERROR',
          message: 'Failed to parse execution traces file',
          details: error,
        },
      };
    }

    return {
      error: {
        code: 'PARSE_ERROR',
        message: 'An unexpected error occurred during pattern analysis',
        details: error,
      },
    };
  }
}

async function loadTraceById(traceId: string): Promise<ExecutionTrace | null> {
  const traces = await loadAllTraces();
  return traces.find((t) => t.trace_id === traceId) || null;
}

async function loadAllTraces(): Promise<ExecutionTrace[]> {
  try {
    const tracesPath = '/Users/sjarmak/ACE_Beads_Amp/logs/execution_traces.jsonl';
    const content = await readFile(tracesPath, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
