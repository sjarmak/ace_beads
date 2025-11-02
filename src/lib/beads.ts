import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface BeadsIssue {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'blocked' | 'closed';
  priority: number;
  labels: string[];
  created: string;
  updated: string;
  description?: string;
  closedReason?: string;
  discoveredFrom?: string[];
}

export interface BeadsOptions {
  bin?: string;
  cwd?: string;
  timeout?: number;
}

/**
 * Pure CLI wrapper for Beads (`bd` command)
 * Prefers --json outputs; falls back to parsing .beads/issues.jsonl
 */
export class BeadsClient {
  private bin: string;
  private cwd: string;
  private timeout: number;

  constructor(options: BeadsOptions = {}) {
    this.bin = options.bin || 'bd';
    this.cwd = options.cwd || process.cwd();
    this.timeout = options.timeout || 30000;
  }

  /**
   * Execute bd command with optional JSON parsing
   */
  private async exec(args: string[], parseJson: boolean = false): Promise<any> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.bin, args, {
        cwd: this.cwd,
        shell: true,
        timeout: this.timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`bd command failed (exit ${code}): ${stderr || stdout}`));
          return;
        }

        if (parseJson) {
          try {
            resolve(JSON.parse(stdout));
          } catch (err) {
            reject(new Error(`Failed to parse JSON output: ${err}`));
          }
        } else {
          resolve(stdout);
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn bd: ${err.message}`));
      });
    });
  }

  /**
   * Sync with remote
   */
  async sync(): Promise<void> {
    await this.exec(['sync']);
  }

  /**
   * List ready issues
   */
  async ready(): Promise<BeadsIssue[]> {
    try {
      return await this.exec(['ready', '--json'], true);
    } catch {
      // Fallback: parse .beads/issues.jsonl
      return this.loadFromJSONL(['open', 'in_progress']);
    }
  }

  /**
   * List all issues with optional filters
   */
  async list(filters?: {
    status?: string[];
    labels?: string[];
    priority?: number;
  }): Promise<BeadsIssue[]> {
    const args = ['list', '--json'];
    
    if (filters?.status) {
      args.push('--status', filters.status.join(','));
    }
    if (filters?.labels) {
      args.push('--labels', filters.labels.join(','));
    }
    if (filters?.priority !== undefined) {
      args.push('--priority', String(filters.priority));
    }

    try {
      return await this.exec(args, true);
    } catch {
      return this.loadFromJSONL(filters?.status);
    }
  }

  /**
   * Show single issue details
   */
  async show(id: string): Promise<BeadsIssue> {
    try {
      return await this.exec(['show', id, '--json'], true);
    } catch {
      const issues = await this.loadFromJSONL();
      const issue = issues.find((i) => i.id === id);
      if (!issue) {
        throw new Error(`Issue ${id} not found`);
      }
      return issue;
    }
  }

  /**
   * Create new issue
   */
  async create(data: {
    title: string;
    description?: string;
    labels?: string[];
    priority?: number;
  }): Promise<BeadsIssue> {
    const args = ['create', data.title];
    
    if (data.description) {
      args.push('--desc', data.description);
    }
    if (data.labels) {
      args.push('--labels', data.labels.join(','));
    }
    if (data.priority !== undefined) {
      args.push('--priority', String(data.priority));
    }
    
    args.push('--json');

    const result = await this.exec(args, true);
    
    // If no JSON returned, re-fetch
    if (!result || !result.id) {
      await this.sync();
      const issues = await this.list();
      const created = issues.find((i) => i.title === data.title);
      if (!created) {
        throw new Error('Failed to create issue');
      }
      return created;
    }

    return result;
  }

  /**
   * Close issue
   */
  async close(id: string, reason?: string): Promise<void> {
    const args = ['close', id];
    if (reason) {
      args.push('--reason', reason);
    }
    await this.exec(args);
  }

  /**
   * Update issue
   */
  async update(id: string, updates: {
    status?: string;
    priority?: number;
    labels?: string[];
  }): Promise<void> {
    const args = ['update', id];
    
    if (updates.status) {
      args.push('--status', updates.status);
    }
    if (updates.priority !== undefined) {
      args.push('--priority', String(updates.priority));
    }
    if (updates.labels) {
      args.push('--labels', updates.labels.join(','));
    }

    await this.exec(args);
  }

  /**
   * Fallback: load from .beads/issues.jsonl
   */
  private async loadFromJSONL(statusFilter?: string[]): Promise<BeadsIssue[]> {
    try {
      const path = join(this.cwd, '.beads', 'issues.jsonl');
      const content = await readFile(path, 'utf-8');
      const issues: BeadsIssue[] = content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));

      if (statusFilter) {
        return issues.filter((i) => statusFilter.includes(i.status));
      }

      return issues;
    } catch {
      return [];
    }
  }
}
