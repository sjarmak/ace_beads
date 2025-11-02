import { analyzeCommand } from './analyze.js';
import { updateCommand } from './update.js';
import { TraceCleaner } from '../lib/trace-cleaner.js';
import { loadConfig } from '../lib/config.js';

interface LearnOptions {
  beads?: string;
  minConfidence?: number;
  maxDeltas?: number;
  dryRun?: boolean;
  json?: boolean;
  skipCleanup?: boolean;
}

export async function learnCommand(options: LearnOptions): Promise<void> {
  if (!options.json) {
    console.log('🧠 ACE Learning Pipeline...\n');
    console.log('Step 1/2: Analyzing traces...');
  }
  
  // Run analyze (don't pass minConfidence - analyze collects all insights)
  await analyzeCommand({
    mode: 'batch',
    beads: options.beads,
    dryRun: options.dryRun,
    json: false
  });
  
  if (!options.json) {
    console.log('\nStep 2/2: Updating knowledge...');
  }
  
  // Run update
  await updateCommand({
    minConfidence: options.minConfidence,
    maxDeltas: options.maxDeltas,
    dryRun: options.dryRun,
    json: options.json
  });
  
  // Cleanup old traces after successful learning (unless dry run or explicitly skipped)
  if (!options.dryRun && !options.skipCleanup) {
    if (!options.json) {
      console.log('\nStep 3/3: Cleaning up old traces...');
    }
    
    const config = loadConfig();
    const cleaner = new TraceCleaner(config);
    const result = await cleaner.cleanupTraces();
    
    if (!options.json) {
      if (result.tracesArchived > 0 || result.insightsArchived > 0) {
        console.log(`✅ Cleanup complete`);
        console.log(`   Traces: ${result.tracesKept} kept, ${result.tracesArchived} archived`);
        if (result.insightsArchived > 0) {
          console.log(`   Insights: ${result.insightsKept} kept, ${result.insightsArchived} archived`);
        }
      } else {
        console.log('✅ No cleanup needed');
      }
    }
  }
  
  if (!options.json) {
    console.log('\n✅ Learning complete!');
  }
}
