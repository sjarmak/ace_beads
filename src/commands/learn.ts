import { analyzeCommand } from './analyze.js';
import { applyCommand } from './apply.js';
import { TraceCleaner } from '../lib/trace-cleaner.js';
import { loadConfig } from '../lib/config.js';
import { ACELoop } from '../lib/ACELoop.js';

interface LearnOptions {
  beads?: string;
  minConfidence?: number;
  maxDeltas?: number;
  dryRun?: boolean;
  json?: boolean;
  skipCleanup?: boolean;
  mode?: 'online' | 'offline';
  watch?: boolean;
  epochs?: number;
  useLegacy?: boolean;
}

async function runAnalyzeStep(options: LearnOptions): Promise<void> {
  await analyzeCommand({
    mode: 'batch',
    beads: options.beads,
    dryRun: options.dryRun,
    json: false
  });
}

async function runApplyStep(options: LearnOptions): Promise<void> {
  await applyCommand({
    dryRun: options.dryRun,
    json: options.json
  });
}

async function runCleanupStep(options: LearnOptions): Promise<void> {
  if (options.dryRun || options.skipCleanup) return;
  
  if (!options.json) console.log('\nStep 3/3: Cleaning up old traces...');
  
  const config = loadConfig();
  const cleaner = new TraceCleaner(config);
  const result = await cleaner.cleanupTraces();
  
  if (!options.json && (result.tracesArchived > 0 || result.insightsArchived > 0)) {
    console.log(`✅ Cleanup complete`);
    console.log(`   Traces: ${result.tracesKept} kept, ${result.tracesArchived} archived`);
    if (result.insightsArchived > 0) {
      console.log(`   Insights: ${result.insightsKept} kept, ${result.insightsArchived} archived`);
    }
  } else if (!options.json) {
    console.log('✅ No cleanup needed');
  }
}

export async function learnCommand(options: LearnOptions): Promise<void> {
  if (options.useLegacy) {
    return runLegacyPipeline(options);
  }

  const loop = new ACELoop();
  const beadIds = options.beads?.split(',').map(b => b.trim()) || [];
  
  if (beadIds.length === 0) {
    console.error('Error: --beads parameter required');
    process.exit(1);
  }

  const loopOptions = {
    mode: options.mode || 'online',
    minConfidence: options.minConfidence,
    maxDeltas: options.maxDeltas,
    dryRun: options.dryRun
  } as const;

  if (options.mode === 'offline') {
    const epochs = options.epochs || 3;
    const result = await loop.runOfflineEpochs(beadIds, epochs, loopOptions);
    
    if (options.json) {
      console.log(JSON.stringify(result.summary, null, 2));
    }
  } else if (options.watch) {
    if (beadIds.length > 1) {
      console.error('Error: --watch only supports single bead');
      process.exit(1);
    }
    await loop.watchBead(beadIds[0], loopOptions);
  } else {
    const results = [];
    for (const beadId of beadIds) {
      const traces = await loop.getTracesForBead(beadId);
      
      if (traces.length === 0) {
        console.log(`⚠️  No traces found for ${beadId}`);
        continue;
      }
      
      for (const trace of traces) {
        const result = await loop.runWithTrace(trace, loopOptions);
        results.push(result);
      }
    }
    
    if (options.json) {
      const accepted = results.filter(r => r.accepted).length;
      console.log(JSON.stringify({
        totalProcessed: results.length,
        accepted,
        acceptanceRate: results.length > 0 ? accepted / results.length : 0
      }, null, 2));
    }
  }

  await runCleanupStep(options);
  if (!options.json) console.log('\n✅ Learning complete!');
}

async function runLegacyPipeline(options: LearnOptions): Promise<void> {
  if (!options.json) {
    console.log('🧠 ACE Learning Pipeline (legacy mode)...\n');
    console.log('Step 1/2: Analyzing traces...');
  }
  
  await runAnalyzeStep(options);
  
  if (!options.json) console.log('\nStep 2/2: Updating knowledge...');
  
  await runApplyStep(options);
  await runCleanupStep(options);
  
  if (!options.json) console.log('\n✅ Learning complete!');
}
