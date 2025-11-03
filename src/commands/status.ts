import { loadConfig } from '../lib/config.js';
import { DeltaQueue } from '../lib/deltas.js';
import { BeadsClient } from '../lib/beads.js';

export interface StatusResult {
  deltaQueue: {
    count: number;
    bySection: Record<string, number>;
  };
  beads: {
    total: number;
    labeled: number;
    ready: number;
  };
  config: {
    confidenceMin: number;
    maxDeltasPerSession: number;
  };
}

export async function statusCommand(options: { json?: boolean }): Promise<void> {
  const config = loadConfig();
  const queue = new DeltaQueue(config.deltaQueue || '.ace/delta-queue.json');
  const beads = new BeadsClient({ cwd: process.cwd() });

  const deltas = await queue.read();
  const bySection: Record<string, number> = {};
  for (const delta of deltas) {
    bySection[delta.section] = (bySection[delta.section] || 0) + 1;
  }

  let beadsStats = { total: 0, labeled: 0, ready: 0 };
  try {
    const allIssues = await beads.list();
    const labeledIssues = await beads.list({ labels: ['ace', 'reflect'] });
    const readyIssues = await beads.ready();

    beadsStats = {
      total: allIssues.length,
      labeled: labeledIssues.length,
      ready: readyIssues.length,
    };
  } catch {
    // Beads not available, skip
  }

  const result: StatusResult = {
    deltaQueue: {
      count: deltas.length,
      bySection,
    },
    beads: beadsStats,
    config: {
      confidenceMin: config.learning?.confidenceMin || 0.80,
      maxDeltasPerSession: config.learning?.maxDeltasPerSession || 3,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('ACE Status\n');
    console.log(`Delta Queue: ${result.deltaQueue.count} pending`);
    if (result.deltaQueue.count > 0) {
      console.log('  By section:');
      for (const [section, count] of Object.entries(result.deltaQueue.bySection)) {
        console.log(`    ${section}: ${count}`);
      }
    }
    const beadsSummary =
      `\nBeads: ${result.beads.total} total, ${result.beads.labeled} labeled ` +
      `ace/reflect, ${result.beads.ready} ready`;
    console.log(beadsSummary);
    const configSummary =
      `\nConfig: confidence ≥ ${result.config.confidenceMin}, ` +
      `max ${result.config.maxDeltasPerSession} deltas/session`;
    console.log(configSummary);
  }
}
