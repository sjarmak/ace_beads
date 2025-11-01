import { Curator } from '../agents/Curator.js';
import { BeadIssue } from '../mcp/beads-client.js';
import { appendFile, mkdir, writeFile, readFile } from 'fs/promises';
import { randomUUID } from 'crypto';

async function setupTestEnvironment() {
  await mkdir('/Users/sjarmak/ACE_Beads_Amp/logs', { recursive: true });
  await mkdir('/Users/sjarmak/ACE_Beads_Amp/test-temp', { recursive: true });
}

async function createReflectorInsight(beadId: string, pattern: string, recommendation: string, confidence: number = 0.9) {
  const insightsPath = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl';
  
  const mockInsight = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    taskId: beadId,
    source: {
      beadIds: [beadId],
    },
    signal: {
      pattern: pattern,
      evidence: [
        `Pattern observed in ${beadId}`,
        'Consistent behavior across similar tasks',
      ],
    },
    recommendation: recommendation,
    scope: {
      glob: '**/*.ts',
    },
    confidence: confidence,
    onlineEligible: true,
    metaTags: ['test', 'validation'],
  };

  await appendFile(insightsPath, JSON.stringify(mockInsight) + '\n');
  console.log(`✓ Created reflector insight for ${beadId}: "${pattern.substring(0, 50)}..."`);
}

async function testCuratorSimilarity() {
  console.log('=== Testing Curator Semantic Similarity ===\n');

  await setupTestEnvironment();

  const knowledgePath = '/Users/sjarmak/ACE_Beads_Amp/test-temp/AGENT-similarity-test.md';
  const initialContent = `# ACE Knowledge Base - Similarity Test

## Validation Patterns
<!-- Curator adds patterns here -->

`;
  await writeFile(knowledgePath, initialContent);
  console.log(`✓ Initialized ${knowledgePath}\n`);

  // Create first bead with first insight
  const bead1: BeadIssue = {
    id: 'ACE_Beads_Amp-SIM1',
    title: 'Test input validation pattern A',
    description: 'First variant of validation pattern',
    status: 'closed',
    priority: 1,
    issue_type: 'task',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: new Date().toISOString(),
  };

  const pattern1 = 'Always validate user input before processing';
  const recommendation1 = 'Implement input validation at API boundaries to prevent malformed data from entering the system';

  console.log('Step 1: Creating first insight...');
  console.log(`  Pattern: "${pattern1}"`);
  await createReflectorInsight(bead1.id, pattern1, recommendation1);

  const curator = new Curator(knowledgePath);
  
  console.log('\nRunning curator.updateKnowledge() for first insight...');
  await curator.updateKnowledge(bead1);

  let content = await readFile(knowledgePath, 'utf-8');
  let bulletCount = (content.match(/\[Bullet #/g) || []).length;
  
  console.log(`\n✓ After first insight: ${bulletCount} bullet(s) in knowledge base`);
  
  if (bulletCount === 0) {
    console.log('❌ FAILED: First insight did not create a bullet');
    return;
  }

  const firstBulletMatch = content.match(/\[Bullet #(\S+), helpful:(\d+), harmful:(\d+)\]/);
  if (!firstBulletMatch) {
    console.log('❌ FAILED: Could not parse first bullet');
    return;
  }
  
  const bulletId = firstBulletMatch[1];
  const helpfulBefore = parseInt(firstBulletMatch[2]);
  const harmfulBefore = parseInt(firstBulletMatch[3]);
  
  console.log(`  Bullet ID: #${bulletId}`);
  console.log(`  Counters: helpful:${helpfulBefore}, harmful:${harmfulBefore}`);

  // Create second bead with very similar insight
  const bead2: BeadIssue = {
    id: 'ACE_Beads_Amp-SIM2',
    title: 'Test input validation pattern B',
    description: 'Second variant of validation pattern (near duplicate)',
    status: 'closed',
    priority: 1,
    issue_type: 'task',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: new Date().toISOString(),
  };

  const pattern2 = 'Validate all user inputs prior to processing them';
  const recommendation2 = 'Add input validation checks before processing user-supplied data';

  console.log('\n\nStep 2: Creating second, similar insight...');
  console.log(`  Pattern: "${pattern2}"`);
  await createReflectorInsight(bead2.id, pattern2, recommendation2);

  console.log('\nRunning curator.updateKnowledge() for second insight...');
  await curator.updateKnowledge(bead2);

  content = await readFile(knowledgePath, 'utf-8');
  bulletCount = (content.match(/\[Bullet #/g) || []).length;
  
  console.log(`\n✓ After second insight: ${bulletCount} bullet(s) in knowledge base`);

  // Parse the updated bullet
  const updatedBulletRegex = new RegExp(`\\[Bullet #${bulletId}, helpful:(\\d+), harmful:(\\d+)\\]`);
  const updatedMatch = content.match(updatedBulletRegex);
  
  if (!updatedMatch) {
    console.log('❌ FAILED: Original bullet not found after second insight');
    return;
  }

  const helpfulAfter = parseInt(updatedMatch[1]);
  const harmfulAfter = parseInt(updatedMatch[2]);

  console.log(`\n=== Results ===`);
  console.log(`Original Bullet #${bulletId}:`);
  console.log(`  Before: helpful:${helpfulBefore}, harmful:${harmfulBefore}`);
  console.log(`  After:  helpful:${helpfulAfter}, harmful:${harmfulAfter}`);
  
  console.log(`\n\nFinal knowledge base content:`);
  console.log('---');
  console.log(content);
  console.log('---');

  // Validation
  const success = bulletCount === 1 && helpfulAfter === helpfulBefore + 1;
  
  if (success) {
    console.log('\n✅ TEST PASSED:');
    console.log('   - Similar insights detected (similarity > 0.85)');
    console.log('   - Existing bullet updated instead of creating duplicate');
    console.log(`   - Helpful counter incremented: ${helpfulBefore} → ${helpfulAfter}`);
    console.log('   - No duplicate bullets created');
  } else {
    console.log('\n❌ TEST FAILED:');
    if (bulletCount > 1) {
      console.log(`   - Expected 1 bullet, got ${bulletCount} (duplicate created)`);
    }
    if (helpfulAfter !== helpfulBefore + 1) {
      console.log(`   - Expected helpful to increment by 1, got ${helpfulAfter - helpfulBefore}`);
    }
  }
}

testCuratorSimilarity().catch(console.error);
