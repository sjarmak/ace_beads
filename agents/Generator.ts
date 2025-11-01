import { BeadsClient, BeadIssue } from '../mcp/beads-client.js';
import { readFile, appendFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { ExecutionResult } from '../mcp/types.js';

export interface BulletFeedback {
  bullet_id: string;
  bullet_content: string;
  feedback: 'helpful' | 'harmful' | 'ignored';
  reason: string;
  applied_at?: string;
}

export interface ExecutionTrace {
  trace_id: string;
  timestamp: string;
  bead_id: string;
  task_description: string;
  bullets_consulted: BulletFeedback[];
  execution_results: ExecutionResult[];
  discovered_issues: string[];
  completed: boolean;
  outcome: 'success' | 'failure' | 'partial';
}

export interface KnowledgeBullet {
  id: string;
  content: string;
  helpful: number;
  harmful: number;
}

export class Generator {
  private beadsClient: BeadsClient;
  private knowledgeBasePath: string;
  private executionTracePath: string;
  private currentTrace: ExecutionTrace | null = null;
  private bulletsCache: KnowledgeBullet[] = [];

  constructor(
    knowledgeBasePath: string = '/Users/sjarmak/ACE_Beads_Amp/knowledge/AGENT.md',
    executionTracePath: string = '/Users/sjarmak/ACE_Beads_Amp/logs/execution_traces.jsonl'
  ) {
    this.beadsClient = new BeadsClient();
    this.knowledgeBasePath = knowledgeBasePath;
    this.executionTracePath = executionTracePath;
  }

  async startTask(beadId: string, taskDescription?: string): Promise<void> {
    console.log(`[Generator] Starting task for bead: ${beadId}`);

    let description = taskDescription;
    if (!description) {
      const bead = await this.beadsClient.getIssue(beadId);
      description = bead.title;
    }

    this.bulletsCache = await this.loadKnowledgeBullets();

    this.currentTrace = {
      trace_id: randomUUID(),
      timestamp: new Date().toISOString(),
      bead_id: beadId,
      task_description: description,
      bullets_consulted: [],
      execution_results: [],
      discovered_issues: [],
      completed: false,
      outcome: 'success',
    };

    console.log(`[Generator] Loaded ${this.bulletsCache.length} knowledge bullets`);
    console.log(`[Generator] Started trace ${this.currentTrace.trace_id}`);
  }

  async consultBullet(bulletId: string, reason: string): Promise<void> {
    if (!this.currentTrace) {
      throw new Error('No active trace. Call startTask() first.');
    }

    const bullet = this.bulletsCache.find((b) => b.id === bulletId);
    if (!bullet) {
      console.warn(`[Generator] Bullet ${bulletId} not found in cache`);
      return;
    }

    const existing = this.currentTrace.bullets_consulted.find((b) => b.bullet_id === bulletId);
    if (existing) {
      console.log(`[Generator] Bullet ${bulletId} already consulted`);
      return;
    }

    this.currentTrace.bullets_consulted.push({
      bullet_id: bulletId,
      bullet_content: bullet.content,
      feedback: 'ignored',
      reason,
      applied_at: new Date().toISOString(),
    });

    console.log(`[Generator] Consulted bullet ${bulletId}: "${bullet.content.substring(0, 50)}..."`);
  }

  async markBulletHelpful(bulletId: string, reason: string): Promise<void> {
    this.updateBulletFeedback(bulletId, 'helpful', reason);
  }

  async markBulletHarmful(bulletId: string, reason: string): Promise<void> {
    this.updateBulletFeedback(bulletId, 'harmful', reason);
  }

  private updateBulletFeedback(bulletId: string, feedback: 'helpful' | 'harmful', reason: string): void {
    if (!this.currentTrace) {
      throw new Error('No active trace. Call startTask() first.');
    }

    const consulted = this.currentTrace.bullets_consulted.find((b) => b.bullet_id === bulletId);
    if (!consulted) {
      console.warn(`[Generator] Bullet ${bulletId} not consulted yet, adding with feedback`);
      const bullet = this.bulletsCache.find((b) => b.id === bulletId);
      if (bullet) {
        this.currentTrace.bullets_consulted.push({
          bullet_id: bulletId,
          bullet_content: bullet.content,
          feedback,
          reason,
          applied_at: new Date().toISOString(),
        });
      }
      return;
    }

    consulted.feedback = feedback;
    consulted.reason = reason;
    console.log(`[Generator] Marked bullet ${bulletId} as ${feedback}: ${reason}`);
  }

  async recordExecution(result: ExecutionResult): Promise<void> {
    if (!this.currentTrace) {
      throw new Error('No active trace. Call startTask() first.');
    }

    this.currentTrace.execution_results.push(result);

    if (result.status === 'fail') {
      this.currentTrace.outcome = 'failure';
    } else if (this.currentTrace.outcome !== 'failure') {
      this.currentTrace.outcome = 'success';
    }

    console.log(`[Generator] Recorded execution: ${result.status} (${result.errors.length} errors)`);
  }

  async recordDiscoveredIssue(issueId: string): Promise<void> {
    if (!this.currentTrace) {
      throw new Error('No active trace. Call startTask() first.');
    }

    this.currentTrace.discovered_issues.push(issueId);
    console.log(`[Generator] Recorded discovered issue: ${issueId}`);
  }

  async completeTask(outcome?: 'success' | 'failure' | 'partial'): Promise<ExecutionTrace> {
    if (!this.currentTrace) {
      throw new Error('No active trace. Call startTask() first.');
    }

    if (outcome) {
      this.currentTrace.outcome = outcome;
    }

    this.currentTrace.completed = true;
    this.currentTrace.timestamp = new Date().toISOString();

    await this.writeExecutionTrace(this.currentTrace);

    console.log(`[Generator] Completed task ${this.currentTrace.bead_id}`);
    console.log(`[Generator] Outcome: ${this.currentTrace.outcome}`);
    console.log(`[Generator] Bullets consulted: ${this.currentTrace.bullets_consulted.length}`);
    console.log(`[Generator] Helpful: ${this.currentTrace.bullets_consulted.filter((b) => b.feedback === 'helpful').length}`);
    console.log(`[Generator] Harmful: ${this.currentTrace.bullets_consulted.filter((b) => b.feedback === 'harmful').length}`);
    console.log(`[Generator] Discovered issues: ${this.currentTrace.discovered_issues.length}`);

    const completedTrace = this.currentTrace;
    this.currentTrace = null;

    return completedTrace;
  }

  getAvailableBullets(): KnowledgeBullet[] {
    return this.bulletsCache;
  }

  getCurrentTrace(): ExecutionTrace | null {
    return this.currentTrace;
  }

  private async loadKnowledgeBullets(): Promise<KnowledgeBullet[]> {
    try {
      const content = await readFile(this.knowledgeBasePath, 'utf-8');
      const bulletRegex = /\[Bullet #(\S+), helpful:(\d+), harmful:(\d+)\] (.+)/g;
      const bullets: KnowledgeBullet[] = [];

      let match;
      while ((match = bulletRegex.exec(content)) !== null) {
        bullets.push({
          id: match[1],
          helpful: parseInt(match[2]),
          harmful: parseInt(match[3]),
          content: match[4],
        });
      }

      return bullets;
    } catch {
      return [];
    }
  }

  private async writeExecutionTrace(trace: ExecutionTrace): Promise<void> {
    await appendFile(this.executionTracePath, JSON.stringify(trace) + '\n');
    console.log(`[Generator] Wrote execution trace to ${this.executionTracePath}`);
  }
}
