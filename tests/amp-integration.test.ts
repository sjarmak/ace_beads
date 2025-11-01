import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { BeadsClient } from '../mcp/beads-client.js';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Amp Thread Integration', () => {
  let client: BeadsClient;
  const testMetadataPath = resolve(process.cwd(), '.beads/amp_metadata_integration.jsonl');
  const testNotificationPath = resolve(process.cwd(), 'amp_notifications_integration.jsonl');
  let originalEnv: NodeJS.ProcessEnv;
  let createdBeadIds: string[] = [];

  beforeAll(() => {
    // Save original environment at suite level
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore environment at suite level
    process.env = { ...originalEnv };
  });

  beforeEach(() => {
    // Clean environment before each test
    delete process.env.AMP_THREAD_ID;
    delete process.env.AMP_WORKSPACE_ID;
    delete process.env.ACE_ROLE;
    delete process.env.AMP_MAIN_THREAD_ID;
    delete process.env.AMP_PARENT_THREAD_ID;
    delete process.env.AMP_HANDOFF_GOAL;
    
    client = new BeadsClient({
      metadataPath: testMetadataPath,
      notificationPath: testNotificationPath,
    });
    createdBeadIds = [];
  });

  afterEach(async () => {
    // Clean environment after each test
    delete process.env.AMP_THREAD_ID;
    delete process.env.AMP_WORKSPACE_ID;
    delete process.env.ACE_ROLE;
    delete process.env.AMP_MAIN_THREAD_ID;
    delete process.env.AMP_PARENT_THREAD_ID;
    delete process.env.AMP_HANDOFF_GOAL;
    
    // Clean up created beads
    for (const beadId of createdBeadIds) {
      try {
        await client.closeIssue(beadId, 'Test cleanup');
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Clean up test files
    if (existsSync(testNotificationPath)) {
      await unlink(testNotificationPath).catch(() => {});
    }
    if (existsSync(testMetadataPath)) {
      await unlink(testMetadataPath).catch(() => {});
    }
  });

  describe('Thread Context Detection', () => {
    it('should capture thread context when AMP_THREAD_ID is set', async () => {
      process.env.AMP_THREAD_ID = 'T-test-12345678';
      process.env.AMP_WORKSPACE_ID = 'ws-test-workspace';
      process.env.ACE_ROLE = 'generator';

      const issue = await client.createIssue('Test issue with thread context', {
        type: 'task',
        priority: 2,
      });
      createdBeadIds.push(issue.id);

      expect(issue.amp_metadata).toBeDefined();
      expect(issue.amp_metadata?.thread_id).toBe('T-test-12345678');
      expect(issue.amp_metadata?.thread_url).toBe('https://ampcode.com/threads/T-test-12345678');
      expect(issue.amp_metadata?.workspace_id).toBe('ws-test-workspace');
      expect(issue.amp_metadata?.created_by_agent).toBe('generator');
      expect(issue.amp_metadata?.created_in_context).toBe('main-thread');
    });

    it('should detect subagent context when AMP_MAIN_THREAD_ID is set', async () => {
      process.env.AMP_THREAD_ID = 'T-child-87654321';
      process.env.AMP_MAIN_THREAD_ID = 'T-parent-12345678';
      process.env.AMP_WORKSPACE_ID = 'ws-test';

      const issue = await client.createIssue('Test subagent issue', {
        type: 'task',
        priority: 2,
      });
      createdBeadIds.push(issue.id);

      expect(issue.amp_metadata?.created_in_context).toBe('subagent-thread');
      expect(issue.amp_metadata?.main_thread_id).toBe('T-parent-12345678');
    });

    it('should detect handoff context', async () => {
      process.env.AMP_THREAD_ID = 'T-handoff-99999999';
      process.env.AMP_PARENT_THREAD_ID = 'T-parent-88888888';
      process.env.AMP_HANDOFF_GOAL = 'Fix authentication bug';
      process.env.AMP_WORKSPACE_ID = 'ws-test';

      const issue = await client.createIssue('Test handoff issue', {
        type: 'bug',
        priority: 1,
      });
      createdBeadIds.push(issue.id);

      expect(issue.amp_metadata?.parent_thread_id).toBe('T-parent-88888888');
      expect(issue.amp_metadata?.handoff_goal).toBe('Fix authentication bug');
    });

    it('should not capture thread context when AMP_THREAD_ID is not set', async () => {
      delete process.env.AMP_THREAD_ID;

      const issue = await client.createIssue('Test issue without thread', {
        type: 'task',
        priority: 2,
      });
      createdBeadIds.push(issue.id);

      expect(issue.amp_metadata).toBeUndefined();
    });
  });

  describe('Thread Metadata Persistence', () => {
    it('should save thread metadata to JSONL file', async () => {
      process.env.AMP_THREAD_ID = 'T-persist-test-123';
      process.env.AMP_WORKSPACE_ID = 'ws-persist';

      const issue = await client.createIssue('Test metadata persistence', {
        type: 'task',
        priority: 2,
      });
      createdBeadIds.push(issue.id);

      // Read the metadata file
      const content = await readFile(testMetadataPath, 'utf-8');
      const lines = content.trim().split('\n');
      const lastEntry = JSON.parse(lines[lines.length - 1]);

      expect(lastEntry.bead_id).toBe(issue.id);
      expect(lastEntry.thread_id).toBe('T-persist-test-123');
      expect(lastEntry.workspace_id).toBe('ws-persist');
    });

    it('should load thread metadata when getting issue', async () => {
      process.env.AMP_THREAD_ID = 'T-load-test-456';
      process.env.AMP_WORKSPACE_ID = 'ws-load';

      const created = await client.createIssue('Test metadata loading', {
        type: 'task',
        priority: 2,
      });
      createdBeadIds.push(created.id);

      // Get the issue again
      const loaded = await client.getIssue(created.id);

      expect(loaded.amp_metadata).toBeDefined();
      expect(loaded.amp_metadata?.thread_id).toBe('T-load-test-456');
      expect(loaded.amp_metadata?.workspace_id).toBe('ws-load');
    });
  });

  describe('Notification Generation', () => {
    it('should write notification when issue is closed', async () => {
      process.env.AMP_THREAD_ID = 'T-notify-test-789';
      process.env.AMP_WORKSPACE_ID = 'ws-notify';

      const issue = await client.createIssue('Test notification', {
        type: 'task',
        priority: 2,
      });
      createdBeadIds.push(issue.id);

      // Record current notification count
      let beforeCount = 0;
      if (existsSync(testNotificationPath)) {
        const content = await readFile(testNotificationPath, 'utf-8');
        beforeCount = content.trim().split('\n').filter(l => l).length;
      }

      // Close the issue
      await client.closeIssue(issue.id, 'Test completed');

      // Check notification was written
      const content = await readFile(testNotificationPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);
      expect(lines.length).toBe(beforeCount + 1);

      const notification = JSON.parse(lines[lines.length - 1]);
      expect(notification.bead_id).toBe(issue.id);
      expect(notification.thread_id).toBe('T-notify-test-789');
      expect(notification.event_type).toBe('bead_completed');
      expect(notification.payload.summary).toContain(issue.id);
    });

    it('should not write notification when closing issue without thread context', async () => {
      delete process.env.AMP_THREAD_ID;

      const issue = await client.createIssue('Test no notification', {
        type: 'task',
        priority: 2,
      });
      createdBeadIds.push(issue.id);

      let beforeCount = 0;
      if (existsSync(testNotificationPath)) {
        const content = await readFile(testNotificationPath, 'utf-8');
        beforeCount = content.trim().split('\n').filter(l => l).length;
      }

      await client.closeIssue(issue.id, 'Test completed');

      let afterCount = 0;
      if (existsSync(testNotificationPath)) {
        const content = await readFile(testNotificationPath, 'utf-8');
        afterCount = content.trim().split('\n').filter(l => l).length;
      }

      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('Dependency Tracking', () => {
    it('should support discovered-from dependency type', async () => {
      process.env.AMP_THREAD_ID = 'T-dep-test-111';
      process.env.AMP_WORKSPACE_ID = 'ws-dep';

      const parent = await client.createIssue('Parent issue', {
        type: 'feature',
        priority: 1,
      });
      createdBeadIds.push(parent.id);

      const child = await client.createIssue('Child issue', {
        type: 'task',
        priority: 2,
        dependencies: [{ type: 'discovered-from', target: parent.id }],
      });
      createdBeadIds.push(child.id);

      const discoveredIssues = await client.getDiscoveredIssues(parent.id);
      expect(discoveredIssues.map(i => i.id)).toContain(child.id);
    });
  });
});
