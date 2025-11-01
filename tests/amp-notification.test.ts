import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BeadsClient } from '../mcp/beads-client.js';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';

describe('Amp Notification Integration', () => {
  const notificationPath = '/Users/sjarmak/ACE_Beads_Amp/amp_notifications.jsonl';
  let beads: BeadsClient;

  beforeEach(() => {
    beads = new BeadsClient();
    if (existsSync(notificationPath)) {
      unlink(notificationPath).catch(() => {});
    }
  });

  afterEach(async () => {
    if (existsSync(notificationPath)) {
      await unlink(notificationPath);
    }
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
