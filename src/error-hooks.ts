import { exec } from 'child_process';
import { promisify } from 'util';
import { Generator } from './lib/Generator.js';
import { ExecutionResult, NormalizedError } from './lib/mcp-types.js';

const execAsync = promisify(exec);

/**
 * Error capture hooks for ACE learning
 * 
 * These hooks capture build/test/lint failures and feed them into the Generator
 * for analysis by the Reflector, enabling the system to learn from failures.
 */

export interface ErrorHookOptions {
  beadId: string;
  command: string;
  tool: 'tsc' | 'eslint' | 'vitest' | 'npm';
  cwd?: string;
}

export class ErrorHooks {
  private generator: Generator;

  constructor(generator: Generator) {
    this.generator = generator;
  }

  /**
   * Run a command and capture any failures as execution traces
   */
  async runWithErrorCapture(options: ErrorHookOptions): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const { stdout, stderr } = await execAsync(options.command, {
        cwd: options.cwd || process.cwd(),
      });

      const duration = Date.now() - startTime;

      const result: ExecutionResult = {
        status: 'pass',
        errors: [],
        stdout,
        stderr,
        exitCode: 0,
        duration,
        timestamp,
      };

      await this.generator.recordExecution(result);
      console.log(`[ErrorHooks] ✅ ${options.tool} passed (${duration}ms)`);

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';

      const errors = this.parseErrors(options.tool, stderr + '\n' + stdout);

      const result: ExecutionResult = {
        status: 'fail',
        errors,
        stdout,
        stderr,
        exitCode: error.code || 1,
        duration,
        timestamp,
      };

      await this.generator.recordExecution(result);
      console.log(`[ErrorHooks] ❌ ${options.tool} failed with ${errors.length} errors`);

      return result;
    }
  }

  /**
   * Parse tool output into normalized errors
   */
  private parseErrors(tool: 'tsc' | 'eslint' | 'vitest' | 'npm', output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];

    switch (tool) {
      case 'tsc':
        errors.push(...this.parseTscErrors(output));
        break;
      case 'eslint':
        errors.push(...this.parseEslintErrors(output));
        break;
      case 'vitest':
        errors.push(...this.parseVitestErrors(output));
        break;
      case 'npm':
        errors.push(...this.parseNpmErrors(output));
        break;
    }

    return errors;
  }

  /**
   * Parse TypeScript compiler errors
   * Format: src/file.ts(10,5): error TS2304: Cannot find name 'foo'
   */
  private parseTscErrors(output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const tscRegex = /(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)/g;

    let match;
    while ((match = tscRegex.exec(output)) !== null) {
      errors.push({
        tool: 'tsc',
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        severity: match[4] as 'error' | 'warning',
        code: match[5],
        message: match[6],
      });
    }

    return errors;
  }

  /**
   * Parse ESLint errors
   * Format: /path/to/file.ts\n  10:5  error  'foo' is not defined  no-undef
   */
  private parseEslintErrors(output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = output.split('\n');

    let currentFile = '';

    for (const line of lines) {
      // File path line
      if (line.match(/^\//) || line.match(/^[A-Z]:\\/)) {
        currentFile = line.trim();
        continue;
      }

      // Error line: "  10:5  error  'foo' is not defined  no-undef"
      const errorMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}([\w-]+)/);
      if (errorMatch && currentFile) {
        errors.push({
          tool: 'eslint',
          file: currentFile,
          line: parseInt(errorMatch[1]),
          column: parseInt(errorMatch[2]),
          severity: errorMatch[3] as 'error' | 'warning',
          code: errorMatch[5],
          message: errorMatch[4],
        });
      }
    }

    return errors;
  }

  /**
   * Parse Vitest errors
   * Less structured, extract what we can
   */
  private parseVitestErrors(output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for "FAIL" lines
      if (line.includes('FAIL')) {
        const fileMatch = line.match(/FAIL\s+(.+\.test\.ts)/);
        if (fileMatch) {
          const file = fileMatch[1];
          const message = lines[i + 1]?.trim() || 'Test failed';

          errors.push({
            tool: 'vitest',
            file,
            severity: 'error',
            message,
          });
        }
      }

      // Look for assertion errors
      if (line.includes('AssertionError') || line.includes('Error:')) {
        const fileMatch = output.match(/at .+? \((.+?):(\d+):(\d+)\)/);
        if (fileMatch) {
          errors.push({
            tool: 'vitest',
            file: fileMatch[1],
            line: parseInt(fileMatch[2]),
            column: parseInt(fileMatch[3]),
            severity: 'error',
            message: line.trim(),
          });
        }
      }
    }

    return errors;
  }

  /**
   * Parse npm errors (generic)
   */
  private parseNpmErrors(output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('ERR!') || line.includes('ERROR')) {
        errors.push({
          tool: 'unknown',
          file: '',
          severity: 'error',
          message: line.trim(),
        });
      }
    }

    return errors;
  }
}

/**
 * Convenience wrapper for common build/test commands
 */
export async function runBuildWithCapture(generator: Generator, beadId: string): Promise<ExecutionResult> {
  const hooks = new ErrorHooks(generator);
  return hooks.runWithErrorCapture({
    beadId,
    command: 'npm run build',
    tool: 'tsc',
  });
}

export async function runTestWithCapture(generator: Generator, beadId: string): Promise<ExecutionResult> {
  const hooks = new ErrorHooks(generator);
  return hooks.runWithErrorCapture({
    beadId,
    command: 'npm test -- --run',
    tool: 'vitest',
  });
}

export async function runLintWithCapture(generator: Generator, beadId: string): Promise<ExecutionResult> {
  const hooks = new ErrorHooks(generator);
  return hooks.runWithErrorCapture({
    beadId,
    command: 'npm run lint',
    tool: 'eslint',
  });
}
