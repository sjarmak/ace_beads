import { Curator } from '../src/lib/Curator.js';

async function runCurator() {
  console.log('=== Running Curator to Process Insights ===\n');
  
  const curator = new Curator(
    '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
    '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md',
    3
  );
  
  const deltas = await curator.processInsights(0.8);
  
  console.log(`\n✓ Curator processed ${deltas.length} insights and updated AGENTS.md`);
  
  if (deltas.length > 0) {
    console.log('\nApplied deltas:');
    for (const delta of deltas) {
      console.log(`  - [${delta.section}] ${delta.bullet_id}: ${delta.content.substring(0, 60)}...`);
    }
  }
}

runCurator().catch((err) => {
  console.error('Error running curator:', err);
  process.exit(1);
});
