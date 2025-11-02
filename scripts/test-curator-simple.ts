import { Curator } from '../src/lib/Curator.js';
import { BeadIssue } from '../src/lib/beads-client.js';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';

async function setupTestEnvironment() {
  await mkdir('/Users/sjarmak/ACE_Beads_Amp/logs', { recursive: true });
  await mkdir('/Users/sjarmak/ACE_Beads_Amp/knowledge', { recursive: true });
}

async function createMockReflectorInsight(beadId: string) {
  const insightsPath = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl';
  
  const mockInsight = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    taskId: beadId,
    source: {
      beadIds: [beadId],
    },
    signal: {
      pattern: 'TypeScript build errors require running tsc before tests',
      evidence: [
        'Build failed with type errors in Curator.ts',
        'Test execution blocked by compilation errors',
      ],
    },
    recommendation: 'Always run npm run build before npm test to catch type errors early',
    scope: {
      glob: '**/*.ts',
    },
    confidence: 0.9,
    onlineEligible: true,
    metaTags: ['typescript', 'build', 'testing'],
  };

  await appendFile(insightsPath, JSON.stringify(mockInsight) + '\n');
  console.log(`✓ Created mock reflector insight for ${beadId}`);
}

async function testCuratorSimple() {
  console.log('=== Testing Curator (Simple Mode - No Embeddings) ===\n');

  await setupTestEnvironment();

  const mockBead: BeadIssue = {
    id: 'ACE_Beads_Amp-TEST1',
    title: 'Test TypeScript compilation workflow',
    description: 'Verify build-test cycle works correctly',
    status: 'closed',
    priority: 1,
    issue_type: 'task',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: new Date().toISOString(),
  };

  console.log(`Creating mock bead: ${mockBead.id}`);
  await createMockReflectorInsight(mockBead.id);

  const knowledgePath = '/Users/sjarmak/ACE_Beads_Amp/knowledge/AGENT.md';
  const initialContent = `# ACE Knowledge Base

## Build & Test Patterns
<!-- Curator adds patterns here -->

`;
  await writeFile(knowledgePath, initialContent);
  console.log(`✓ Initialized ${knowledgePath}\n`);

  const curator = new Curator(knowledgePath);
  
  console.log('Running curator.updateKnowledge()...\n');
  await curator.updateKnowledge(mockBead);

  const { readFile } = await import('fs/promises');
  const updatedContent = await readFile(knowledgePath, 'utf-8');
  
  console.log('\n=== Updated AGENT.md ===');
  console.log(updatedContent);
  
  console.log('\n=== Test Summary ===');
  const bulletCount = (updatedContent.match(/\[Bullet #/g) || []).length;
  console.log(`✓ Bullets added: ${bulletCount}`);
  console.log(`✓ Knowledge base size: ${updatedContent.split(/\s+/).length} words`);
  
  if (bulletCount > 0) {
    console.log('\n✅ Curator test PASSED - Knowledge updated successfully!');
  } else {
    console.log('\n❌ Curator test FAILED - No bullets were added');
  }
}

testCuratorSimple().catch(console.error);
