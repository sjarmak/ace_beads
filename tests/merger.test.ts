import { describe, it, expect } from 'vitest';
import { DeltaMerger, type KnowledgeBullet } from '../src/lib/merger.js';
import type { AceDelta } from '../src/lib/deltas.js';

describe('DeltaMerger', () => {
  const merger = new DeltaMerger(0.80);

  describe('Basic Operations', () => {
    it('adds new bullet', () => {
      const delta: AceDelta = {
        id: '12345678-1234-1234-1234-123456789012',
        section: 'test/patterns',
        op: 'add',
        content: 'Always validate input before processing',
        metadata: {
          source: { beadsId: 'bd-1' },
          confidence: 0.85,
          helpful: 0,
          harmful: 0,
          tags: ['validation'],
          evidence: 'Test failed when invalid input provided',
          createdAt: '2025-01-01T00:00:00Z',
        },
      };

      const result = merger.merge([], [delta]);

      expect(result.accepted).toEqual([delta.id]);
      expect(result.rejected).toEqual([]);
      expect(result.bullets).toHaveLength(1);
      expect(result.bullets[0].content).toBe('Always validate input before processing');
    });

    it('rejects duplicate with same hash', () => {
      const existing: KnowledgeBullet = {
        id: 'existing-1',
        section: 'test/patterns',
        content: 'Always validate input',
        helpful: 1,
        harmful: 0,
        hash: 'test/patterns::always validate input',
        provenance: {
          deltaId: 'old-delta',
          beadsId: 'bd-0',
          createdAt: '2024-12-31T00:00:00Z',
        },
      };

      const delta: AceDelta = {
        id: '12345678-1234-1234-1234-123456789012',
        section: 'test/patterns',
        op: 'add',
        content: '  ALWAYS VALIDATE INPUT  ', // Different spacing, same normalized
        metadata: {
          source: { beadsId: 'bd-1' },
          confidence: 0.85,
          helpful: 0,
          harmful: 0,
          tags: [],
          evidence: 'Evidence',
          createdAt: '2025-01-01T00:00:00Z',
        },
      };

      const result = merger.merge([existing], [delta]);

      expect(result.accepted).toEqual([]);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toBe('duplicate');
      expect(result.bullets).toHaveLength(1);
      expect(result.bullets[0].id).toBe('existing-1');
    });

    it('amends existing bullet', () => {
      const existing: KnowledgeBullet = {
        id: 'existing-1',
        section: 'test/patterns',
        content: 'Old content',
        helpful: 1,
        harmful: 0,
        hash: 'test/patterns::old content',
        provenance: {
          deltaId: 'old-delta',
          beadsId: 'bd-0',
          createdAt: '2024-12-31T00:00:00Z',
        },
      };

      const delta: AceDelta = {
        id: '12345678-1234-1234-1234-123456789012',
        section: 'test/patterns',
        op: 'amend',
        content: 'Old content', // Same hash
        metadata: {
          source: { beadsId: 'bd-1' },
          confidence: 0.85,
          helpful: 2,
          harmful: 1,
          tags: [],
          evidence: 'Evidence',
          createdAt: '2025-01-01T00:00:00Z',
        },
      };

      const result = merger.merge([existing], [delta]);

      expect(result.accepted).toEqual([delta.id]);
      expect(result.bullets).toHaveLength(1);
      expect(result.bullets[0].helpful).toBe(3); // 1 + 2
      expect(result.bullets[0].harmful).toBe(1); // 0 + 1
    });

    it('deprecates bullet', () => {
      const existing: KnowledgeBullet = {
        id: 'existing-1',
        section: 'test/patterns',
        content: 'Deprecated pattern',
        helpful: 1,
        harmful: 0,
        hash: 'test/patterns::deprecated pattern',
        provenance: {
          deltaId: 'old-delta',
          beadsId: 'bd-0',
          createdAt: '2024-12-31T00:00:00Z',
        },
      };

      const delta: AceDelta = {
        id: '12345678-1234-1234-1234-123456789012',
        section: 'test/patterns',
        op: 'deprecate',
        content: 'Deprecated pattern',
        metadata: {
          source: { beadsId: 'bd-1' },
          confidence: 0.85,
          helpful: 0,
          harmful: 0,
          tags: [],
          evidence: 'Evidence',
          createdAt: '2025-01-01T00:00:00Z',
        },
      };

      const result = merger.merge([existing], [delta]);

      expect(result.accepted).toEqual([delta.id]);
      expect(result.bullets).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('rejects low confidence delta', () => {
      const delta: AceDelta = {
        id: '12345678-1234-1234-1234-123456789012',
        section: 'test/patterns',
        op: 'add',
        content: 'Low confidence pattern',
        metadata: {
          source: { beadsId: 'bd-1' },
          confidence: 0.50, // Below threshold
          helpful: 0,
          harmful: 0,
          tags: [],
          evidence: 'Weak evidence',
          createdAt: '2025-01-01T00:00:00Z',
        },
      };

      const result = merger.merge([], [delta]);

      expect(result.accepted).toEqual([]);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toBe('low-confidence');
    });

    it('rejects delta with insufficient evidence', () => {
      const delta: AceDelta = {
        id: '12345678-1234-1234-1234-123456789012',
        section: 'test/patterns',
        op: 'add',
        content: 'Pattern without evidence',
        metadata: {
          source: { beadsId: 'bd-1' },
          confidence: 0.85,
          helpful: 0,
          harmful: 0,
          tags: [],
          evidence: 'Short', // Too short
          createdAt: '2025-01-01T00:00:00Z',
        },
      };

      const result = merger.merge([], [delta]);

      expect(result.accepted).toEqual([]);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].reason).toBe('low-evidence');
    });
  });

  describe('Filtering', () => {
    it('filters bullets where harmful > helpful', () => {
      const existing: KnowledgeBullet[] = [
        {
          id: 'good-1',
          section: 'test/patterns',
          content: 'Good pattern',
          helpful: 5,
          harmful: 2,
          hash: 'test/patterns::good pattern',
          provenance: {
            deltaId: 'delta-1',
            beadsId: 'bd-1',
            createdAt: '2025-01-01T00:00:00Z',
          },
        },
        {
          id: 'bad-1',
          section: 'test/patterns',
          content: 'Bad pattern',
          helpful: 2,
          harmful: 5,
          hash: 'test/patterns::bad pattern',
          provenance: {
            deltaId: 'delta-2',
            beadsId: 'bd-2',
            createdAt: '2025-01-01T00:00:00Z',
          },
        },
      ];

      const result = merger.merge(existing, []);

      expect(result.bullets).toHaveLength(1);
      expect(result.bullets[0].id).toBe('good-1');
    });
  });

  describe('Sorting', () => {
    it('sorts by section ascending, helpful descending, content ascending', () => {
      const existing: KnowledgeBullet[] = [
        {
          id: 'b-low',
          section: 'b-section',
          content: 'zzz',
          helpful: 1,
          harmful: 0,
          hash: 'b-section::zzz',
          provenance: {
            deltaId: 'delta-1',
            beadsId: 'bd-1',
            createdAt: '2025-01-01T00:00:00Z',
          },
        },
        {
          id: 'a-high',
          section: 'a-section',
          content: 'aaa',
          helpful: 10,
          harmful: 0,
          hash: 'a-section::aaa',
          provenance: {
            deltaId: 'delta-2',
            beadsId: 'bd-2',
            createdAt: '2025-01-01T00:00:00Z',
          },
        },
        {
          id: 'a-low',
          section: 'a-section',
          content: 'bbb',
          helpful: 5,
          harmful: 0,
          hash: 'a-section::bbb',
          provenance: {
            deltaId: 'delta-3',
            beadsId: 'bd-3',
            createdAt: '2025-01-01T00:00:00Z',
          },
        },
      ];

      const result = merger.merge(existing, []);

      expect(result.bullets[0].id).toBe('a-high'); // a-section, helpful=10
      expect(result.bullets[1].id).toBe('a-low');  // a-section, helpful=5
      expect(result.bullets[2].id).toBe('b-low');  // b-section
    });
  });

  describe('Parsing and Serialization', () => {
    it('parses bullets from AGENTS.md', () => {
      const markdown = `
## Test Patterns

[Bullet #test-1, helpful:5, harmful:2] First pattern
<!-- deltaId=delta-1, beadsId=bd-1, createdAt=2025-01-01T00:00:00Z, hash=test/patterns::first pattern -->

[Bullet #test-2, helpful:3, harmful:0] Second pattern
<!-- deltaId=delta-2, beadsId=bd-2, createdAt=2025-01-02T00:00:00Z, hash=test/patterns::second pattern -->
`;

      const bullets = merger.parseBullets(markdown);

      expect(bullets).toHaveLength(2);
      expect(bullets[0].id).toBe('test-1');
      expect(bullets[0].helpful).toBe(5);
      expect(bullets[0].harmful).toBe(2);
      expect(bullets[0].content).toBe('First pattern');
      expect(bullets[1].id).toBe('test-2');
    });

    it('serializes bullets to AGENTS.md format', () => {
      const bullets: KnowledgeBullet[] = [
        {
          id: 'test-1',
          section: 'test/patterns',
          content: 'First pattern',
          helpful: 5,
          harmful: 2,
          hash: 'test/patterns::first pattern',
          provenance: {
            deltaId: 'delta-1',
            beadsId: 'bd-1',
            createdAt: '2025-01-01T00:00:00Z',
          },
        },
      ];

      const serialized = merger.serializeBullets(bullets);

      expect(serialized).toContain('[Bullet #test-1, helpful:5, harmful:2] First pattern');
      expect(serialized).toContain('<!-- deltaId=delta-1');
      expect(serialized).toContain('beadsId=bd-1');
    });
  });
});
