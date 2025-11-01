import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BeadsClient } from '../mcp/beads-client.js';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';

describe('JSON Export Feature', () => {
  let client: BeadsClient;
  const testExportPath = '/tmp/beads-export-test.json';
  let createdBeadIds: string[] = [];

  beforeEach(() => {
    client = new BeadsClient();
    createdBeadIds = [];
  });

  afterEach(async () => {
    // Clean up test file
    if (existsSync(testExportPath)) {
      await unlink(testExportPath);
    }
    
    // Clean up created beads
    for (const beadId of createdBeadIds) {
      try {
        await client.closeIssue(beadId, 'Test cleanup');
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  it('should export all issues to JSON file', async () => {
    // Create a test issue
    const issue = await client.createIssue('Test export issue', {
      type: 'task',
      priority: 2,
      description: 'Testing JSON export',
    });
    createdBeadIds.push(issue.id);

    // Export to JSON
    await client.exportToJson(testExportPath);

    // Verify file exists
    expect(existsSync(testExportPath)).toBe(true);

    // Read and parse the exported file
    const content = await readFile(testExportPath, 'utf-8');
    const exportData = JSON.parse(content);

    // Verify structure
    expect(exportData).toHaveProperty('exported_at');
    expect(exportData).toHaveProperty('total_issues');
    expect(exportData).toHaveProperty('issues');
    expect(Array.isArray(exportData.issues)).toBe(true);

    // Verify our test issue is in the export
    const exportedIssue = exportData.issues.find((i: any) => i.id === issue.id);
    expect(exportedIssue).toBeDefined();
    expect(exportedIssue.title).toBe('Test export issue');
  }, 10000);
});
