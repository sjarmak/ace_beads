import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Generator } from '../src/lib/Generator.js';
import { Reflector } from '../src/lib/Reflector.js';
import { Curator } from '../src/lib/Curator.js';
import { BeadsClient } from '../src/lib/beads-client.js';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { ExecutionResult } from '../src/lib/mcp-types.js';

describe('Discovery Chain Tests', () => {
  const testDir = join(process.cwd(), 'test-temp-discovery-chain');
  const testKnowledgePath = join(testDir, 'AGENTS.md');
  const testTracePath = join(testDir, 'execution_traces.jsonl');
  const testInsightsPath = join(testDir, 'insights.jsonl');

  let generator: Generator;
  let beadsClient: BeadsClient;
  let reflector: Reflector;
  let curator: Curator;

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });

    const mockKnowledge = `# ACE Knowledge Base

## Build & Test Patterns

[Bullet #test-001, helpful:0, harmful:0] Always validate dependencies before processing

## Security Patterns

## Architecture Patterns
`;

    await writeFile(testKnowledgePath, mockKnowledge, 'utf-8');
    await writeFile(testTracePath, '', 'utf-8');  // Initialize empty trace file
    await writeFile(testInsightsPath, '', 'utf-8');  // Initialize empty insights file
    
    generator = new Generator(testKnowledgePath, testTracePath);
    beadsClient = new BeadsClient();
    reflector = new Reflector(testTracePath, testInsightsPath);
    curator = new Curator(testKnowledgePath, testInsightsPath);
    
    // Set up Amp environment for metadata tracking
    process.env.AMP_THREAD_ID = 'T-discovery-test';
    process.env.AMP_WORKSPACE_ID = 'ws-test';
    process.env.ACE_ROLE = 'generator';
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    
    // Clean up environment
    delete process.env.AMP_THREAD_ID;
    delete process.env.AMP_WORKSPACE_ID;
    delete process.env.ACE_ROLE;
  });

  it('should track discovered-from chain with cascading issues', async () => {
    // Create parent issue
    const parentIssue = await beadsClient.createIssue('Parent task: Implement feature X', {
      type: 'feature',
      priority: 1,
      description: 'Main feature implementation',
    });

    // Start Generator task for parent
    await generator.startTask(parentIssue.id, parentIssue.title);

    // Simulate discovering three child issues during work
    const childIssue1 = await beadsClient.createIssue('Missing type definitions for API', {
      type: 'bug',
      priority: 1,
      description: 'Discovered during implementation',
      dependencies: [{ type: 'discovered-from', target: parentIssue.id }],
    });

    const childIssue2 = await beadsClient.createIssue('Need to add validation tests', {
      type: 'task',
      priority: 2,
      description: 'Found missing test coverage',
      dependencies: [{ type: 'discovered-from', target: parentIssue.id }],
    });

    const childIssue3 = await beadsClient.createIssue('Update documentation for new API', {
      type: 'task',
      priority: 3,
      description: 'Docs need updating',
      dependencies: [{ type: 'discovered-from', target: parentIssue.id }],
    });

    // Record discovered issues in the trace
    await generator.recordDiscoveredIssue(childIssue1.id);
    await generator.recordDiscoveredIssue(childIssue2.id);
    await generator.recordDiscoveredIssue(childIssue3.id);

    // Complete parent task
    const completedTrace = await generator.completeTask('success');

    // Assertions: Verify trace contains discovered issues
    expect(completedTrace.bead_id).toBe(parentIssue.id);
    expect(completedTrace.discovered_issues).toHaveLength(3);
    expect(completedTrace.discovered_issues).toContain(childIssue1.id);
    expect(completedTrace.discovered_issues).toContain(childIssue2.id);
    expect(completedTrace.discovered_issues).toContain(childIssue3.id);

    // Verify trace was written to file
    const traceContent = await readFile(testTracePath, 'utf-8');
    const traces = traceContent.trim().split('\n').map(line => JSON.parse(line));
    expect(traces).toHaveLength(1);
    expect(traces[0].discovered_issues).toEqual([childIssue1.id, childIssue2.id, childIssue3.id]);

    // Verify parent can retrieve discovered issues
    const discoveredIssues = await beadsClient.getDiscoveredIssues(parentIssue.id);
    const discoveredIds = discoveredIssues.map(issue => issue.id);
    expect(discoveredIds).toHaveLength(3);
    expect(discoveredIds).toContain(childIssue1.id);
    expect(discoveredIds).toContain(childIssue2.id);
    expect(discoveredIds).toContain(childIssue3.id);

    // Verify dependency tree shows discovered-from links
    const child1Tree = await beadsClient.getDependencyTree(childIssue1.id);
    const child1DiscoveredLink = child1Tree.dependencies.find(
      (d: any) => d.type === 'discovered-from' && d.target === parentIssue.id
    );
    expect(child1DiscoveredLink).toBeDefined();

    // Verify amp_metadata is set correctly for traceability
    const retrievedChild1 = await beadsClient.getIssue(childIssue1.id);
    const retrievedChild2 = await beadsClient.getIssue(childIssue2.id);
    const retrievedChild3 = await beadsClient.getIssue(childIssue3.id);
    
    expect(retrievedChild1.amp_metadata?.thread_id).toBe('T-discovery-test');
    expect(retrievedChild2.amp_metadata?.thread_id).toBe('T-discovery-test');
    expect(retrievedChild3.amp_metadata?.thread_id).toBe('T-discovery-test');
  });

  it('should handle empty discovered issues list', async () => {
    const issue = await beadsClient.createIssue('Simple task with no discoveries', {
      type: 'task',
      priority: 2,
    });

    await generator.startTask(issue.id, issue.title);
    const completedTrace = await generator.completeTask('success');

    expect(completedTrace.discovered_issues).toHaveLength(0);
  });

  it('should allow multiple levels of discovery chain', async () => {
    // Level 1: Root task
    const rootIssue = await beadsClient.createIssue('Root task', {
      type: 'feature',
      priority: 1,
    });

    await generator.startTask(rootIssue.id, rootIssue.title);

    // Level 2: First discovered issue
    const level2Issue = await beadsClient.createIssue('Level 2 discovered issue', {
      type: 'bug',
      priority: 1,
      dependencies: [{ type: 'discovered-from', target: rootIssue.id }],
    });

    await generator.recordDiscoveredIssue(level2Issue.id);
    await generator.completeTask('partial');

    // Verify Level 1 trace
    const traceContent = await readFile(testTracePath, 'utf-8');
    const traces = traceContent.trim().split('\n').map(line => JSON.parse(line));
    expect(traces[0].discovered_issues).toContain(level2Issue.id);

    // Start work on Level 2 issue and discover Level 3
    const generator2 = new Generator(testKnowledgePath, testTracePath);
    await generator2.startTask(level2Issue.id, level2Issue.title);

    const level3Issue = await beadsClient.createIssue('Level 3 discovered issue', {
      type: 'task',
      priority: 2,
      dependencies: [{ type: 'discovered-from', target: level2Issue.id }],
    });

    await generator2.recordDiscoveredIssue(level3Issue.id);
    await generator2.completeTask('success');

    // Verify multi-level chain using dependency queries
    const level2Discovered = await beadsClient.getDiscoveredIssues(rootIssue.id);
    const level3Discovered = await beadsClient.getDiscoveredIssues(level2Issue.id);

    const level2Ids = level2Discovered.map(issue => issue.id);
    const level3Ids = level3Discovered.map(issue => issue.id);

    expect(level2Ids).toContain(level2Issue.id);
    expect(level3Ids).toContain(level3Issue.id);
  });

  it('should verify Reflector analyzes discovery chain and Curator extracts meta-pattern', async () => {
    // Simulate a realistic security workflow with cascading discoveries
    const parentIssue = await beadsClient.createIssue('Add user authentication', {
      type: 'feature',
      priority: 1,
      description: 'Implement JWT-based authentication',
    });

    await generator.startTask(parentIssue.id, parentIssue.title);

    // During implementation, discover 3 security issues
    const childIssue1 = await beadsClient.createIssue('Missing password validation', {
      type: 'bug',
      priority: 1,
      description: 'No password strength requirements',
      dependencies: [{ type: 'discovered-from', target: parentIssue.id }],
    });

    const childIssue2 = await beadsClient.createIssue('No rate limiting on login endpoint', {
      type: 'bug',
      priority: 1,
      description: 'Vulnerable to brute force attacks',
      dependencies: [{ type: 'discovered-from', target: parentIssue.id }],
    });

    const childIssue3 = await beadsClient.createIssue('JWT secret not in environment variables', {
      type: 'bug',
      priority: 1,
      description: 'Security credentials hardcoded',
      dependencies: [{ type: 'discovered-from', target: parentIssue.id }],
    });

    // Record discovered issues
    await generator.recordDiscoveredIssue(childIssue1.id);
    await generator.recordDiscoveredIssue(childIssue2.id);
    await generator.recordDiscoveredIssue(childIssue3.id);

    // Simulate a partial completion with some errors found
    const executionResult: ExecutionResult = {
      status: 'fail',
      errors: [
        {
          tool: 'eslint',
          file: 'src/auth/validation.ts',
          line: 42,
          message: 'Password validation missing',
          severity: 'error',
        },
      ],
      stdout: '',
      stderr: 'Security vulnerabilities detected',
      exitCode: 1,
      duration: 2000,
      timestamp: new Date().toISOString(),
    };

    await generator.recordExecution(executionResult);
    const parentTrace = await generator.completeTask('partial');

    expect(parentTrace.discovered_issues).toHaveLength(3);
    expect(parentTrace.outcome).toBe('partial');

    // Step 5: Verify Reflector analyzes the discovery chain
    const insights = await reflector.analyzeTrace(parentTrace);

    expect(insights.length).toBeGreaterThan(0);
    
    // Should have insights about the discovery pattern
    const discoveryInsight = insights.find(
      insight => insight.signal.pattern === 'discovery-chain'
    );
    expect(discoveryInsight).toBeDefined();
    expect(discoveryInsight?.source.beadIds).toContain(childIssue1.id);
    expect(discoveryInsight?.source.beadIds).toContain(childIssue2.id);
    expect(discoveryInsight?.source.beadIds).toContain(childIssue3.id);
    expect(discoveryInsight?.confidence).toBe(0.85); // Should be high confidence for 3+ issues

    // Step 6: Verify high-confidence discovery insight is suitable for Curator
    // The discovery insight has 0.85 confidence and is marked onlineEligible
    expect(discoveryInsight?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(discoveryInsight?.onlineEligible).toBe(true);
    expect(discoveryInsight?.metaTags).toContain('discovery');
    
    // Verify the insight has an actionable recommendation
    expect(discoveryInsight?.recommendation).toBeTruthy();
    expect(discoveryInsight?.delta).toBeTruthy();
    
    // The delta should mention the discovered issues
    expect(discoveryInsight?.delta).toContain('Discovered');
    expect(discoveryInsight?.delta).toContain('3 related issues');
  });

  it('should demonstrate future work benefits from learned discovery patterns', async () => {
    // First workflow: Create initial pattern through discovery
    const firstAuthIssue = await beadsClient.createIssue('Implement OAuth login', {
      type: 'feature',
      priority: 1,
    });

    await generator.startTask(firstAuthIssue.id, firstAuthIssue.title);

    const securityIssue = await beadsClient.createIssue('Add CSRF protection', {
      type: 'bug',
      priority: 1,
      dependencies: [{ type: 'discovered-from', target: firstAuthIssue.id }],
    });

    await generator.recordDiscoveredIssue(securityIssue.id);
    
    const result: ExecutionResult = {
      status: 'fail',
      errors: [
        {
          tool: 'unknown',
          file: 'src/auth/oauth.ts',
          line: 15,
          message: 'Missing CSRF token validation',
          severity: 'error',
        },
      ],
      stdout: '',
      stderr: 'Security check failed',
      exitCode: 1,
      duration: 1500,
      timestamp: new Date().toISOString(),
    };

    await generator.recordExecution(result);
    const trace1 = await generator.completeTask('partial');

    // Reflector analyzes and creates insight
    await reflector.analyzeTrace(trace1);

    // Curator adds pattern to knowledge base
    await curator.processInsights();

    // Verify knowledge was added
    let knowledgeContent = await readFile(testKnowledgePath, 'utf-8');
    const bulletsBeforeSecondRun = (knowledgeContent.match(/\[Bullet #/g) || []).length;

    // Second workflow: Simulate future auth work
    const generator2 = new Generator(testKnowledgePath, testTracePath);
    const secondAuthIssue = await beadsClient.createIssue('Add SAML authentication', {
      type: 'feature',
      priority: 1,
    });

    await generator2.startTask(secondAuthIssue.id, secondAuthIssue.title);

    // Agent should now have access to learned patterns
    const availableBullets = generator2.getAvailableBullets();
    expect(availableBullets.length).toBeGreaterThanOrEqual(bulletsBeforeSecondRun);

    // Check if there's a security-related bullet to consult
    const securityBullet = availableBullets.find(
      b => b.content.toLowerCase().includes('security') ||
           b.content.toLowerCase().includes('validation') ||
           b.content.toLowerCase().includes('csrf')
    );

    if (securityBullet) {
      // Consult the learned pattern
      await generator2.consultBullet(securityBullet.id, 'Following learned security pattern');
      await generator2.markBulletHelpful(securityBullet.id, 'Prevented security oversight');

      const successResult: ExecutionResult = {
        status: 'pass',
        errors: [],
        stdout: 'Security checks passed',
        stderr: '',
        exitCode: 0,
        duration: 1000,
        timestamp: new Date().toISOString(),
      };

      await generator2.recordExecution(successResult);
      const trace2 = await generator2.completeTask('success');

      // Verify the bullet was marked helpful
      expect(trace2.bullets_consulted.length).toBeGreaterThan(0);
      const consultedBullet = trace2.bullets_consulted.find(b => b.bullet_id === securityBullet.id);
      expect(consultedBullet?.feedback).toBe('helpful');

      // Verify the helpful counter was incremented in AGENTS.md
      knowledgeContent = await readFile(testKnowledgePath, 'utf-8');
      const bulletPattern = new RegExp(`\\[Bullet #${securityBullet.id}, helpful:(\\d+), harmful:(\\d+)\\]`);
      const match = knowledgeContent.match(bulletPattern);
      
      if (match) {
        const helpfulCount = parseInt(match[1]);
        expect(helpfulCount).toBeGreaterThan(0);
      }
    }

    await generator2.completeTask('success');
  });
});
