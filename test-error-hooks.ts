#!/usr/bin/env tsx

import { Generator } from './agents/Generator.js';
import { Reflector } from './agents/Reflector.js';
import { ErrorHooks } from './src/error-hooks.js';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Test error capture hooks
 * 
 * Creates intentional TypeScript errors and verifies they're captured and analyzed
 */

async function testErrorHooks() {
  console.log('\n=== Testing Error Capture Hooks ===\n');

  const testDir = resolve(process.cwd(), 'test-temp-error-hooks');
  const tracesPath = resolve(testDir, 'execution_traces.jsonl');
  const insightsPath = resolve(testDir, 'insights.jsonl');
  const knowledgePath = resolve(testDir, 'AGENT.md');
  const testFilePath = resolve(testDir, 'test-file.ts');

  // Setup
  if (!existsSync(testDir)) {
    await mkdir(testDir, { recursive: true });
  }

  // Create test file with TypeScript errors
  const errorCode = `
// This file has intentional TypeScript errors for testing
const foo: string = 123; // Type error
import { nonexistent } from './missing'; // Import error

function test() {
  const bar = undefinedVar; // Reference error
}
`;

  await writeFile(testFilePath, errorCode);
  await writeFile(knowledgePath, '# Test Knowledge Base\n\n## TypeScript Patterns\n');

  console.log('[Test] Created test file with TypeScript errors');

  // Initialize Generator and error hooks
  const generator = new Generator(knowledgePath, tracesPath);
  const hooks = new ErrorHooks(generator);

  // Start task
  await generator.startTask('test-bead-123', 'Test error capture');

  // Run TypeScript compiler (should fail)
  console.log('\n[Test] Running tsc on file with errors...\n');

  const result = await hooks.runWithErrorCapture({
    beadId: 'test-bead-123',
    command: `npx tsc --noEmit ${testFilePath}`,
    tool: 'tsc',
    cwd: testDir,
  });

  console.log(`\n[Test] Execution result: ${result.status}`);
  console.log(`[Test] Captured ${result.errors.length} errors:`);

  for (const error of result.errors) {
    console.log(`  - ${error.file}:${error.line || '?'} - ${error.message.substring(0, 60)}...`);
  }

  // Complete task
  const completedTrace = await generator.completeTask('failure');

  // Run Reflector to analyze the trace
  console.log('\n[Test] Running Reflector analysis...\n');

  const reflector = new Reflector(insightsPath, tracesPath);
  const insights = await reflector.analyzeTrace(completedTrace);

  console.log(`[Test] Reflector generated ${insights.length} insights:`);

  for (const insight of insights) {
    console.log(`\n  Insight: ${insight.signal.pattern}`);
    console.log(`    Confidence: ${insight.confidence}`);
    console.log(`    Recommendation: ${insight.recommendation}`);
    console.log(`    Evidence: ${insight.signal.evidence.length} items`);
  }

  // Cleanup
  console.log('\n[Test] Cleaning up test files...');
  await unlink(testFilePath);

  // Verify
  console.log('\n=== Verification ===\n');

  if (result.status !== 'fail') {
    throw new Error('❌ Expected execution to fail');
  }
  console.log('✅ Execution failed as expected');

  if (result.errors.length === 0) {
    throw new Error('❌ Expected errors to be captured');
  }
  console.log(`✅ Captured ${result.errors.length} errors`);

  if (insights.length === 0) {
    throw new Error('❌ Expected Reflector to generate insights');
  }
  console.log(`✅ Generated ${insights.length} insights`);

  console.log('\n=== Test PASSED ===\n');
}

// Run test
testErrorHooks()
  .then(() => {
    console.log('[Test] Error hooks test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Test] ❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
