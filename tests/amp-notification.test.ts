import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { BeadsClient } from '../src/lib/beads-client.js';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Amp Notification Integration', () => {
  const notificationPath = resolve(process.cwd(), 'amp_notifications.jsonl');
  const metadataPath = resolve(process.cwd(), '.beads/amp_metadata.jsonl');
  let beads: BeadsClient;

  beforeAll(async () => {
    // Clean up files before all tests in this suite
    if (existsSync(notificationPath)) {
      await unlink(notificationPath);
    }
    if (existsSync(metadataPath)) {
      await unlink(metadataPath);
    }
  });

  beforeEach(async () => {
    // Clear all amp env vars to prevent leakage from other tests
    delete process.env.AMP_THREAD_ID;
    delete process.env.AMP_WORKSPACE_ID;
    delete process.env.ACE_ROLE;
    delete process.env.AMP_MAIN_THREAD_ID;
    delete process.env.AMP_PARENT_THREAD_ID;
    delete process.env.AMP_HANDOFF_GOAL;
    
    // Clean up files before each test to ensure isolation
    if (existsSync(notificationPath)) {
      await unlink(notificationPath);
    }
    if (existsSync(metadataPath)) {
      await unlink(metadataPath);
    }
    
    beads = new BeadsClient();
  });

  afterEach(async () => {
    // Clean up files after each test
    if (existsSync(notificationPath)) {
      await unlink(notificationPath);
    }
    if (existsSync(metadataPath)) {
      await unlink(metadataPath);
    }
    
    // Clear environment variables
    delete process.env.AMP_THREAD_ID;
    delete process.env.AMP_WORKSPACE_ID;
    delete process.env.ACE_ROLE;
    delete process.env.AMP_MAIN_THREAD_ID;
    delete process.env.AMP_PARENT_THREAD_ID;
    delete process.env.AMP_HANDOFF_GOAL;
  });

  it('should write notification when closing issue with amp_metadata', async () => {
    process.env.AMP_THREAD_ID = 'T-test-123';
    process.env.AMP_WORKSPACE_ID = 'ws-test';
    process.env.ACE_ROLE = 'generator';

    const issue = await beads.createIssue('Test notification issue', {
      type: 'task',
      priority: 2,
      description: 'Testing notification delivery',
    });

    expect(issue.amp_metadata).toBeDefined();
    expect(issue.amp_metadata?.thread_id).toBe('T-test-123');

    await beads.closeIssue(issue.id, 'Completed for test');

    expect(existsSync(notificationPath)).toBe(true);

    const content = await readFile(notificationPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(1);

    const notification = JSON.parse(lines[0]);
    expect(notification.event_type).toBe('bead_completed');
    expect(notification.bead_id).toBe(issue.id);
    expect(notification.thread_id).toBe('T-test-123');
    expect(notification.payload.summary).toContain(issue.id);

    delete process.env.AMP_THREAD_ID;
    delete process.env.AMP_WORKSPACE_ID;
    delete process.env.ACE_ROLE;
  });

  it('should not write notification when closing issue without amp_metadata', async () => {
    delete process.env.AMP_THREAD_ID;

    const issue = await beads.createIssue('Issue without thread context', {
      type: 'task',
      priority: 2,
    });

    expect(issue.amp_metadata).toBeUndefined();

    await beads.closeIssue(issue.id);

    expect(existsSync(notificationPath)).toBe(false);
  });
});
