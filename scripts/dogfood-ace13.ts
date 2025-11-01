import { appendFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { Curator } from '../agents/Curator.js';
import { BeadIssue } from '../mcp/beads-client.js';

async function dogfoodACE13() {
  console.log('=== Dogfooding ACE Framework on ACE_Beads_Amp-13 ===\n');

  const reflectorInsight = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    taskId: 'ACE_Beads_Amp-13',
    source: {
      beadIds: ['ACE_Beads_Amp-13'],
    },
    signal: {
      pattern: 'TypeScript module imports require .js extension even for .ts files',
      evidence: [
        'Had to import BeadsClient from beads-client.js not beads-client.ts',
        'ESM modules in Node require full file extensions',
        'tsconfig.json has "module": "ESNext" which enforces ESM rules',
      ],
    },
    recommendation: 'Always use .js extensions in import statements for TypeScript files when using ESM module resolution',
    scope: {
      glob: '**/*.ts',
    },
    confidence: 0.95,
    onlineEligible: true,
    metaTags: ['typescript', 'esm', 'imports', 'modules'],
  };

  const insightsPath = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl';
  await appendFile(insightsPath, JSON.stringify(reflectorInsight) + '\n');
  console.log('✓ Created reflector insight\n');

  const completedBead: BeadIssue = {
    id: 'ACE_Beads_Amp-13',
    title: 'Implement mechanistic ACE Curator with semantic similarity and counter-based pruning',
    description: 'Implemented Curator agent',
    status: 'closed',
    priority: 1,
    issue_type: 'feature',
    created_at: '2025-10-27T12:19:00.547888-04:00',
    updated_at: new Date().toISOString(),
    closed_at: new Date().toISOString(),
  };

  const curator = new Curator('/Users/sjarmak/ACE_Beads_Amp/AGENTS.md');
  
  console.log('Running Curator on our own completed work...\n');
  await curator.updateKnowledge(completedBead);

  const { readFile } = await import('fs/promises');
  const agentsMd = await readFile('/Users/sjarmak/ACE_Beads_Amp/AGENTS.md', 'utf-8');
  
  const bulletMatches = agentsMd.match(/\[Bullet #[^\]]+\]/g);
  console.log('\n=== ACE Framework Self-Update ===');
  console.log(`✓ Total bullets in AGENTS.md: ${bulletMatches?.length || 0}`);
  console.log('✓ Curator learned from its own implementation!');
  
  if (bulletMatches && bulletMatches.length > 0) {
    console.log('\nLatest bullets:');
    bulletMatches.slice(-3).forEach(bullet => console.log(`  ${bullet}`));
  }
}

dogfoodACE13().catch(console.error);
