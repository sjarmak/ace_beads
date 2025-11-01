#!/usr/bin/env node
import { BeadsClient } from '../mcp/beads-client.js';
import { ExecutionRunner } from '../mcp/exec-runner.js';
import { GuardedFileSystem } from '../mcp/guarded-fs.js';

/**
 * Test script to validate ACE learning cycle
 * 
 * Workflow:
 * 1. Create a test task in Beads
 * 2. Simulate Generator executing the task
 * 3. Run build/test to get execution feedback
 * 4. Simulate Reflector analyzing the feedback
 * 5. Simulate Curator updating knowledge/AGENT.md
 */

async function main() {
  const beads = new BeadsClient();
  const exec = new ExecutionRunner(process.cwd());
  const gfs = new GuardedFileSystem(process.cwd());

  console.log('=== ACE Learning Cycle Test ===\n');

  // Step 1: Create test task
  console.log('Step 1: Creating test task...');
  const task = await beads.createIssue('Test ACE learning cycle', {
    type: 'task',
    priority: 1,
    description: 'Validate that ACE framework can learn from execution feedback',
  });
  console.log(`Created task: ${task.id}\n`);

  // Step 2: Claim task (simulating Generator)
  console.log('Step 2: Claiming task (Generator)...');
  await beads.updateIssue(task.id, { status: 'in_progress' });
  console.log('Task claimed\n');

  // Step 3: Execute build to get feedback
  console.log('Step 3: Running build for execution feedback...');
  const buildResult = await exec.runBuild();
  console.log(`Build status: ${buildResult.status}`);
  console.log(`Errors found: ${buildResult.errors.length}\n`);

  if (buildResult.errors.length > 0) {
    console.log('Errors detected:');
    buildResult.errors.slice(0, 3).forEach((err) => {
      console.log(`  - ${err.file}:${err.line || '?'} [${err.tool}] ${err.message}`);
    });
    console.log();

    // Simulate discovering issues
    for (const error of buildResult.errors.slice(0, 2)) {
      const discoveredIssue = await beads.createIssue(
        `Fix ${error.code || 'error'} in ${error.file}`,
        {
          type: 'bug',
          priority: 1,
          description: error.message,
          dependencies: [{ type: 'discovered-from', target: task.id }],
        }
      );
      console.log(`Discovered issue: ${discoveredIssue.id}`);
    }
    console.log();
  }

  // Step 4: Close original task
  console.log('Step 4: Closing task...');
  await beads.closeIssue(task.id, 'Test cycle completed');
  console.log('Task closed\n');

  // Step 5: Simulate Reflector analysis
  console.log('Step 5: Analyzing execution (Reflector)...');
  const discoveredIssues = await beads.getDiscoveredIssues(task.id);
  console.log(`Found ${discoveredIssues.length} discovered issues`);

  if (discoveredIssues.length > 0) {
    const insight = {
      pattern: 'Build errors often come in clusters',
      trigger: 'When build fails with multiple errors',
      action: 'Prioritize fixing root cause errors first, then re-run build',
      evidence: [task.id, ...discoveredIssues.map((i) => i.id)],
      confidence: 'high',
    };

    console.log('Generated insight:');
    console.log(JSON.stringify(insight, null, 2));
    console.log();

    // Step 6: Simulate Curator updating AGENT.md
    console.log('Step 6: Updating knowledge base (Curator)...');
    const currentKnowledge = await gfs.read('curator', 'knowledge/AGENT.md');
    const bulletCount = (currentKnowledge.match(/\[Bullet #/g) || []).length;
    const nextBulletId = bulletCount + 1;

    const newBullet = `- [Bullet #${nextBulletId}, helpful:0, harmful:0] ${insight.pattern}. ${insight.action}. Evidence: ${insight.evidence.join(', ')}`;

    const updatedKnowledge = currentKnowledge.replace(
      '## Build & Test Patterns\n<!-- Curator adds build/test insights here -->',
      `## Build & Test Patterns\n<!-- Curator adds build/test insights here -->\n${newBullet}`
    );

    await gfs.write('curator', 'knowledge/AGENT.md', updatedKnowledge);
    console.log(`Added Bullet #${nextBulletId} to knowledge/AGENT.md`);
    console.log();
  }

  console.log('=== ACE Learning Cycle Complete ===');
  console.log('\nSummary:');
  console.log(`- Task ${task.id}: ${buildResult.status}`);
  console.log(`- Discovered issues: ${discoveredIssues.length}`);
  console.log(`- Knowledge base updated: ${discoveredIssues.length > 0 ? 'Yes' : 'No'}`);
}

main().catch(console.error);
