import { SessionManager } from './SessionManager.js';
import { Insight } from './types.js';
import { appendFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';

export class Reflector {
  private baseSessionDir: string;
  private insightsPath: string;

  constructor(baseSessionDir?: string) {
    this.baseSessionDir = baseSessionDir || '.ace/sessions';
    this.insightsPath = resolve(process.cwd(), 'insights.jsonl');
  }

  private async writeInsight(insight: Insight): Promise<void> {
    const dir = dirname(this.insightsPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await appendFile(this.insightsPath, JSON.stringify(insight) + '\n');
  }

  async analyzeBeadClosure(sessionId: string): Promise<void> {
    const session = await SessionManager.loadSession(sessionId, this.baseSessionDir);
    console.log(`[Reflector] Starting analysis for session: ${sessionId}`);
    const metadata = await session.getMetadata();
    console.log(`[Reflector] Session metadata:`, metadata);

    // Generate mock insights for Curator testing
    const highConfidenceInsight: Insight = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      taskId: sessionId,
      source: {
        beadIds: [sessionId],
      },
      signal: {
        pattern: 'TypeScript import extension pattern',
        evidence: ['Import failed due to missing .js extension'],
      },
      recommendation: 'Always use .js extensions in TypeScript imports when using ESM',
      scope: {
        glob: '**/*.ts',
      },
      confidence: 0.9,
      onlineEligible: true,
      metaTags: ['typescript', 'imports'],
      delta: '[Bullet #mock-high-conf] TypeScript ESM imports require .js extension - Always add .js to import statements',
      target_bullet_id: 'mock-high-conf',
    };

    const lowConfidenceInsight: Insight = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      taskId: sessionId,
      source: {
        beadIds: [sessionId],
      },
      signal: {
        pattern: 'Test timeout pattern',
        evidence: ['Test took longer than expected'],
      },
      recommendation: 'Consider increasing test timeout',
      scope: {
        glob: '**/*.test.ts',
      },
      confidence: 0.5,
      onlineEligible: false,
      metaTags: ['testing', 'performance'],
      delta: '[Bullet #mock-low-conf] Test timeouts may indicate performance issues - Investigate slow tests',
      target_bullet_id: 'mock-low-conf',
    };

    await this.writeInsight(highConfidenceInsight);
    await this.writeInsight(lowConfidenceInsight);
    
    console.log(`[Reflector] Generated 2 mock insights for session ${sessionId}`);
  }
}
