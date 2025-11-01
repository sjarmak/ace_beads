import { describe, it, expect, beforeEach } from 'vitest';
import { GuardedFileSystem } from '../mcp/guarded-fs.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('GuardedFileSystem', () => {
  const testDir = join(process.cwd(), 'test-temp-guarded-fs');
  let gfs: GuardedFileSystem;

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'knowledge'), { recursive: true });
    gfs = new GuardedFileSystem(testDir);
  });

  describe('Generator permissions', () => {
    it('should allow generator to read any file', async () => {
      await writeFile(join(testDir, 'test.ts'), 'content');
      const content = await gfs.read('generator', 'test.ts');
      expect(content).toBe('content');
    });

    it('should allow generator to write to regular files', async () => {
      await gfs.write('generator', 'output.ts', 'test content');
      const content = await gfs.read('generator', 'output.ts');
      expect(content).toBe('test content');
    });

    it('should deny generator write to AGENT.md', async () => {
      await expect(
        gfs.write('generator', 'knowledge/AGENT.md', 'forbidden')
      ).rejects.toThrow('Permission denied');
    });

    it('should deny generator write to insights.jsonl', async () => {
      await expect(
        gfs.write('generator', 'knowledge/insights.jsonl', 'forbidden')
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('Reflector permissions', () => {
    it('should allow reflector to read files', async () => {
      await writeFile(join(testDir, 'test.ts'), 'content');
      const content = await gfs.read('reflector', 'test.ts');
      expect(content).toBe('content');
    });

    it('should deny reflector write to regular files', async () => {
      await expect(
        gfs.write('reflector', 'test.ts', 'forbidden')
      ).rejects.toThrow('Permission denied');
    });

    it('should allow reflector to append to insights.jsonl', async () => {
      await gfs.append('reflector', 'knowledge/insights.jsonl', '{"test": true}');
      const content = await gfs.read('reflector', 'knowledge/insights.jsonl');
      expect(content).toContain('{"test": true}');
    });
  });

  describe('Curator permissions', () => {
    it('should allow curator to read files', async () => {
      await writeFile(join(testDir, 'test.ts'), 'content');
      const content = await gfs.read('curator', 'test.ts');
      expect(content).toBe('content');
    });

    it('should allow curator to write to AGENT.md', async () => {
      await gfs.write('curator', 'knowledge/AGENT.md', '# Knowledge');
      const content = await gfs.read('curator', 'knowledge/AGENT.md');
      expect(content).toBe('# Knowledge');
    });

    it('should deny curator write to regular files', async () => {
      await expect(
        gfs.write('curator', 'test.ts', 'forbidden')
      ).rejects.toThrow('Permission denied');
    });

    it('should deny curator write to insights.jsonl', async () => {
      await expect(
        gfs.write('curator', 'knowledge/insights.jsonl', 'forbidden')
      ).rejects.toThrow('Permission denied');
    });
  });
});
