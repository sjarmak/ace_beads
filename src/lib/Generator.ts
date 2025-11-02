import { BeadsClient, BeadIssue } from './beads-client.js';
import { readFile, appendFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { ExecutionResult, AmpThreadMetadata } from './mcp-types.js';
import { loadConfig } from './config.js';

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
  amp_threads?: AmpThreadMetadata[];
  thread_refs?: string[];
  thread_summary?: string;
  thread_citations?: { thread_id: string; message_id?: string; quote: string; rationale: string }[];
}

export interface KnowledgeBullet {
  id: string;
  content: string;
  helpful: number;
  harmful: number;
  section: string;
}

export class Generator {
  private beadsClient: BeadsClient;
  private knowledgeBasePath: string;
  private executionTracePath: string;
  private currentTrace: ExecutionTrace | null = null;
  private bulletsCache: KnowledgeBullet[] = [];

  constructor(
    knowledgeBasePath?: string,
    executionTracePath?: string
  ) {
    const config = loadConfig();
    this.beadsClient = new BeadsClient();
    this.knowledgeBasePath = knowledgeBasePath ?? config.agentsPath;
    this.executionTracePath = executionTracePath ?? config.tracesPath;
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
    
    // Update bullet counters in AGENTS.md
    await this.updateBulletCounters(completedTrace);
    
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
      const lines = content.split('\n');
      const bullets: KnowledgeBullet[] = [];
      let currentSection = '';

      // Updated regex to handle optional ", Aggregated from X instances" suffix
      const bulletRegex = /\[Bullet #(\S+), helpful:(\d+), harmful:(\d+)(?:, [^\]]+)?\] (.+)/;

      for (const line of lines) {
        // Track section headers
        if (line.trim().startsWith('## ') || line.trim().startsWith('### ')) {
          currentSection = line.trim().replace(/^##+ /, '');
          continue;
        }

        // Match bullets
        const match = line.match(bulletRegex);
        if (match) {
          bullets.push({
            id: match[1],
            helpful: parseInt(match[2]),
            harmful: parseInt(match[3]),
            content: match[4],
            section: currentSection,
          });
        }
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

  private async updateBulletCounters(trace: ExecutionTrace): Promise<void> {
    try {
      let content = await readFile(this.knowledgeBasePath, 'utf-8');
      
      // Count helpful and harmful feedback for each bullet
      const feedbackCounts = new Map<string, { helpful: number; harmful: number }>();
      for (const feedback of trace.bullets_consulted) {
        if (!feedbackCounts.has(feedback.bullet_id)) {
          feedbackCounts.set(feedback.bullet_id, { helpful: 0, harmful: 0 });
        }
        const counts = feedbackCounts.get(feedback.bullet_id)!;
        if (feedback.feedback === 'helpful') {
          counts.helpful++;
        } else if (feedback.feedback === 'harmful') {
          counts.harmful++;
        }
      }
      
      // Update each bullet's counters
      for (const [bulletId, delta] of feedbackCounts) {
        const bulletRegex = new RegExp(
          `(\\[Bullet #${bulletId}, helpful:)(\\d+)(, harmful:)(\\d+)((?:, [^\\]]+)?\\])`,
          'g'
        );
        
        content = content.replace(bulletRegex, (match, p1, helpful, p3, harmful, p5) => {
          const newHelpful = parseInt(helpful) + delta.helpful;
          const newHarmful = parseInt(harmful) + delta.harmful;
          return `${p1}${newHelpful}${p3}${newHarmful}${p5}`;
        });
      }
      
      await writeFile(this.knowledgeBasePath, content, 'utf-8');
    } catch (error) {
      console.error('[Generator] Failed to update bullet counters:', error);
    }
  }
}
