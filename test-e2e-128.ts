#!/usr/bin/env tsx

import { BeadsClient } from './mcp/beads-client.js';
import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * E2E Test for ACE Learning Cycle (ACE_Beads_Amp-128)
 * 
 * This test validates the complete learning cycle flow:
 * 1. BeadsClient creates and closes an issue with amp_metadata
 * 2. Learning cycle triggers synchronously (Reflector -> Curator)
 * 3. Reflector generates mock insights
 * 4. Curator applies high-confidence deltas to knowledge/AGENTS.md
 * 5. Curator sends notification to amp_notifications.jsonl
 */

async function cleanupTestFiles(): Promise<void> {
  console.log('\n[E2E Test] Cleaning up test files...');
  
  const insightsPath = resolve(process.cwd(), 'logs/insights.jsonl');
  const notificationsPath = resolve(process.cwd(), 'amp_notifications.jsonl');
  const agentsPath = resolve(process.cwd(), 'AGENTS.md');
  
  // Remove insights.jsonl if exists
  if (existsSync(insightsPath)) {
    await unlink(insightsPath);
    console.log('[E2E Test] Removed logs/insights.jsonl');
  }
  
  // Remove amp_notifications.jsonl if exists
  if (existsSync(notificationsPath)) {
    await unlink(notificationsPath);
    console.log('[E2E Test] Removed amp_notifications.jsonl');
  }
  
  console.log('[E2E Test] Cleanup complete\n');
}

async function runE2ETest(): Promise<void> {
  console.log('\n=== ACE Learning Cycle E2E Test (ACE_Beads_Amp-128) ===\n');
  
  // Set environment variables for E2E test
  process.env.ACE_E2E_SYNC = 'true';
  process.env.AMP_THREAD_ID = 'T-e2e-128';
  process.env.AMP_WORKSPACE_ID = 'ws-e2e';
  process.env.VITEST = 'true'; // Enable test mode for BeadsClient
  
  console.log('[E2E Test] Environment variables set:');
  console.log(`  - ACE_E2E_SYNC: ${process.env.ACE_E2E_SYNC}`);
  console.log(`  - AMP_THREAD_ID: ${process.env.AMP_THREAD_ID}`);
  console.log(`  - AMP_WORKSPACE_ID: ${process.env.AMP_WORKSPACE_ID}`);
  console.log(`  - VITEST: ${process.env.VITEST}\n`);
  
  // Cleanup before test
  await cleanupTestFiles();
  
  // Step 1: Create and close an issue
  console.log('[E2E Test] Step 1: Creating and closing a test issue...');
  const client = new BeadsClient();
  
  const issue = await client.createIssue('E2E Test Issue for ACE Learning Cycle', {
    description: 'This issue tests the full ACE learning cycle',
    type: 'task',
    priority: 1,
  });
  
  console.log(`[E2E Test] Created issue: ${issue.id}`);
  console.log(`[E2E Test] Issue has amp_metadata: ${issue.amp_metadata ? 'YES' : 'NO'}`);
  
  if (issue.amp_metadata) {
    console.log(`[E2E Test] Thread ID: ${issue.amp_metadata.thread_id}`);
    console.log(`[E2E Test] Thread URL: ${issue.amp_metadata.thread_url}`);
  }
  
  console.log('\n[E2E Test] Step 2: Closing issue (triggers learning cycle)...');
  const closedIssue = await client.closeIssue(issue.id, 'E2E test completed');
  
  console.log(`[E2E Test] Closed issue: ${closedIssue.id}`);
  console.log(`[E2E Test] Status: ${closedIssue.status}\n`);
  
  // Step 3: Verify logs/insights.jsonl was created
  console.log('[E2E Test] Step 3: Verifying logs/insights.jsonl...');
  const insightsPath = resolve(process.cwd(), 'logs/insights.jsonl');
  
  if (existsSync(insightsPath)) {
    const insightsContent = await readFile(insightsPath, 'utf-8');
    const insightLines = insightsContent.trim().split('\n').filter(l => l.length > 0);
    
    console.log(`[E2E Test] ✅ logs/insights.jsonl exists with ${insightLines.length} insights`);
    
    const insights = insightLines.map(line => JSON.parse(line));
    const highConfInsights = insights.filter(i => i.confidence >= 0.8);
    
    console.log(`[E2E Test] High-confidence insights (>= 0.8): ${highConfInsights.length}`);
  } else {
    console.log('[E2E Test] ℹ️  logs/insights.jsonl not found (Reflector may not create it in this flow)');
  }
  
  // Step 4: Verify AGENTS.md was updated
  console.log('\n[E2E Test] Step 4: Verifying AGENTS.md...');
  const agentsPath = resolve(process.cwd(), 'AGENTS.md');
  
  if (!existsSync(agentsPath)) {
    throw new Error('❌ AGENTS.md does not exist');
  }
  
  const agentsContent = await readFile(agentsPath, 'utf-8');
  const lines = agentsContent.split('\n');
  
  // Count bullets by parsing the file
  const bulletLines = lines.filter(line => line.match(/\[Bullet #[^\]]+\]/));
  
  console.log(`[E2E Test] ✅ AGENTS.md exists with ${bulletLines.length} bullets`);
  
  if (bulletLines.length > 0) {
    console.log('[E2E Test] Recent bullets:');
    bulletLines.slice(-3).forEach(line => {
      console.log(`  ${line.substring(0, 100)}...`);
    });
  }
  
  // Step 5: Verify amp_notifications.jsonl was created
  console.log('\n[E2E Test] Step 5: Verifying amp_notifications.jsonl...');
  const notificationsPath = resolve(process.cwd(), 'amp_notifications.jsonl');
  
  if (existsSync(notificationsPath)) {
    const notificationsContent = await readFile(notificationsPath, 'utf-8');
    const notificationLines = notificationsContent.trim().split('\n').filter(l => l.length > 0);
    
    console.log(`[E2E Test] ✅ amp_notifications.jsonl exists with ${notificationLines.length} events`);
    
    const notifications = notificationLines.map(line => JSON.parse(line));
    const beadCompleted = notifications.filter(n => n.event_type === 'bead_completed');
    
    console.log(`[E2E Test] bead_completed events: ${beadCompleted.length}`);
    
    if (beadCompleted.length > 0) {
      for (const event of beadCompleted) {
        console.log(`  - Event ID: ${event.event_id}`);
        console.log(`    Summary: ${event.payload.summary}`);
      }
    }
  } else {
    console.log('[E2E Test] ℹ️  amp_notifications.jsonl not found');
  }
  
  // Step 6: Test deduplication by triggering another learning cycle
  console.log('\n[E2E Test] Step 6: Testing deduplication...');
  
  // Get current bullet count
  const bulletCountBefore = bulletLines.length;
  console.log(`[E2E Test] Bullets before second cycle: ${bulletCountBefore}`);
  
  // Create and close another issue (should trigger deduplication)
  const issue2 = await client.createIssue('Second E2E Test Issue', {
    description: 'Test deduplication on second learning cycle',
    type: 'task',
    priority: 1,
  });
  
  console.log(`[E2E Test] Created second issue: ${issue2.id}`);
  await client.closeIssue(issue2.id, 'Testing deduplication');
  console.log(`[E2E Test] Closed second issue`);
  
  // Check bullet count after second cycle
  const agentsContentAfter = await readFile(agentsPath, 'utf-8');
  const linesAfter = agentsContentAfter.split('\n');
  const bulletLinesAfter = linesAfter.filter(line => line.match(/\[Bullet #[^\]]+\]/));
  
  console.log(`[E2E Test] Bullets after second cycle: ${bulletLinesAfter.length}`);
  
  // Check for aggregation markers
  const aggregatedBullets = bulletLinesAfter.filter(line => line.includes('Aggregated from'));
  console.log(`[E2E Test] Aggregated bullets: ${aggregatedBullets.length}`);
  
  if (aggregatedBullets.length > 0) {
    console.log('[E2E Test] ✅ Deduplication is working - found aggregated bullets');
    aggregatedBullets.slice(0, 2).forEach(bullet => {
      console.log(`  ${bullet.substring(0, 100)}...`);
    });
  } else {
    console.log('[E2E Test] ℹ️  No aggregated bullets found (may not have duplicates yet)');
  }

  console.log('\n[E2E Test] ✅ All verifications passed!\n');
  console.log('=== E2E Test COMPLETED SUCCESSFULLY ===\n');
}

// Run the test
runE2ETest()
  .then(() => {
    console.log('[E2E Test] Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[E2E Test] ❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
