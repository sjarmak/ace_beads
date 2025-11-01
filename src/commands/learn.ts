import { analyzeCommand } from './analyze.js';
import { updateCommand } from './update.js';

interface LearnOptions {
  beads?: string;
  minConfidence?: number;
  maxDeltas?: number;
  dryRun?: boolean;
  json?: boolean;
}

export async function learnCommand(options: LearnOptions): Promise<void> {
  if (!options.json) {
    console.log('🧠 ACE Learning Pipeline...\n');
    console.log('Step 1/2: Analyzing traces...');
  }
  
  // Run analyze
  await analyzeCommand({
    mode: 'batch',
    beads: options.beads,
    minConfidence: options.minConfidence,
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
  
  if (!options.json) {
    console.log('\n✅ Learning complete!');
  }
}
