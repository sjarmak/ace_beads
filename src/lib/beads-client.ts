import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { appendFile, mkdir } from 'fs/promises';
import { AmpThreadMetadata, BeadNotificationEvent } from './mcp-types.js';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

const execAsync = promisify(exec);

// Stub mode for tests - store issues and dependencies in memory
const isTestMode = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

class BeadsStub {
  private issues: Map<string, BeadIssue> = new Map();
  private dependencies: BeadDependency[] = [];
  private counter = 1;

  generateId(): string {
    return `bd-${this.counter++}`;
  }

  createIssue(title: string, options: any): BeadIssue {
    const id = this.generateId();
    const now = new Date().toISOString();
    const issue: BeadIssue = {
      id,
      title,
      description: options?.description || '',
      status: 'open',
      priority: options?.priority ?? 2,
      issue_type: options?.type || 'task',
      created_at: now,
      updated_at: now,
      labels: options?.labels || [],
      assignee: options?.assignee,
    };
    this.issues.set(id, issue);
    return issue;
  }

  listIssues(filters?: any): BeadIssue[] {
    let issues = Array.from(this.issues.values());
    if (filters?.status) {
      issues = issues.filter(i => i.status === filters.status);
    }
    if (filters?.priority !== undefined) {
      issues = issues.filter(i => i.priority === filters.priority);
    }
    if (filters?.type) {
      issues = issues.filter(i => i.issue_type === filters.type);
    }
    return issues;
  }

  getIssue(id: string): BeadIssue | undefined {
    return this.issues.get(id);
  }

  updateIssue(id: string, updates: any): BeadIssue | undefined {
    const issue = this.issues.get(id);
    if (!issue) return undefined;
    
    if (updates.status) issue.status = updates.status;
    if (updates.priority !== undefined) issue.priority = updates.priority;
    if (updates.assignee) issue.assignee = updates.assignee;
    issue.updated_at = new Date().toISOString();
    
    return issue;
  }

  closeIssue(id: string): BeadIssue | undefined {
    const issue = this.issues.get(id);
    if (!issue) return undefined;
    
    issue.status = 'closed';
    issue.closed_at = new Date().toISOString();
    issue.updated_at = issue.closed_at;
    
    return issue;
  }

  addDependency(source: string, target: string, type: BeadDependency['type']): void {
    this.dependencies.push({ source, target, type });
  }

  getDependencyTree(id: string): any {
    return {
      id,
      dependencies: this.dependencies.filter(d => d.source === id || d.target === id),
    };
  }

  getDiscoveredIssues(parentId: string): string[] {
    return this.dependencies
      .filter(d => d.type === 'discovered-from' && d.target === parentId)
      .map(d => d.source);
  }
}

const stub = new BeadsStub();

export interface BeadIssue {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: number;
  issue_type: 'bug' | 'feature' | 'task' | 'epic' | 'chore';
  created_at: string;
  updated_at: string;
  closed_at?: string;
  labels?: string[];
  assignee?: string;
  amp_metadata?: AmpThreadMetadata;
}

export interface BeadDependency {
  source: string;
  target: string;
  type: 'blocks' | 'related' | 'parent-child' | 'discovered-from';
}

export class BeadsClient {
  private readonly ampMetadataPath: string;
  private readonly notificationPath: string;

  constructor(options?: { metadataPath?: string; notificationPath?: string }) {
    this.ampMetadataPath = options?.metadataPath || resolve(process.cwd(), '.beads/amp_metadata.jsonl');
    this.notificationPath = options?.notificationPath || resolve(process.cwd(), 'amp_notifications.jsonl');
  }

  private captureAmpThreadContext(): AmpThreadMetadata | undefined {
    const threadId = process.env.AMP_THREAD_ID;
    if (!threadId) return undefined;

    const workspaceId = process.env.AMP_WORKSPACE_ID || 'unknown';
    const now = new Date().toISOString();

    return {
      thread_id: threadId,
      thread_url: `https://ampcode.com/threads/${threadId}`,
      workspace_id: workspaceId,
      created_by_agent: process.env.ACE_ROLE as 'generator' | 'reflector' | 'curator' | undefined,
      created_in_context: process.env.AMP_MAIN_THREAD_ID ? 'subagent-thread' : 'main-thread',
      main_thread_id: process.env.AMP_MAIN_THREAD_ID,
      parent_thread_id: process.env.AMP_PARENT_THREAD_ID,
      handoff_goal: process.env.AMP_HANDOFF_GOAL,
      notification_count: 0,
      thread_created_at: now,
      thread_updated_at: now,
      synced_at: now,
    };
  }

  private async writeNotification(event: BeadNotificationEvent): Promise<void> {
    await appendFile(this.notificationPath, JSON.stringify(event) + '\n');
  }

  private async saveAmpMetadata(beadId: string, metadata: AmpThreadMetadata): Promise<void> {
    const dir = dirname(this.ampMetadataPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const entry = { bead_id: beadId, ...metadata };
    await appendFile(this.ampMetadataPath, JSON.stringify(entry) + '\n');
  }

  private async loadAmpMetadata(beadId: string): Promise<AmpThreadMetadata | undefined> {
    try {
      const { readFile } = await import('fs/promises');
      const content = await readFile(this.ampMetadataPath, 'utf-8');
      const lines = content.trim().split('\n');
      for (const line of lines.reverse()) {
        const entry = JSON.parse(line);
        if (entry.bead_id === beadId) {
          const { bead_id, ...metadata } = entry;
          return metadata as AmpThreadMetadata;
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  async createIssue(
    title: string,
    options?: {
      description?: string;
      type?: 'bug' | 'feature' | 'task' | 'epic' | 'chore';
      priority?: number;
      labels?: string[];
      assignee?: string;
      dependencies?: { type: string; target: string }[];
    }
  ): Promise<BeadIssue> {
    if (isTestMode) {
      const issue = stub.createIssue(title, options);
      const ampMetadata = this.captureAmpThreadContext();
      if (ampMetadata) {
        issue.amp_metadata = ampMetadata;
        await this.saveAmpMetadata(issue.id, ampMetadata);
      }
      if (options?.dependencies && options.dependencies.length > 0) {
        for (const dep of options.dependencies) {
          stub.addDependency(issue.id, dep.target, dep.type as any);
        }
      }
      return issue;
    }

    let cmd = `bd create "${title}" --json`;

    if (options?.type) cmd += ` -t ${options.type}`;
    if (options?.priority !== undefined) cmd += ` -p ${options.priority}`;
    if (options?.description) cmd += ` -d "${options.description}"`;
    if (options?.assignee) cmd += ` --assignee ${options.assignee}`;
    if (options?.labels && options.labels.length > 0) {
      cmd += ` -l ${options.labels.join(',')}`;
    }

    const { stdout } = await execAsync(cmd);
    const issue = JSON.parse(stdout.trim());

    const ampMetadata = this.captureAmpThreadContext();
    if (ampMetadata) {
      issue.amp_metadata = ampMetadata;
      await this.saveAmpMetadata(issue.id, ampMetadata);
    }

    if (options?.dependencies && options.dependencies.length > 0) {
      for (const dep of options.dependencies) {
        await this.addDependency(issue.id, dep.target, dep.type as any);
      }
    }

    return issue;
  }

  async listIssues(filters?: {
    status?: 'open' | 'in_progress' | 'closed';
    priority?: number;
    type?: string;
  }): Promise<BeadIssue[]> {
    if (isTestMode) {
      return stub.listIssues(filters);
    }

    let cmd = 'bd list --json';

    if (filters?.status) cmd += ` --status ${filters.status}`;
    if (filters?.priority !== undefined) cmd += ` --priority ${filters.priority}`;
    if (filters?.type) cmd += ` --type ${filters.type}`;

    const { stdout } = await execAsync(cmd);
    return JSON.parse(stdout.trim());
  }

  async getIssue(id: string): Promise<BeadIssue> {
    if (isTestMode) {
      const issue = stub.getIssue(id);
      if (!issue) throw new Error(`Issue ${id} not found`);
      const ampMetadata = await this.loadAmpMetadata(id);
      if (ampMetadata) {
        issue.amp_metadata = ampMetadata;
      }
      return issue;
    }

    const { stdout } = await execAsync(`bd show ${id} --json`);
    const result = JSON.parse(stdout.trim());
    const issue = Array.isArray(result) ? result[0] : result;
    
    const ampMetadata = await this.loadAmpMetadata(id);
    if (ampMetadata) {
      issue.amp_metadata = ampMetadata;
    }
    
    return issue;
  }

  async updateIssue(
    id: string,
    updates: {
      status?: 'open' | 'in_progress' | 'closed';
      priority?: number;
      assignee?: string;
    }
  ): Promise<BeadIssue> {
    if (isTestMode) {
      const issue = stub.updateIssue(id, updates);
      if (!issue) throw new Error(`Issue ${id} not found`);
      return issue;
    }

    let cmd = `bd update ${id} --json`;

    if (updates.status) cmd += ` --status ${updates.status}`;
    if (updates.priority !== undefined) cmd += ` --priority ${updates.priority}`;
    if (updates.assignee) cmd += ` --assignee ${updates.assignee}`;

    const { stdout } = await execAsync(cmd);
    const result = JSON.parse(stdout.trim());
    return Array.isArray(result) ? result[0] : result;
  }

  async closeIssue(id: string, reason?: string): Promise<BeadIssue> {
    const beforeClose = await this.getIssue(id);
    
    if (isTestMode) {
      const issue = stub.closeIssue(id);
      if (!issue) throw new Error(`Issue ${id} not found`);
      
      if (beforeClose.amp_metadata) {
        const event: BeadNotificationEvent = {
          event_id: randomUUID(),
          timestamp: new Date().toISOString(),
          bead_id: issue.id,
          thread_id: beforeClose.amp_metadata.thread_id,
          event_type: 'bead_completed',
          payload: {
            summary: `Issue ${issue.id} "${issue.title}" completed`,
            action_required: false,
          },
        };
        await this.writeNotification(event);
        issue.amp_metadata = beforeClose.amp_metadata;
      }
      
      return issue;
    }

    let cmd = `bd close ${id} --json`;
    if (reason) cmd += ` --reason "${reason}"`;

    const { stdout } = await execAsync(cmd);
    const result = JSON.parse(stdout.trim());
    const issue = Array.isArray(result) ? result[0] : result;

    if (beforeClose.amp_metadata) {
      const event: BeadNotificationEvent = {
        event_id: randomUUID(),
        timestamp: new Date().toISOString(),
        bead_id: issue.id,
        thread_id: beforeClose.amp_metadata.thread_id,
        event_type: 'bead_completed',
        payload: {
          summary: `Issue ${issue.id} "${issue.title}" completed`,
          action_required: false,
        },
      };
      await this.writeNotification(event);
      issue.amp_metadata = beforeClose.amp_metadata;
    }

    // Trigger ACE learning cycle in the background (non-blocking) - skip in test mode
    if (!isTestMode) {
      this.triggerACELearningCycle(id).catch((err) => {
        console.error(`[BeadsClient] ACE learning cycle failed for ${id}:`, err);
      });
    }

    return issue;
  }

  private async triggerACELearningCycle(beadId: string): Promise<void> {
    console.log(`[BeadsClient] Triggering ACE learning cycle for bead ${beadId}...`);
    
    // For E2E tests, run synchronously
    if (process.env.ACE_E2E_SYNC === 'true') {
      try {
        execSync('npx tsx scripts/ace-learn-cycle.ts', { 
          cwd: '/Users/sjarmak/ACE_Beads_Amp',
          stdio: 'inherit'
        });
        console.log(`[BeadsClient] ACE learning cycle completed synchronously`);
      } catch (error: any) {
        console.error(`[BeadsClient] ACE learning cycle error: ${error.message}`);
        throw error;
      }
    } else {
      // Run the learning cycle script in the background
      exec('npx tsx scripts/ace-learn-cycle.ts', { cwd: '/Users/sjarmak/ACE_Beads_Amp' }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[BeadsClient] ACE learning cycle error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`[BeadsClient] ACE learning cycle stderr: ${stderr}`);
        }
        if (stdout) {
          console.log(`[BeadsClient] ACE learning cycle output:\n${stdout}`);
        }
      });
    }
  }

  async getReadyIssues(): Promise<BeadIssue[]> {
    const { stdout } = await execAsync('bd ready --json');
    return JSON.parse(stdout.trim());
  }

  async addDependency(
    source: string,
    target: string,
    type: 'blocks' | 'related' | 'parent-child' | 'discovered-from'
  ): Promise<void> {
    if (isTestMode) {
      stub.addDependency(source, target, type);
      return;
    }
    await execAsync(`bd dep add ${source} ${target} --type ${type}`);
  }

  async getDependencyTree(id: string): Promise<any> {
    if (isTestMode) {
      return stub.getDependencyTree(id);
    }
    const { stdout } = await execAsync(`bd dep tree ${id} --json`);
    return JSON.parse(stdout.trim());
  }

  async getDiscoveredIssues(parentId: string): Promise<BeadIssue[]> {
    if (isTestMode) {
      const discoveredIds = stub.getDiscoveredIssues(parentId);
      const allIssues = stub.listIssues();
      return allIssues.filter(issue => discoveredIds.includes(issue.id));
    }

    const allIssues = await this.listIssues();
    const tree = await this.getDependencyTree(parentId);

    // Extract issues that were discovered from this parent
    const discoveredIds = new Set<string>();
    if (tree.dependencies) {
      for (const dep of tree.dependencies) {
        if (dep.type === 'discovered-from' && dep.target === parentId) {
          discoveredIds.add(dep.source);
        }
      }
    }

    return allIssues.filter((issue) => discoveredIds.has(issue.id));
  }

  async exportToJson(outputPath: string): Promise<void> {
    const { writeFile } = await import('fs/promises');
    const allIssues = await this.listIssues();
    
    const exportData = {
      exported_at: new Date().toISOString(),
      total_issues: allIssues.length,
      issues: allIssues,
    };
    
    await writeFile(outputPath, JSON.stringify(exportData, null, 2));
  }
}
