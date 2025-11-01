#!/usr/bin/env tsx
/**
 * Manual test for Curator - simulates the full flow:
 * 1. Reflector generates mock insights
 * 2. Curator reads and applies deltas
 * 3. Verifies AGENTS.md is updated
 */

import { Reflector } from './mcp/Reflector.js';
import { Curator } from './mcp/Curator.js';
import { readFile, unlink } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

async function testCurator() {
  console.log('=== Manual Curator Test ===\n');

  // Clean up previous test files
  const insightsPath = resolve(process.cwd(), 'insights.jsonl');
  const knowledgePath = resolve(process.cwd(), 'knowledge/AGENTS.md');
  
  if (existsSync(insightsPath)) {
    await unlink(insightsPath);
    console.log('Cleaned up previous insights.jsonl');
  }

  // Step 1: Simulate Reflector generating insights
  console.log('\n1. Generating mock insights via Reflector...');
  const reflector = new Reflector();
  await reflector.analyzeBeadClosure('test-session-123');
  
  // Verify insights were created
  if (existsSync(insightsPath)) {
    const insights = await readFile(insightsPath, 'utf-8');
    const lineCount = insights.trim().split('\n').length;
    console.log(`   ✓ Created ${lineCount} insights in insights.jsonl`);
  }

  // Step 2: Read AGENTS.md before
  const beforeContent = await readFile(knowledgePath, 'utf-8');
  const beforeLineCount = beforeContent.split('\n').length;
  console.log(`\n2. AGENTS.md before: ${beforeLineCount} lines`);

  // Step 3: Run Curator
  console.log('\n3. Running Curator...');
  const curator = new Curator();
  await curator.run();

  // Step 4: Verify AGENTS.md after
  const afterContent = await readFile(knowledgePath, 'utf-8');
  const afterLineCount = afterContent.split('\n').length;
  console.log(`\n4. AGENTS.md after: ${afterLineCount} lines`);
  
  if (afterLineCount > beforeLineCount) {
    console.log(`   ✓ Added ${afterLineCount - beforeLineCount} lines`);
    
    // Show the new bullets
    const newLines = afterContent.split('\n').slice(beforeLineCount);
    console.log('\n   New bullets added:');
    newLines.forEach(line => {
      if (line.trim()) console.log(`   ${line}`);
    });
  } else {
    console.log('   ✗ No lines added to AGENTS.md');
  }

  console.log('\n=== Test Complete ===');
}

testCurator().catch(console.error);
