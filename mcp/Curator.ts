import { Insight, BeadNotificationEvent } from './types.js';
import { readFile, appendFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

export class Curator {
  private insightsPath: string;
  private knowledgePath: string;
  private archivePath: string;
  private notificationPath: string;

  constructor(insightsPath?: string, knowledgePath?: string) {
    this.insightsPath = insightsPath || resolve(process.cwd(), 'insights.jsonl');
    this.knowledgePath = knowledgePath || resolve(process.cwd(), 'knowledge/AGENTS.md');
    this.archivePath = resolve(process.cwd(), 'knowledge/AGENTS.archive.md');
    this.notificationPath = resolve(process.cwd(), 'amp_notifications.jsonl');
  }

  async run(): Promise<void> {
    console.log('[Curator] Starting delta application process...');

    // Read insights from insights.jsonl
    if (!existsSync(this.insightsPath)) {
      console.log('[Curator] No insights.jsonl found, nothing to process');
      return;
    }

    const content = await readFile(this.insightsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    const allInsights: Insight[] = [];
    for (const line of lines) {
      try {
        const insight = JSON.parse(line) as Insight;
        allInsights.push(insight);
      } catch (error) {
        console.error(`[Curator] Failed to parse insight line: ${line}`);
      }
    }

    console.log(`[Curator] Loaded ${allInsights.length} insights`);

    // Filter for high-confidence insights (>= 0.8)
    const highConfidenceInsights = allInsights
      .filter(insight => insight.confidence >= 0.8)
      .sort((a, b) => b.confidence - a.confidence); // Sort by confidence descending

    console.log(`[Curator] Found ${highConfidenceInsights.length} high-confidence insights (>= 0.8)`);

    // Select top 3 deltas
    const selectedInsights = highConfidenceInsights.slice(0, 3);

    if (selectedInsights.length === 0) {
      console.log('[Curator] No high-confidence insights to apply');
      return;
    }

    console.log(`[Curator] Selected ${selectedInsights.length} insights for delta application:`);
    for (const insight of selectedInsights) {
      console.log(`  - [${insight.confidence.toFixed(2)}] ${insight.signal.pattern}`);
      console.log(`    Delta: ${insight.delta}`);
      console.log(`    Target: ${insight.target_bullet_id || 'N/A'}`);
    }

    // Apply deltas to knowledge/AGENTS.md
    const appliedCount = await this.applyDeltas(selectedInsights);

    // Archive harmful bullets
    const archivedCount = await this.archiveHarmfulBullets();

    // Send notification
    await this.notifyUser(appliedCount, archivedCount);

    console.log(`[Curator] Completed: ${appliedCount} deltas applied, ${archivedCount} bullets archived`);
  }

  private async applyDeltas(insights: Insight[]): Promise<number> {
    if (insights.length === 0) return 0;

    const deltas = insights.map(insight => insight.delta).join('\n');
    await appendFile(this.knowledgePath, '\n' + deltas + '\n');

    console.log(`[Curator] Applied ${insights.length} deltas to ${this.knowledgePath}`);
    return insights.length;
  }

  private async archiveHarmfulBullets(): Promise<number> {
    if (!existsSync(this.knowledgePath)) return 0;

    const content = await readFile(this.knowledgePath, 'utf-8');
    const lines = content.split('\n');

    const harmfulBullets: string[] = [];
    const keptLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/\[Bullet #([^,]+), helpful:(\d+), harmful:(\d+)\]/);
      if (match) {
        const helpful = parseInt(match[2], 10);
        const harmful = parseInt(match[3], 10);

        if (harmful >= 2) {
          harmfulBullets.push(line);
          console.log(`[Curator] Archiving harmful bullet: ${match[1]} (harmful:${harmful})`);
          continue;
        }
      }
      keptLines.push(line);
    }

    if (harmfulBullets.length > 0) {
      // Write kept lines back to AGENTS.md
      await writeFile(this.knowledgePath, keptLines.join('\n'));

      // Append harmful bullets to archive
      const archiveHeader = harmfulBullets.length > 0 
        ? `\n## Archived ${new Date().toISOString()}\n\n` 
        : '';
      await appendFile(this.archivePath, archiveHeader + harmfulBullets.join('\n') + '\n');

      console.log(`[Curator] Archived ${harmfulBullets.length} harmful bullets to ${this.archivePath}`);
    }

    return harmfulBullets.length;
  }

  private async notifyUser(appliedCount: number, archivedCount: number): Promise<void> {
    const threadId = process.env.AMP_THREAD_ID;
    if (!threadId) return;

    const event: BeadNotificationEvent = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      bead_id: 'curator-run',
      thread_id: threadId,
      event_type: 'knowledge_updated',
      payload: {
        summary: `Curator applied ${appliedCount} deltas and archived ${archivedCount} harmful bullets`,
        details: {
          bullets_added: appliedCount,
          bullets_updated: archivedCount,
        },
        action_required: false,
      },
    };

    await appendFile(this.notificationPath, JSON.stringify(event) + '\n');
    console.log(`[Curator] Notification sent for knowledge update`);
  }
}
