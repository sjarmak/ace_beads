import { Reflector } from '../src/lib/Reflector.js';
import { Curator } from '../src/lib/Curator.js';
import { loadConfig } from '../src/lib/config.js';
import { AgentsMdMaintainer } from '../src/lib/agents-md-maintainer.js';

async function runACELearningCycle() {
  console.log('=== ACE Learning Cycle ===\n');
  
  const config = loadConfig();
  
  // Step 1: Reflector analyzes execution traces
  console.log('Step 1: Reflector analyzing traces...');
  const reflector = new Reflector(config.insightsPath, config.tracesPath);
  
  // For now, Reflector processes existing insights
  console.log('  (Traces analysis would happen here when Generator creates execution traces)\n');
  
  // Step 2: Curator processes insights
  console.log('Step 2: Curator processing insights...');
  const curator = new Curator(config.insightsPath, config.agentsPath, config.maxDeltas);
  
  const deltas = await curator.processInsights(config.defaultConfidence);
  
  // Step 3: Run deduplication after applying deltas
  if (deltas.length > 0) {
    console.log('Step 3: Running deduplication...');
    await curator.deduplicateAndConsolidate();
    
    // Step 4: Trim AGENTS.md to 500 lines if needed
    console.log('Step 4: Checking AGENTS.md size...');
    const maintainer = new AgentsMdMaintainer(500, config.agentsPath);
    const result = await maintainer.trimToLimit();
    if (result.bulletsMoved > 0) {
      console.log(`  Archived ${result.bulletsMoved} bullets to ${result.archivePath}`);
    }
  }
  
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
