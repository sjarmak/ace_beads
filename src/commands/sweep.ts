import { BeadsClient } from '../lib/beads.js';
import { Reflector } from '../lib/Reflector.js';
import { DeltaQueue, AceDelta } from '../lib/deltas.js';
import { loadConfig } from '../lib/config.js';
import { randomUUID } from 'crypto';

export interface SweepOptions {
  range?: string;
  labels?: string;
  json?: boolean;
}

/**
 * Sweep command: offline learning from historical beads
 * Runs Reflector over closed/resolved beads in bulk
 */
export async function sweepCommand(options: SweepOptions): Promise<void> {
  const config = loadConfig();
  const beads = new BeadsClient({ cwd: process.cwd() });
  const reflector = new Reflector();
  const queue = new DeltaQueue(config.deltaQueue || '.ace/delta-queue.json');

  // Parse range if provided (e.g., "bd-100..bd-200")
  let beadIds: string[] | undefined;
  if (options.range) {
    const [start, end] = options.range.split('..');
    const startNum = parseInt(start.replace(/^\D+/, ''), 10);
    const endNum = parseInt(end.replace(/^\D+/, ''), 10);
    
    if (isNaN(startNum) || isNaN(endNum)) {
      throw new Error('Invalid range format. Use: bd-100..bd-200');
    }

    beadIds = [];
    for (let i = startNum; i <= endNum; i++) {
      beadIds.push(`bd-${i}`);
    }
  }

  // Fetch beads
  const labels = options.labels?.split(',') || ['ace', 'reflect'];
  const issues = await beads.list({
    status: ['closed'],
    labels,
  });

  let filtered = issues;
  if (beadIds) {
    filtered = issues.filter((i) => beadIds!.includes(i.id));
  }

  if (filtered.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ message: 'No beads to sweep' }, null, 2));
    } else {
      console.log('No beads to sweep');
    }
    return;
  }

  if (!options.json) {
    console.log(`Sweeping ${filtered.length} closed beads...`);
  }

  // Run batch analysis
  const insights = await reflector.analyzeMultipleTraces(filtered.map((i) => i.id));

  // Convert insights to deltas
  const deltas: AceDelta[] = insights.map((insight) => {
    // Determine section from taskId or metaTags
    const section = insight.metaTags?.[0] || 'general/patterns';
    
    return {
      id: randomUUID(),
      section,
      op: 'add' as const,
      content: insight.recommendation,
      metadata: {
        source: {
          beadsId: insight.source.beadIds?.join(',') || insight.taskId || 'unknown',
          runId: insight.id,
        },
        confidence: insight.confidence,
        helpful: 0,
        harmful: 0,
        tags: insight.metaTags || [],
        scope: insight.scope?.files || [],
        evidence: insight.signal.evidence.join('; ') || 'Batch analysis',
        createdAt: insight.timestamp || new Date().toISOString(),
      },
    };
  });

  // Enqueue deltas
  await queue.enqueue(deltas);

  if (options.json) {
    console.log(JSON.stringify({
      swept: filtered.length,
      insights: insights.length,
      deltasQueued: deltas.length,
    }, null, 2));
  } else {
    console.log(`✅ Swept ${filtered.length} beads`);
    console.log(`   Generated ${insights.length} insights`);
    console.log(`   Queued ${deltas.length} deltas`);
    console.log('\nRun `ace review` to preview, or `ace apply` to merge');
  }
}
