import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BeadsClient } from '../src/lib/beads-client.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

describe('BeadsClient - Stub Mode', () => {
  let client: BeadsClient;
  let tempDir: string;

  beforeEach(() => {
    // Force test mode
    process.env.VITEST = 'true';
    
    // Create temp directory for metadata files
    tempDir = join(tmpdir(), `beads-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    
    const metadataPath = join(tempDir, '.beads/amp_metadata.jsonl');
    const notificationPath = join(tempDir, 'amp_notifications.jsonl');
    
    client = new BeadsClient({
      metadataPath,
      notificationPath,
    });
    
    // Reset stub state before each test
    client.resetStub();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.VITEST;
  });

  describe('createIssue', () => {
    it('should create issue with required fields only', async () => {
      const issue = await client.createIssue('Test issue');

      expect(issue).toMatchObject({
        id: expect.stringMatching(/^bd-\d+$/),
        title: 'Test issue',
        description: '',
        status: 'open',
        priority: 2,
        issue_type: 'task',
      });
      expect(issue.created_at).toBeDefined();
      expect(issue.updated_at).toBeDefined();
    });

    it('should create issue with all optional fields', async () => {
      const issue = await client.createIssue('Feature request', {
        description: 'Add new feature',
        type: 'feature',
        priority: 1,
        labels: ['enhancement', 'urgent'],
        assignee: 'alice',
      });

      expect(issue).toMatchObject({
        title: 'Feature request',
        description: 'Add new feature',
        status: 'open',
        priority: 1,
        issue_type: 'feature',
        labels: ['enhancement', 'urgent'],
        assignee: 'alice',
      });
    });

    it('should create issue with dependencies', async () => {
      const parent = await client.createIssue('Parent task');
      const child = await client.createIssue('Child task', {
        dependencies: [
          { type: 'blocks', target: parent.id },
        ],
      });

      expect(child.id).toBeDefined();
      
      const tree = await client.getDependencyTree(child.id);
      expect(tree.dependencies).toContainEqual({
        source: child.id,
        target: parent.id,
        type: 'blocks',
      });
    });

    it('should generate sequential IDs', async () => {
      const issue1 = await client.createIssue('First');
      const issue2 = await client.createIssue('Second');
      const issue3 = await client.createIssue('Third');

      expect(issue1.id).toBe('bd-1');
      expect(issue2.id).toBe('bd-2');
      expect(issue3.id).toBe('bd-3');
    });
  });

  describe('listIssues', () => {
    beforeEach(async () => {
      await client.createIssue('Open bug', { type: 'bug', priority: 1 });
      await client.createIssue('Open feature', { type: 'feature', priority: 2 });
      await client.createIssue('In progress task', { type: 'task', priority: 1 });
      await client.updateIssue('bd-3', { status: 'in_progress' });
    });

    it('should list all issues without filters', async () => {
      const issues = await client.listIssues();
      expect(issues).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const openIssues = await client.listIssues({ status: 'open' });
      expect(openIssues).toHaveLength(2);
      expect(openIssues.every(i => i.status === 'open')).toBe(true);

      const inProgressIssues = await client.listIssues({ status: 'in_progress' });
      expect(inProgressIssues).toHaveLength(1);
      expect(inProgressIssues[0].id).toBe('bd-3');
    });

    it('should filter by priority', async () => {
      const p1Issues = await client.listIssues({ priority: 1 });
      expect(p1Issues).toHaveLength(2);
      expect(p1Issues.every(i => i.priority === 1)).toBe(true);
    });

    it('should filter by type', async () => {
      const bugs = await client.listIssues({ type: 'bug' });
      expect(bugs).toHaveLength(1);
      expect(bugs[0].issue_type).toBe('bug');

      const features = await client.listIssues({ type: 'feature' });
      expect(features).toHaveLength(1);
      expect(features[0].issue_type).toBe('feature');
    });

    it('should combine multiple filters', async () => {
      const p1Open = await client.listIssues({ status: 'open', priority: 1 });
      expect(p1Open).toHaveLength(1);
      expect(p1Open[0].id).toBe('bd-1');
    });
  });

  describe('getIssue', () => {
    it('should retrieve existing issue', async () => {
      const created = await client.createIssue('Test task');
      const retrieved = await client.getIssue(created.id);

      expect(retrieved).toMatchObject({
        id: created.id,
        title: 'Test task',
        status: 'open',
      });
    });

    it('should throw error for non-existent issue', async () => {
      await expect(client.getIssue('bd-999')).rejects.toThrow('Issue bd-999 not found');
    });
  });

  describe('updateIssue', () => {
    it('should update issue status', async () => {
      const issue = await client.createIssue('Task to update');
      const updated = await client.updateIssue(issue.id, { status: 'in_progress' });

      expect(updated.status).toBe('in_progress');
      expect(updated.updated_at).toBeDefined();
    });

    it('should update issue priority', async () => {
      const issue = await client.createIssue('Task', { priority: 2 });
      const updated = await client.updateIssue(issue.id, { priority: 1 });

      expect(updated.priority).toBe(1);
    });

    it('should update issue assignee', async () => {
      const issue = await client.createIssue('Task');
      const updated = await client.updateIssue(issue.id, { assignee: 'bob' });

      expect(updated.assignee).toBe('bob');
    });

    it('should throw error for non-existent issue', async () => {
      await expect(client.updateIssue('bd-999', { status: 'closed' })).rejects.toThrow(
        'Issue bd-999 not found'
      );
    });
  });

  describe('closeIssue', () => {
    it('should close issue and set closed_at timestamp', async () => {
      const issue = await client.createIssue('Task to close');
      const closed = await client.closeIssue(issue.id);

      expect(closed.status).toBe('closed');
      expect(closed.closed_at).toBeDefined();
      expect(closed.updated_at).toBe(closed.closed_at);
    });

    it('should accept optional reason parameter', async () => {
      const issue = await client.createIssue('Task to close');
      const closed = await client.closeIssue(issue.id, 'Completed successfully');

      expect(closed.status).toBe('closed');
    });

    it('should throw error for non-existent issue', async () => {
      await expect(client.closeIssue('bd-999')).rejects.toThrow('Issue bd-999 not found');
    });
  });

  describe('dependencies', () => {
    it('should add blocks dependency', async () => {
      const blocker = await client.createIssue('Blocker');
      const blocked = await client.createIssue('Blocked');

      await client.addDependency(blocked.id, blocker.id, 'blocks');

      const tree = await client.getDependencyTree(blocked.id);
      expect(tree.dependencies).toContainEqual({
        source: blocked.id,
        target: blocker.id,
        type: 'blocks',
      });
    });

    it('should add related dependency', async () => {
      const issue1 = await client.createIssue('Issue 1');
      const issue2 = await client.createIssue('Issue 2');

      await client.addDependency(issue1.id, issue2.id, 'related');

      const tree = await client.getDependencyTree(issue1.id);
      expect(tree.dependencies).toContainEqual({
        source: issue1.id,
        target: issue2.id,
        type: 'related',
      });
    });

    it('should add parent-child dependency', async () => {
      const parent = await client.createIssue('Parent');
      const child = await client.createIssue('Child');

      await client.addDependency(child.id, parent.id, 'parent-child');

      const tree = await client.getDependencyTree(parent.id);
      expect(tree.dependencies).toContainEqual({
        source: child.id,
        target: parent.id,
        type: 'parent-child',
      });
    });

    it('should add discovered-from dependency', async () => {
      const parent = await client.createIssue('Parent task');
      const discovered = await client.createIssue('Discovered issue');

      await client.addDependency(discovered.id, parent.id, 'discovered-from');

      const tree = await client.getDependencyTree(parent.id);
      expect(tree.dependencies).toContainEqual({
        source: discovered.id,
        target: parent.id,
        type: 'discovered-from',
      });
    });
  });

  describe('getDiscoveredIssues', () => {
    it('should retrieve issues discovered from parent', async () => {
      const parent = await client.createIssue('Parent task');
      const discovered1 = await client.createIssue('Discovered bug 1');
      const discovered2 = await client.createIssue('Discovered bug 2');
      const unrelated = await client.createIssue('Unrelated task');

      await client.addDependency(discovered1.id, parent.id, 'discovered-from');
      await client.addDependency(discovered2.id, parent.id, 'discovered-from');

      const discoveredIssues = await client.getDiscoveredIssues(parent.id);

      expect(discoveredIssues).toHaveLength(2);
      expect(discoveredIssues.map(i => i.id)).toContain(discovered1.id);
      expect(discoveredIssues.map(i => i.id)).toContain(discovered2.id);
      expect(discoveredIssues.map(i => i.id)).not.toContain(unrelated.id);
    });

    it('should return empty array when no discovered issues exist', async () => {
      const parent = await client.createIssue('Parent task');
      const discoveredIssues = await client.getDiscoveredIssues(parent.id);

      expect(discoveredIssues).toHaveLength(0);
    });

    it('should not return issues with other dependency types', async () => {
      const parent = await client.createIssue('Parent task');
      const blocker = await client.createIssue('Blocker');
      const related = await client.createIssue('Related');

      await client.addDependency(blocker.id, parent.id, 'blocks');
      await client.addDependency(related.id, parent.id, 'related');

      const discoveredIssues = await client.getDiscoveredIssues(parent.id);

      expect(discoveredIssues).toHaveLength(0);
    });
  });

  describe('exportToJson', () => {
    it('should export all issues to JSON file', async () => {
      await client.createIssue('Task 1');
      await client.createIssue('Task 2');
      await client.createIssue('Task 3');

      const exportPath = join(tempDir, 'export.json');
      await client.exportToJson(exportPath);

      const { readFileSync } = await import('fs');
      const exported = JSON.parse(readFileSync(exportPath, 'utf-8'));

      expect(exported.total_issues).toBe(3);
      expect(exported.issues).toHaveLength(3);
      expect(exported.exported_at).toBeDefined();
    });
  });
});
