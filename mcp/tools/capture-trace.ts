import { Generator } from '../../agents/Generator.js';
import { ExecutionResult, NormalizedError } from '../types.js';

export interface CaptureTraceParams {
  beadId: string;
  taskDescription?: string;
  executions: Array<{
    runner: string;
    command: string;
    status: 'pass' | 'fail';
    errors: Array<{
      tool: string;
      severity: 'error' | 'warning' | 'info';
      message: string;
      file: string;
      line: number;
      column?: number;
    }>;
  }>;
  discoveredIssues?: string[];
  outcome?: 'success' | 'failure' | 'partial';
}

export interface CaptureTraceResponse {
  traceId: string;
  timestamp: string;
  written: boolean;
  bulletsConsulted: number;
}

export interface CaptureTraceError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export async function captureTrace(
  params: CaptureTraceParams
): Promise<CaptureTraceResponse | CaptureTraceError> {
  try {
    // Validate required parameters
    if (!params.beadId) {
      return {
        error: {
          code: 'INVALID_PARAMS',
          message: 'beadId is required',
        },
      };
    }

    if (!params.executions || params.executions.length === 0) {
      return {
        error: {
          code: 'INVALID_PARAMS',
          message: 'executions array is required and must not be empty',
        },
      };
    }

    // Initialize Generator with default paths
    const generator = new Generator(
      '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md',
      '/Users/sjarmak/ACE_Beads_Amp/logs/execution_traces.jsonl'
    );

    // Start task
    await generator.startTask(params.beadId, params.taskDescription);

    // Record each execution
    for (const execution of params.executions) {
      const executionResult: ExecutionResult = {
        status: execution.status,
        errors: execution.errors.map((err): NormalizedError => ({
          tool: err.tool as 'tsc' | 'eslint' | 'vitest' | 'unknown',
          severity: err.severity === 'info' ? 'warning' : err.severity,
          message: err.message,
          file: err.file,
          line: err.line,
          column: err.column,
        })),
        stdout: '',
        stderr: '',
        exitCode: execution.status === 'fail' ? 1 : 0,
        duration: 0,
        timestamp: new Date().toISOString(),
      };

      await generator.recordExecution(executionResult);
    }

    // Record discovered issues
    if (params.discoveredIssues) {
      for (const issueId of params.discoveredIssues) {
        await generator.recordDiscoveredIssue(issueId);
      }
    }

    // Complete task and get trace
    const trace = await generator.completeTask(params.outcome);

    return {
      traceId: trace.trace_id,
      timestamp: trace.timestamp,
      written: true,
      bulletsConsulted: trace.bullets_consulted.length,
    };
  } catch (error) {
    const err = error as Error;
    
    if (err.message.includes('not found') || err.message.includes('ENOENT')) {
      return {
        error: {
          code: 'FILE_NOT_FOUND',
          message: err.message,
          details: err,
        },
      };
    }

    if (err.message.includes('parse') || err.message.includes('JSON')) {
      return {
        error: {
          code: 'PARSE_ERROR',
          message: err.message,
          details: err,
        },
      };
    }

    if (err.message.includes('write') || err.message.includes('EACCES')) {
      return {
        error: {
          code: 'WRITE_ERROR',
          message: err.message,
          details: err,
        },
      };
    }

    return {
      error: {
        code: 'INVALID_PARAMS',
        message: err.message,
        details: err,
      },
    };
  }
}
