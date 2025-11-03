import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { KnowledgeManager } from '../src/lib/knowledge.js';

describe('KnowledgeManager', () => {
  const testDir = join(process.cwd(), 'test-temp-knowledge');
  const knowledgeDir = join(testDir, 'knowledge');
  const agentsMdPath = join(knowledgeDir, 'AGENTS.md');
  const playbookPath = join(knowledgeDir, 'playbook.yaml');
  
  let km: KnowledgeManager;
  
  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(knowledgeDir, { recursive: true });
    km = new KnowledgeManager(knowledgeDir, agentsMdPath, playbookPath);
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('validateWriteScope (security-critical)', () => {
    it('should allow writes to knowledge/ directory', async () => {
      await expect(km.writeAgentsMd('# Test')).resolves.not.toThrow();
      expect(existsSync(agentsMdPath)).toBe(true);
    });

    it('should allow writes to prompts/ directory', async () => {
      const promptsPath = join(testDir, 'prompts', 'test.md');
      const kmPrompts = new KnowledgeManager(testDir, promptsPath, playbookPath);
      await expect(kmPrompts.writeAgentsMd('# Test')).resolves.not.toThrow();
    });

    it('should reject writes outside knowledge/ and prompts/', async () => {
      const maliciousPath = join(testDir, 'etc', 'passwd');
      const kmBad = new KnowledgeManager(testDir, maliciousPath, playbookPath);
      
      await expect(kmBad.writeAgentsMd('# Malicious')).rejects.toThrow(
        /Write scope violation.*outside knowledge\/ and prompts\//
      );
    });

    it('should reject writes to parent directory traversal', async () => {
      const traversalPath = join(testDir, 'knowledge', '..', '..', 'etc', 'passwd');
      const kmTraversal = new KnowledgeManager(testDir, traversalPath, playbookPath);
      
      await expect(kmTraversal.writeAgentsMd('# Traversal')).rejects.toThrow(
        /Write scope violation/
      );
    });

    it('should handle Windows paths correctly', async () => {
      const windowsPath = join(testDir, 'knowledge\\AGENTS.md').replace(/\//g, '\\');
      const kmWindows = new KnowledgeManager(testDir, windowsPath, playbookPath);
      await expect(kmWindows.writeAgentsMd('# Windows')).resolves.not.toThrow();
    });
  });

  describe('AGENTS.md read/write', () => {
    it('should write and read AGENTS.md content', async () => {
      const content = '# Test Content\n\n## Section\nBullet point';
      
      await km.writeAgentsMd(content);
      const readContent = await km.loadAgentsMd();
      
      expect(readContent).toBe(content);
    });

    it('should return empty string if AGENTS.md does not exist', async () => {
      const content = await km.loadAgentsMd();
      expect(content).toBe('');
    });

    it('should create parent directories when writing', async () => {
      const deepPath = join(knowledgeDir, 'sub', 'dir', 'AGENTS.md');
      const kmDeep = new KnowledgeManager(knowledgeDir, deepPath, playbookPath);
      
      await kmDeep.writeAgentsMd('# Deep');
      expect(existsSync(deepPath)).toBe(true);
    });
  });

  describe('Playbook read/write round-trip', () => {
    it('should write and read playbook with sections', async () => {
      const playbook = {
        version: '0.3',
        sections: [
          { id: 'build-patterns', weight: 1.2 },
          { id: 'test-patterns', weight: 0.8 },
        ],
      };
      
      await km.writePlaybook(playbook);
      const loaded = await km.loadPlaybook();
      
      expect(loaded.version).toBe('0.3');
      expect(loaded.sections).toHaveLength(2);
      expect(loaded.sections[0]).toEqual({ id: 'build-patterns', weight: 1.2 });
      expect(loaded.sections[1]).toEqual({ id: 'test-patterns', weight: 0.8 });
    });

    it('should return default playbook if file does not exist', async () => {
      const playbook = await km.loadPlaybook();
      
      expect(playbook.version).toBe('0.3');
      expect(playbook.sections).toEqual([]);
    });

    it('should sort sections by id for determinism', async () => {
      const playbook = {
        version: '0.3',
        sections: [
          { id: 'z-last', weight: 1.0 },
          { id: 'a-first', weight: 2.0 },
          { id: 'm-middle', weight: 1.5 },
        ],
      };
      
      await km.writePlaybook(playbook);
      const loaded = await km.loadPlaybook();
      
      // Should be sorted alphabetically by id
      expect(loaded.sections.map(s => s.id)).toEqual(['a-first', 'm-middle', 'z-last']);
    });

    it('should handle empty sections array', async () => {
      const playbook = {
        version: '0.4',
        sections: [],
      };
      
      await km.writePlaybook(playbook);
      const loaded = await km.loadPlaybook();
      
      expect(loaded.version).toBe('0.4');
      expect(loaded.sections).toEqual([]);
    });

    it('should handle malformed YAML gracefully', async () => {
      writeFileSync(playbookPath, 'invalid: yaml: content: [[[', 'utf-8');
      
      const playbook = await km.loadPlaybook();
      
      expect(playbook.version).toBe('0.3');
      expect(playbook.sections).toEqual([]);
    });
  });

  describe('deterministic serialization', () => {
    it('should produce identical YAML for same playbook', async () => {
      const playbook = {
        version: '0.3',
        sections: [
          { id: 'patterns', weight: 1.5 },
          { id: 'rules', weight: 2.0 },
        ],
      };
      
      await km.writePlaybook(playbook);
      const firstWrite = await km.loadPlaybook();
      
      await km.writePlaybook(firstWrite);
      const secondWrite = await km.loadPlaybook();
      
      expect(JSON.stringify(firstWrite)).toBe(JSON.stringify(secondWrite));
    });
  });
});
