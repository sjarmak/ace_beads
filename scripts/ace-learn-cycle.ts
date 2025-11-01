import { Reflector } from '../agents/Reflector.js';
import { Curator } from '../agents/Curator.js';

async function runACELearningCycle() {
  console.log('=== ACE Learning Cycle ===\n');
  
  // Step 1: Reflector analyzes execution traces
  console.log('Step 1: Reflector analyzing traces...');
  const reflector = new Reflector(
    '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
    '/Users/sjarmak/ACE_Beads_Amp/logs/execution_traces.jsonl'
  );
  
  // For now, Reflector processes existing insights
  console.log('  (Traces analysis would happen here when Generator creates execution traces)\n');
  
  // Step 2: Curator processes insights
  console.log('Step 2: Curator processing insights...');
  const curator = new Curator(
    '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
    '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md',
    3 // Max 3 deltas per session
  );
  
  const deltas = await curator.processInsights(0.8);
  
  console.log(`\n✓ Learning cycle complete!`);
  console.log(`  - Processed ${deltas.length} insights`);
  console.log(`  - Updated AGENTS.md with new patterns\n`);
  
  if (deltas.length > 0) {
    console.log('Applied patterns:');
    for (const delta of deltas) {
      console.log(`  ✓ [${delta.section}] ${delta.content.substring(0, 70)}...`);
    }
  } else {
    console.log('No new high-confidence insights to process.');
  }
}

runACELearningCycle().catch((err) => {
  console.error('Error in ACE learning cycle:', err);
  process.exit(1);
});
