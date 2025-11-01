#!/usr/bin/env tsx
/**
 * Test harmful bullet archival
 */

import { Curator } from './mcp/Curator.js';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

async function testArchival() {
  console.log('=== Testing Harmful Bullet Archival ===\n');

  const knowledgePath = resolve(process.cwd(), 'knowledge/AGENTS.md');
  const archivePath = resolve(process.cwd(), 'knowledge/AGENTS.archive.md');

  // Add test bullets with harmful counts >= 2
  const testBullets = `
[Bullet #test-harmful-1, helpful:1, harmful:3] This advice is harmful - Should be archived
[Bullet #test-good-1, helpful:5, harmful:0] This advice is good - Should stay
[Bullet #test-harmful-2, helpful:0, harmful:2] This also harmful - Should be archived
[Bullet #test-mixed-1, helpful:3, harmful:1] This is mixed but ok - Should stay
`;

  const beforeContent = await readFile(knowledgePath, 'utf-8');
  await writeFile(knowledgePath, beforeContent + testBullets);
  
  console.log('1. Added test bullets to AGENTS.md');
  console.log('   - 2 harmful bullets (harmful >= 2)');
  console.log('   - 2 good bullets (harmful < 2)');

  // Run curator
  console.log('\n2. Running Curator...');
  const curator = new Curator();
  await curator.run();

  // Check results
  const afterContent = await readFile(knowledgePath, 'utf-8');
  const archivedContent = await readFile(archivePath, 'utf-8');

  console.log('\n3. Results:');
  console.log(`   AGENTS.md has ${afterContent.split('\n').length} lines`);
  console.log(`   AGENTS.archive.md has ${archivedContent.split('\n').length} lines`);

  const hasHarmful1 = afterContent.includes('test-harmful-1');
  const hasHarmful2 = afterContent.includes('test-harmful-2');
  const hasGood1 = afterContent.includes('test-good-1');
  const hasMixed1 = afterContent.includes('test-mixed-1');

  console.log(`\n   Harmful bullets removed: ${!hasHarmful1 && !hasHarmful2 ? '✓' : '✗'}`);
  console.log(`   Good bullets kept: ${hasGood1 && hasMixed1 ? '✓' : '✗'}`);
  
  const archivedHarmful1 = archivedContent.includes('test-harmful-1');
  const archivedHarmful2 = archivedContent.includes('test-harmful-2');
  console.log(`   Harmful bullets archived: ${archivedHarmful1 && archivedHarmful2 ? '✓' : '✗'}`);

  console.log('\n=== Test Complete ===');
}

testArchival().catch(console.error);
