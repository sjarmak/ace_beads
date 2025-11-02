#!/usr/bin/env tsx

import { Curator } from './src/lib/Curator.js';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Test deduplication and consolidation in Curator
 */

async function testDeduplication() {
  console.log('\n=== Testing Curator Deduplication ===\n');

  const testDir = resolve(process.cwd(), 'test-temp-curator-dedup');
  const testAgentsPath = resolve(testDir, 'AGENTS.md');
  const testInsightsPath = resolve(testDir, 'insights.jsonl');

  // Setup test directory
  if (!existsSync(testDir)) {
    await mkdir(testDir, { recursive: true });
  }

  // Create test AGENTS.md with duplicate bullets
  const testContent = `# Test AGENTS.md

## TypeScript Patterns

[Bullet #dup-1, helpful:2, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements
[Bullet #dup-2, helpful:1, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements
[Bullet #dup-3, helpful:3, harmful:1] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements

## Build & Test Patterns

[Bullet #unique-1, helpful:5, harmful:0] Always run tests before committing - Use npm test
[Bullet #dup-4, helpful:1, harmful:0] TypeScript type errors from incorrect variable assignment - Always check types
[Bullet #dup-5, helpful:2, harmful:0] TypeScript type errors from incorrect variable assignment - Always check types
`;

  await writeFile(testAgentsPath, testContent);
  console.log('[Test] Created test AGENTS.md with duplicates');
  console.log('  - 3 duplicates of "TypeScript module imports..."');
  console.log('  - 1 unique bullet');
  console.log('  - 2 duplicates of "TypeScript type errors..."\n');

  // Create empty insights file
  await writeFile(testInsightsPath, '');

  // Create Curator instance
  const curator = new Curator(testInsightsPath, testAgentsPath, 3);

  // Load bullets before deduplication
  const bulletsBefore = await curator.loadKnowledgeBullets();
  console.log(`[Test] Bullets before deduplication: ${bulletsBefore.length}`);
  bulletsBefore.forEach(b => {
    console.log(`  - ${b.id}: helpful:${b.helpful}, harmful:${b.harmful}`);
    console.log(`    "${b.content.substring(0, 60)}..."`);
  });

  // Run deduplication
  console.log('\n[Test] Running deduplication...\n');
  const consolidatedCount = await curator.deduplicateAndConsolidate();

  // Load bullets after deduplication
  const bulletsAfter = await curator.loadKnowledgeBullets();
  console.log(`\n[Test] Bullets after deduplication: ${bulletsAfter.length}`);
  console.log(`[Test] Consolidated ${consolidatedCount} duplicate groups\n`);

  bulletsAfter.forEach(b => {
    console.log(`  - ${b.id}: helpful:${b.helpful}, harmful:${b.harmful}`);
    console.log(`    "${b.content.substring(0, 80)}..."`);
  });

  // Verify results
  console.log('\n=== Verification ===\n');

  const expectedCount = 3; // 3 unique patterns
  if (bulletsAfter.length !== expectedCount) {
    throw new Error(`❌ Expected ${expectedCount} bullets after dedup, got ${bulletsAfter.length}`);
  }
  console.log(`✅ Bullet count correct: ${bulletsAfter.length}`);

  // Check that duplicates were consolidated correctly
  const tsImportBullet = bulletsAfter.find(b => 
    b.content.includes('TypeScript module imports require .js extension')
  );

  if (!tsImportBullet) {
    throw new Error('❌ TypeScript imports bullet not found');
  }

  const expectedHelpful = 2 + 1 + 3; // Sum of helpful counts
  const expectedHarmful = 0 + 0 + 1; // Sum of harmful counts

  if (tsImportBullet.helpful !== expectedHelpful) {
    throw new Error(`❌ Expected helpful:${expectedHelpful}, got ${tsImportBullet.helpful}`);
  }
  console.log(`✅ Helpful count aggregated correctly: ${tsImportBullet.helpful}`);

  if (tsImportBullet.harmful !== expectedHarmful) {
    throw new Error(`❌ Expected harmful:${expectedHarmful}, got ${tsImportBullet.harmful}`);
  }
  console.log(`✅ Harmful count aggregated correctly: ${tsImportBullet.harmful}`);

  // Check that content includes "Aggregated from X instances"
  const fileContent = await readFile(testAgentsPath, 'utf-8');
  if (!fileContent.includes('Aggregated from 3 instances')) {
    throw new Error('❌ Missing "Aggregated from 3 instances" marker');
  }
  console.log(`✅ Aggregation marker present`);

  console.log('\n=== Test PASSED ===\n');
}

// Run test
testDeduplication()
  .then(() => {
    console.log('[Test] Deduplication test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Test] ❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
