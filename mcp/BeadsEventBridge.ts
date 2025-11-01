import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'fs';
import { readFile, stat, appendFile } from 'fs/promises';
import { resolve } from 'path';
import { BeadIssue } from './beads-client.js';
import { Reflector } from './Reflector.js';
import { SessionManager } from './SessionManager.js';
import { ReviewRouter } from '../src/review-routing.js';
import { ReviewConfigLoader } from '../src/review-config-loader.js';

export interface BeadEvent {
  type: 'issueCreated' | 'issueUpdated' | 'issueClosed';
  issue: BeadIssue;
  timestamp: string;
}

export class BeadsEventBridge extends EventEmitter {
  private watcher?: FSWatcher;
  private issuesPath: string;
  private lastSize: number = 0;
  private lastLineCount: number = 0;
  private isProcessing: boolean = false;
  private reflector: Reflector;
  private reviewRouter?: ReviewRouter;

  constructor(issuesPath: string = resolve(process.cwd(), '.beads/issues.jsonl')) {
    super();
    this.issuesPath = issuesPath;
    this.reflector = new Reflector();
    this.initializeReviewRouter();
  }

  private async initializeReviewRouter(): Promise<void> {
    try {
      const loader = new ReviewConfigLoader();
      const config = await loader.load();
      this.reviewRouter = new ReviewRouter(config);
    } catch (error) {
      console.error('[BeadsEventBridge] Failed to initialize review router:', error);
      this.reviewRouter = new ReviewRouter();
    }
  }

  async start(): Promise<void> {
    try {
      const stats = await stat(this.issuesPath);
      this.lastSize = stats.size;
      await this.updateLineCount();
    } catch (error) {
      this.lastSize = 0;
      this.lastLineCount = 0;
    }

    this.watcher = watch(this.issuesPath, async (eventType) => {
      if (eventType === 'change' && !this.isProcessing) {
        await this.handleFileChange();
      }
    });

    this.watcher.on('error', (error) => {
      this.emit('error', error);
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  private async updateLineCount(): Promise<void> {
    try {
      const content = await readFile(this.issuesPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      this.lastLineCount = lines.length;
    } catch {
      this.lastLineCount = 0;
    }
  }

  private async handleFileChange(): Promise<void> {
    this.isProcessing = true;

    try {
      const stats = await stat(this.issuesPath);
      const currentSize = stats.size;

      if (currentSize <= this.lastSize) {
        this.lastSize = currentSize;
        this.isProcessing = false;
        return;
      }

      const content = await readFile(this.issuesPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      const currentLineCount = lines.length;

      if (currentLineCount > this.lastLineCount) {
        const newLines = lines.slice(this.lastLineCount);
        await this.processNewLines(newLines);
      }

      this.lastSize = currentSize;
      this.lastLineCount = currentLineCount;
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processNewLines(lines: string[]): Promise<void> {
    for (const line of lines) {
      try {
        const issue = JSON.parse(line) as BeadIssue;
        const eventType = this.determineEventType(issue);
        
        const event: BeadEvent = {
          type: eventType,
          issue,
          timestamp: new Date().toISOString(),
        };

        this.emit(eventType, event);
        this.emit('beadEvent', event);

        if (eventType === 'issueClosed' && issue.amp_metadata?.workspace_id) {
          const sessionId = issue.amp_metadata.workspace_id;
          await this.handleBeadClosureReview(issue, sessionId);
        } else if (eventType === 'issueCreated') {
          await this.handleBeadCreationReview(issue);
        } else if (eventType === 'issueUpdated') {
          await this.handleBeadUpdateReview(issue);
        }
      } catch (error) {
        this.emit('error', new Error(`Failed to parse line: ${line}`));
      }
    }
  }

  private determineEventType(issue: BeadIssue): BeadEvent['type'] {
    if (issue.status === 'closed' && issue.closed_at) {
      return 'issueClosed';
    }

    const createdTime = new Date(issue.created_at).getTime();
    const updatedTime = new Date(issue.updated_at).getTime();
    
    if (updatedTime - createdTime < 1000) {
      return 'issueCreated';
    }

    return 'issueUpdated';
  }

  private async handleBeadClosureReview(issue: BeadIssue, sessionId: string): Promise<void> {
    if (!this.reviewRouter) return;

    const destination = this.reviewRouter.getDestination('onBeadClosed');
    if (destination === 'none') return;

    try {
      const insights = await this.reflector.analyzeBeadClosure(sessionId);
      
      if (destination === 'file') {
        await this.writeReviewToFile('bead_closed', { issue, insights });
      } else if (destination === 'bd-comment') {
        // TODO: Implement bd comment posting
        console.log('[BeadsEventBridge] bd-comment destination not yet implemented');
      } else if (destination === 'new-bead') {
        // TODO: Implement new bead creation
        console.log('[BeadsEventBridge] new-bead destination not yet implemented');
      }
    } catch (error) {
      this.emit('error', new Error(`Review routing failed: ${(error as Error).message}`));
    }
  }

  private async handleBeadCreationReview(issue: BeadIssue): Promise<void> {
    if (!this.reviewRouter) return;

    const destination = this.reviewRouter.getDestination('onBeadCreated');
    if (destination === 'none') return;

    if (destination === 'file') {
      await this.writeReviewToFile('bead_created', { issue });
    }
  }

  private async handleBeadUpdateReview(issue: BeadIssue): Promise<void> {
    if (!this.reviewRouter) return;

    const destination = this.reviewRouter.getDestination('onBeadUpdated');
    if (destination === 'none') return;

    if (destination === 'file') {
      await this.writeReviewToFile('bead_updated', { issue });
    }
  }

  private async writeReviewToFile(reviewType: string, data: unknown): Promise<void> {
    if (!this.reviewRouter) return;

    const filePath = this.reviewRouter.getReviewFilePath();
    const entry = {
      type: reviewType,
      timestamp: new Date().toISOString(),
      data,
    };

    await appendFile(filePath, JSON.stringify(entry) + '\n');
  }
}
