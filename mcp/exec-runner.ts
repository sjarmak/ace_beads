import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { ExecutionResult, NormalizedError } from './types.js';

const execAsync = promisify(exec);

export class ExecutionRunner {
  private projectRoot: string;
  private logDir: string;

  constructor(projectRoot: string, logDir: string = 'logs/traces') {
    this.projectRoot = projectRoot;
    this.logDir = join(projectRoot, logDir);
  }

  async run(
    command: string,
    taskId?: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const result = await execAsync(command, {
        cwd: this.projectRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      stdout = error.stdout || '';
      stderr = error.stderr || '';
      exitCode = error.code || 1;
    }

    const duration = Date.now() - startTime;
    const errors = this.normalizeErrors(command, stdout, stderr);
    const status: 'pass' | 'fail' = exitCode === 0 && errors.filter(e => e.severity === 'error').length === 0 ? 'pass' : 'fail';

    const result: ExecutionResult = {
      status,
      errors,
      stdout,
      stderr,
      exitCode,
      duration,
      timestamp,
    };

    // Persist trace
    if (taskId) {
      await this.persistTrace(taskId, command, result);
    }

    return result;
  }

  private normalizeErrors(command: string, stdout: string, stderr: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const output = stdout + '\n' + stderr;

    // Detect tool from command
    const tool = this.detectTool(command);

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
      default:
        errors.push(...this.parseGenericErrors(output));
    }

    return errors;
  }

  private detectTool(command: string): 'tsc' | 'eslint' | 'vitest' | 'unknown' {
    if (command.includes('tsc') || command.includes('typecheck')) return 'tsc';
    if (command.includes('eslint') || command.includes('lint')) return 'eslint';
    if (command.includes('vitest') || command.includes('test')) return 'vitest';
    return 'unknown';
  }

  private parseTscErrors(output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    // Pattern: path/to/file.ts(line,col): error TSxxxx: message
    const tscPattern = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/gm;
    let match;

    while ((match = tscPattern.exec(output)) !== null) {
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

  private parseEslintErrors(output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    // Pattern: /path/to/file.ts
    //   line:col  error/warning  message  rule-name
    const lines = output.split('\n');
    let currentFile = '';

    for (const line of lines) {
      const fileMatch = line.match(/^(.+?\.(ts|tsx|js|jsx))$/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }

      const errorMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([@\w-/]+)$/);
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

  private parseVitestErrors(output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    // Pattern: FAIL  tests/file.test.ts > suite > test name
    const testFailPattern = /^(?:FAIL|×)\s+(.+?\.test\.ts)\s+>\s+(.+)$/gm;
    let match;

    while ((match = testFailPattern.exec(output)) !== null) {
      errors.push({
        tool: 'vitest',
        file: match[1],
        severity: 'error',
        message: `Test failed: ${match[2]}`,
      });
    }

    return errors;
  }

  private parseGenericErrors(output: string): NormalizedError[] {
    const errors: NormalizedError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
        errors.push({
          tool: 'unknown',
          file: 'unknown',
          severity: 'error',
          message: line.trim(),
        });
      }
    }

    return errors;
  }

  private async persistTrace(taskId: string, command: string, result: ExecutionResult): Promise<void> {
    const filename = `${taskId}-${Date.now()}.json`;
    const filepath = join(this.logDir, filename);

    const trace = {
      taskId,
      command,
      ...result,
    };

    await writeFile(filepath, JSON.stringify(trace, null, 2), 'utf-8');
  }

  async runBuild(): Promise<ExecutionResult> {
    return this.run('npm run build');
  }

  async runTests(): Promise<ExecutionResult> {
    return this.run('npm test -- --run');
  }

  async runLint(): Promise<ExecutionResult> {
    return this.run('npm run lint');
  }

  async runTypecheck(): Promise<ExecutionResult> {
    return this.run('npm run typecheck');
  }
}
