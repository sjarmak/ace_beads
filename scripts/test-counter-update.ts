import { Curator } from '../agents/Curator.js';
import { BeadIssue } from '../mcp/beads-client.js';
import { appendFile, readFile } from 'fs/promises';
import { randomUUID } from 'crypto';

async function testCounterUpdate() {
  console.log('=== Testing Bullet Counter Updates ===\n');

  const insightsPath = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl';
  
  const mockInsight = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    taskId: 'ACE_Beads_Amp-13',
    source: {
      beadIds: ['ACE_Beads_Amp-13'],
    },
    signal: {
      pattern: 'Feedback on existing bullet',
      evidence: ['Used bullet #91ca8f2b successfully'],
    },
    recommendation: 'This is just to trigger bullet_updates',
    scope: {},
    confidence: 0.8,
    onlineEligible: true,
    metaTags: ['test'],
  };

  await appendFile(insightsPath, JSON.stringify(mockInsight) + '\n');

  const beforeContent = await readFile('/Users/sjarmak/ACE_Beads_Amp/AGENTS.md', 'utf-8');
  const beforeMatch = beforeContent.match(/\[Bullet #91ca8f2b, helpful:(\d+), harmful:(\d+)\]/);
  
  if (!beforeMatch) {
    console.error('❌ Bullet #91ca8f2b not found in AGENTS.md');
    return;
  }

  console.log(`Before: Bullet #91ca8f2b has helpful:${beforeMatch[1]}, harmful:${beforeMatch[2]}`);

  const curator = new Curator(
    '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
    '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md'
  );
  
  console.log('\nTesting helpful feedback...');
  await curator['updateBulletCounter']('91ca8f2b', 'helpful');
  
  let afterContent = await readFile('/Users/sjarmak/ACE_Beads_Amp/AGENTS.md', 'utf-8');
  let afterMatch = afterContent.match(/\[Bullet #91ca8f2b, helpful:(\d+), harmful:(\d+)\]/);
  
  console.log(`After helpful: Bullet #91ca8f2b has helpful:${afterMatch![1]}, harmful:${afterMatch![2]}`);
  
  console.log('\nTesting harmful feedback...');
  await curator['updateBulletCounter']('91ca8f2b', 'harmful');
  
  afterContent = await readFile('/Users/sjarmak/ACE_Beads_Amp/AGENTS.md', 'utf-8');
  afterMatch = afterContent.match(/\[Bullet #91ca8f2b, helpful:(\d+), harmful:(\d+)\]/);
  
  console.log(`After harmful: Bullet #91ca8f2b has helpful:${afterMatch![1]}, harmful:${afterMatch![2]}`);
  
  const helpfulInc = parseInt(afterMatch![1]) - parseInt(beforeMatch[1]);
  const harmfulInc = parseInt(afterMatch![2]) - parseInt(beforeMatch[2]);
  
  console.log('\n=== Results ===');
  if (helpfulInc === 1 && harmfulInc === 1) {
    console.log('✅ Counter updates working correctly!');
    console.log(`   helpful: ${beforeMatch[1]} → ${afterMatch![1]} (+${helpfulInc})`);
    console.log(`   harmful: ${beforeMatch[2]} → ${afterMatch![2]} (+${harmfulInc})`);
  } else {
    console.log('❌ Counter updates failed');
    console.log(`   Expected +1 helpful, +1 harmful`);
    console.log(`   Got +${helpfulInc} helpful, +${harmfulInc} harmful`);
  }
}

testCounterUpdate().catch(console.error);
