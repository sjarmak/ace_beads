import { describe, it, expect } from 'vitest';
import {
  parseKnowledgeBullets,
  parseKnowledgeBulletsWithProvenance,
  updateBulletCountersInMarkdown,
  findSectionIndex,
  findInsertPosition,
  countBullets,
  extractBulletById,
  removeBulletById,
  serializeBullets,
  BULLET_PATTERN,
  FLEXIBLE_BULLET_PATTERN,
} from '../src/lib/knowledge-utils.js';
import type { KnowledgeBullet } from '../src/lib/types.js';

describe('knowledge-utils', () => {
  describe('BULLET_PATTERN', () => {
    it('should match simple bullet format', () => {
      const line = '[Bullet #abc123, helpful:5, harmful:2] This is a pattern';
      const match = line.match(BULLET_PATTERN);
      
      expect(match).toBeTruthy();
      expect(match![1]).toBe('abc123');
      expect(match![2]).toBe('5');
      expect(match![3]).toBe('2');
      expect(match![4]).toBeUndefined();
      expect(match![5]).toBe('This is a pattern');
    });

    it('should match aggregated bullet format', () => {
      const line = '[Bullet #xyz789, helpful:10, harmful:1, Aggregated from 5 instances] Aggregated pattern';
      const match = line.match(BULLET_PATTERN);
      
      expect(match).toBeTruthy();
      expect(match![1]).toBe('xyz789');
      expect(match![2]).toBe('10');
      expect(match![3]).toBe('1');
      expect(match![4]).toBe('5');
      expect(match![5]).toBe('Aggregated pattern');
    });

    it('should handle leading whitespace', () => {
      const line = '  [Bullet #test, helpful:0, harmful:0] Indented bullet';
      const match = line.match(BULLET_PATTERN);
      
      expect(match).toBeTruthy();
      expect(match![1]).toBe('test');
    });
  });

  describe('FLEXIBLE_BULLET_PATTERN', () => {
    it('should match bullets with additional metadata', () => {
      const line = '[Bullet #abc, helpful:1, harmful:0, Extra info here] Content';
      const match = line.match(FLEXIBLE_BULLET_PATTERN);
      
      expect(match).toBeTruthy();
      expect(match![1]).toBe('abc');
      expect(match![2]).toBe('1');
      expect(match![3]).toBe('0');
      expect(match![4]).toBe('Content');
    });
  });

  describe('parseKnowledgeBullets', () => {
    it('should parse simple bullets', () => {
      const markdown = `
## Section One

[Bullet #001, helpful:3, harmful:1] First pattern
[Bullet #002, helpful:5, harmful:0] Second pattern
`;

      const bullets = parseKnowledgeBullets(markdown);
      
      expect(bullets).toHaveLength(2);
      expect(bullets[0].id).toBe('001');
      expect(bullets[0].helpfulCount).toBe(3);
      expect(bullets[0].harmfulCount).toBe(1);
      expect(bullets[0].text).toBe('First pattern');
      expect(bullets[1].id).toBe('002');
    });

    it('should parse aggregated bullets', () => {
      const markdown = '[Bullet #agg1, helpful:20, harmful:2, Aggregated from 10 instances] Aggregated pattern';
      
      const bullets = parseKnowledgeBullets(markdown);
      
      expect(bullets).toHaveLength(1);
      expect(bullets[0].id).toBe('agg1');
      expect(bullets[0].helpfulCount).toBe(20);
      expect(bullets[0].aggregatedFrom).toBe(10);
    });

    it('should track sections when requested', () => {
      const markdown = `
## Build & Test Patterns

[Bullet #b1, helpful:1, harmful:0] Build pattern

## TypeScript Patterns

[Bullet #t1, helpful:2, harmful:0] TypeScript pattern
`;

      const bullets = parseKnowledgeBullets(markdown, { trackSections: true });
      
      expect(bullets).toHaveLength(2);
      expect(bullets[0].section).toBe('Build & Test Patterns');
      expect(bullets[1].section).toBe('TypeScript Patterns');
    });

    it('should track line numbers', () => {
      const markdown = `Line 1
[Bullet #first, helpful:1, harmful:0] On line 2
Line 3
[Bullet #second, helpful:2, harmful:1] On line 4`;

      const bullets = parseKnowledgeBullets(markdown);
      
      expect(bullets[0].lineNumber).toBe(2);
      expect(bullets[1].lineNumber).toBe(4);
    });
  });

  describe('parseKnowledgeBulletsWithProvenance', () => {
    it('should parse bullets with provenance comments', () => {
      const markdown = `
## test/section

[Bullet #delta1, helpful:5, harmful:1] Content here
<!-- deltaId=d123, beadsId=b456, createdAt=2025-01-01T00:00:00Z, hash=hash123 -->
`;

      const bullets = parseKnowledgeBulletsWithProvenance(markdown);
      
      expect(bullets).toHaveLength(1);
      expect(bullets[0].id).toBe('delta1');
      expect(bullets[0].helpful).toBe(5);
      expect(bullets[0].harmful).toBe(1);
      expect(bullets[0].content).toBe('Content here');
      expect(bullets[0].section).toBe('test/section');
      expect(bullets[0].provenance?.deltaId).toBe('d123');
      expect(bullets[0].provenance?.beadsId).toBe('b456');
      expect(bullets[0].hash).toBeTruthy();
    });

    it('should handle bullets without provenance', () => {
      const markdown = `
## section

[Bullet #noprov, helpful:1, harmful:0] No provenance
`;

      const bullets = parseKnowledgeBulletsWithProvenance(markdown);
      
      expect(bullets).toHaveLength(1);
      expect(bullets[0].provenance?.deltaId).toBe('noprov');
      expect(bullets[0].provenance?.beadsId).toBe('unknown');
    });
  });

  describe('updateBulletCountersInMarkdown', () => {
    it('should update helpful and harmful counters', () => {
      const markdown = `
[Bullet #b1, helpful:5, harmful:2] Pattern one
[Bullet #b2, helpful:3, harmful:1] Pattern two
`;

      const deltas = new Map([
        ['b1', { helpful: 2, harmful: 1 }],
        ['b2', { helpful: -1, harmful: 3 }],
      ]);

      const updated = updateBulletCountersInMarkdown(markdown, deltas);
      
      expect(updated).toContain('[Bullet #b1, helpful:7, harmful:3] Pattern one');
      expect(updated).toContain('[Bullet #b2, helpful:2, harmful:4] Pattern two');
    });

    it('should preserve aggregation info when updating counters', () => {
      const markdown = '[Bullet #agg, helpful:10, harmful:2, Aggregated from 5 instances] Aggregated';
      
      const deltas = new Map([['agg', { helpful: 5, harmful: 1 }]]);
      
      const updated = updateBulletCountersInMarkdown(markdown, deltas);
      
      expect(updated).toContain('[Bullet #agg, helpful:15, harmful:3, Aggregated from 5 instances] Aggregated');
    });

    it('should not modify bullets without deltas', () => {
      const markdown = '[Bullet #unchanged, helpful:1, harmful:0] Unchanged';
      
      const deltas = new Map([['other', { helpful: 1, harmful: 0 }]]);
      
      const updated = updateBulletCountersInMarkdown(markdown, deltas);
      
      expect(updated).toBe(markdown);
    });
  });

  describe('findSectionIndex', () => {
    it('should find section by exact name', () => {
      const lines = [
        '# Header',
        '## Build & Test Patterns',
        'Content',
        '## TypeScript Patterns',
      ];

      const idx = findSectionIndex(lines, 'Build & Test Patterns');
      
      expect(idx).toBe(1);
    });

    it('should find section by normalized name', () => {
      const lines = [
        '## Build & Test Patterns',
        'Content',
      ];

      const idx = findSectionIndex(lines, 'build & test patterns');
      
      expect(idx).toBe(0);
    });

    it('should return -1 for missing section', () => {
      const lines = ['## Other Section'];
      
      const idx = findSectionIndex(lines, 'Missing Section');
      
      expect(idx).toBe(-1);
    });
  });

  describe('findInsertPosition', () => {
    it('should find position after last bullet in section', () => {
      const lines = [
        '## Section',
        '',
        '[Bullet #b1, helpful:1, harmful:0] First',
        '[Bullet #b2, helpful:2, harmful:0] Second',
        '',
        '## Next Section',
      ];

      const pos = findInsertPosition(lines, 0);
      
      expect(pos).toBe(4);
    });

    it('should handle section with bullets and comments', () => {
      const lines = [
        '## Section',
        '',
        '[Bullet #b1, helpful:1, harmful:0] First',
        '<!-- comment -->',
        '',
      ];

      const pos = findInsertPosition(lines, 0);
      
      expect(pos).toBe(4);
    });

    it('should insert after section header if no bullets', () => {
      const lines = [
        '## Empty Section',
        '',
        '## Next Section',
      ];

      const pos = findInsertPosition(lines, 0);
      
      // When no bullets found, returns end of search (before next section)
      expect(pos).toBe(3);
    });
  });

  describe('countBullets', () => {
    it('should count all bullets in markdown', () => {
      const markdown = `
[Bullet #1, helpful:1, harmful:0] One
[Bullet #2, helpful:2, harmful:1] Two
[Bullet #3, helpful:0, harmful:0] Three
`;

      const count = countBullets(markdown);
      
      expect(count).toBe(3);
    });

    it('should return 0 for markdown without bullets', () => {
      const markdown = 'Just some text\n## Header\nMore text';
      
      const count = countBullets(markdown);
      
      expect(count).toBe(0);
    });
  });

  describe('extractBulletById', () => {
    it('should extract bullet by ID', () => {
      const markdown = `[Bullet #find-me, helpful:5, harmful:1] Found it
[Bullet #other, helpful:1, harmful:0] Not this one`;

      const bullet = extractBulletById(markdown, 'find-me');
      
      expect(bullet).toBeTruthy();
      expect(bullet!.id).toBe('find-me');
      expect(bullet!.helpfulCount).toBe(5);
      expect(bullet!.text).toBe('Found it');
    });

    it('should return null if bullet not found', () => {
      const markdown = '[Bullet #exists, helpful:1, harmful:0] Exists';
      
      const bullet = extractBulletById(markdown, 'missing');
      
      expect(bullet).toBeNull();
    });
  });

  describe('removeBulletById', () => {
    it('should remove bullet by ID', () => {
      const markdown = `
[Bullet #keep, helpful:1, harmful:0] Keep this
[Bullet #remove, helpful:2, harmful:1] Remove this
[Bullet #also-keep, helpful:3, harmful:0] Also keep
`;

      const updated = removeBulletById(markdown, 'remove');
      
      expect(updated).toContain('keep');
      expect(updated).toContain('also-keep');
      expect(updated).not.toContain('remove');
      expect(updated).not.toContain('Remove this');
    });

    it('should remove bullet and its comment', () => {
      const markdown = `
[Bullet #remove, helpful:1, harmful:0] Remove
<!-- deltaId=d1, beadsId=b1, createdAt=2025-01-01, hash=h1 -->
[Bullet #keep, helpful:2, harmful:0] Keep
`;

      const updated = removeBulletById(markdown, 'remove');
      
      expect(updated).not.toContain('remove');
      expect(updated).not.toContain('deltaId=d1');
      expect(updated).toContain('keep');
    });
  });

  describe('serializeBullets', () => {
    it('should serialize bullets to markdown format', () => {
      const bullets: KnowledgeBullet[] = [
        {
          id: 'b1',
          section: 'build/test',
          content: 'Build pattern',
          helpful: 5,
          harmful: 1,
          hash: 'hash1',
          provenance: {
            deltaId: 'd1',
            beadsId: 'bead1',
            createdAt: '2025-01-01',
          },
        },
        {
          id: 'b2',
          section: 'typescript',
          content: 'TS pattern',
          helpful: 3,
          harmful: 0,
          hash: 'hash2',
          provenance: {
            deltaId: 'd2',
            beadsId: 'bead2',
            createdAt: '2025-01-02',
          },
        },
      ];

      const markdown = serializeBullets(bullets);
      
      expect(markdown).toContain('## Build Test');
      expect(markdown).toContain('[Bullet #b1, helpful:5, harmful:1] Build pattern');
      expect(markdown).toContain('<!-- deltaId=d1, beadsId=bead1, createdAt=2025-01-01, hash=hash1 -->');
      expect(markdown).toContain('## Typescript');
      expect(markdown).toContain('[Bullet #b2, helpful:3, harmful:0] TS pattern');
    });

    it('should group bullets by section', () => {
      const bullets: KnowledgeBullet[] = [
        {
          id: 'b1',
          section: 'test',
          content: 'First',
          helpful: 1,
          harmful: 0,
        },
        {
          id: 'b2',
          section: 'test',
          content: 'Second',
          helpful: 2,
          harmful: 0,
        },
      ];

      const markdown = serializeBullets(bullets);
      const sectionCount = (markdown.match(/## Test/g) || []).length;
      
      expect(sectionCount).toBe(1);
      expect(markdown).toContain('b1');
      expect(markdown).toContain('b2');
    });
  });
});
