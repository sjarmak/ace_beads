import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BeadsEventBridge, BeadEvent } from '../mcp/BeadsEventBridge.js';
import { writeFile, mkdir, rm, appendFile } from 'fs/promises';
import { join } from 'path';
import { BeadIssue } from '../src/lib/beads-client.js';

describe('BeadsEventBridge', () => {
  const testDir = join(process.cwd(), 'test-temp-event-bridge');
  const testIssuesPath = join(testDir, 'issues.jsonl');
  let bridge: BeadsEventBridge;

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    await writeFile(testIssuesPath, '', 'utf-8');
    bridge = new BeadsEventBridge(testIssuesPath);
  });

  afterEach(async () => {
    bridge.stop();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should detect new issue creation', async () => {
    const events: BeadEvent[] = [];
    
    bridge.on('issueCreated', (event: BeadEvent) => {
      events.push(event);
    });

    await bridge.start();

    const now = new Date().toISOString();
    const newIssue: BeadIssue = {
      id: 'bd-1',
      title: 'Test issue',
      description: 'Test description',
      status: 'open',
      priority: 2,
      issue_type: 'task',
      created_at: now,
      updated_at: now,
    };

    await appendFile(testIssuesPath, JSON.stringify(newIssue) + '\n');

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('issueCreated');
    expect(events[0].issue.id).toBe('bd-1');
    expect(events[0].issue.title).toBe('Test issue');
  }, 10000);

  it('should detect issue updates', async () => {
    const events: BeadEvent[] = [];

    const createdAt = new Date(Date.now() - 5000).toISOString();
    const updatedAt = new Date().toISOString();

    const initialIssue: BeadIssue = {
      id: 'bd-2',
      title: 'Initial issue',
      description: 'Initial description',
      status: 'open',
      priority: 2,
      issue_type: 'task',
      created_at: createdAt,
      updated_at: createdAt,
    };

    await writeFile(testIssuesPath, JSON.stringify(initialIssue) + '\n', 'utf-8');

    bridge.on('issueUpdated', (event: BeadEvent) => {
      events.push(event);
    });

    await bridge.start();

    const updatedIssue: BeadIssue = {
      ...initialIssue,
      status: 'in_progress',
      updated_at: updatedAt,
    };

    await appendFile(testIssuesPath, JSON.stringify(updatedIssue) + '\n');

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('issueUpdated');
    expect(events[0].issue.status).toBe('in_progress');
  }, 10000);

  it('should detect issue closure', async () => {
    const events: BeadEvent[] = [];

    const createdAt = new Date(Date.now() - 10000).toISOString();
    const closedAt = new Date().toISOString();

    const initialIssue: BeadIssue = {
      id: 'bd-3',
      title: 'Completed issue',
      description: 'Will be closed',
      status: 'in_progress',
      priority: 1,
      issue_type: 'bug',
      created_at: createdAt,
      updated_at: createdAt,
    };

    await writeFile(testIssuesPath, JSON.stringify(initialIssue) + '\n', 'utf-8');

    bridge.on('issueClosed', (event: BeadEvent) => {
      events.push(event);
    });

    await bridge.start();

    const closedIssue: BeadIssue = {
      ...initialIssue,
      status: 'closed',
      closed_at: closedAt,
      updated_at: closedAt,
    };

    await appendFile(testIssuesPath, JSON.stringify(closedIssue) + '\n');

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('issueClosed');
    expect(events[0].issue.status).toBe('closed');
    expect(events[0].issue.closed_at).toBeDefined();
  }, 10000);

  it('should emit generic beadEvent for all event types', async () => {
    const events: BeadEvent[] = [];

    bridge.on('beadEvent', (event: BeadEvent) => {
      events.push(event);
    });

    await bridge.start();

    const now = new Date().toISOString();
    const issue1: BeadIssue = {
      id: 'bd-4',
      title: 'Issue 1',
      description: '',
      status: 'open',
      priority: 2,
      issue_type: 'task',
      created_at: now,
      updated_at: now,
    };

    const issue2: BeadIssue = {
      id: 'bd-5',
      title: 'Issue 2',
      description: '',
      status: 'open',
      priority: 2,
      issue_type: 'task',
      created_at: now,
      updated_at: now,
    };

    await appendFile(testIssuesPath, JSON.stringify(issue1) + '\n');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    await appendFile(testIssuesPath, JSON.stringify(issue2) + '\n');
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].issue.id).toBe('bd-4');
    expect(events[1].issue.id).toBe('bd-5');
  }, 10000);

  it('should handle multiple new lines at once', async () => {
    const events: BeadEvent[] = [];

    bridge.on('beadEvent', (event: BeadEvent) => {
      events.push(event);
    });

    await bridge.start();

    const now = new Date().toISOString();
    const issues: BeadIssue[] = [
      {
        id: 'bd-6',
        title: 'Issue 6',
        description: '',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'bd-7',
        title: 'Issue 7',
        description: '',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'bd-8',
        title: 'Issue 8',
        description: '',
        status: 'open',
        priority: 2,
        issue_type: 'task',
        created_at: now,
        updated_at: now,
      },
    ];

    const content = issues.map(i => JSON.stringify(i)).join('\n') + '\n';
    await appendFile(testIssuesPath, content);

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBe(3);
    expect(events.map(e => e.issue.id)).toEqual(['bd-6', 'bd-7', 'bd-8']);
  }, 10000);

  it('should emit error event on invalid JSON', async () => {
    const errors: Error[] = [];

    bridge.on('error', (error: Error) => {
      errors.push(error);
    });

    await bridge.start();

    await appendFile(testIssuesPath, 'invalid json line\n');

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('Failed to parse line');
  }, 10000);

  it('should stop watching when stop is called', async () => {
    const events: BeadEvent[] = [];

    bridge.on('beadEvent', (event: BeadEvent) => {
      events.push(event);
    });

    await bridge.start();
    bridge.stop();

    const now = new Date().toISOString();
    const issue: BeadIssue = {
      id: 'bd-9',
      title: 'Should not be detected',
      description: '',
      status: 'open',
      priority: 2,
      issue_type: 'task',
      created_at: now,
      updated_at: now,
    };

    await appendFile(testIssuesPath, JSON.stringify(issue) + '\n');

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(events.length).toBe(0);
  }, 10000);
});
