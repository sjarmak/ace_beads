import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  validateDelta,
  normalizeContent,
  generateDeltaHash,
  DeltaQueue,
  type AceDelta,
} from '../src/lib/deltas.js';

describe('Delta Schema Validation', () => {
  it('validates a correct delta', () => {
    const delta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add' as const,
      content: 'Test content with enough characters',
      metadata: {
        source: {
          beadsId: 'bd-123',
        },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: ['test', 'typescript'],
        evidence: 'Evidence with enough characters',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    expect(() => validateDelta(delta)).not.toThrow();
  });

  it('rejects delta with invalid UUID', () => {
    const delta = {
      id: 'not-a-uuid',
      section: 'test/patterns',
      op: 'add',
      content: 'Test content',
      metadata: {
        source: { beadsId: 'bd-123' },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    expect(() => validateDelta(delta)).toThrow();
  });

  it('rejects delta with invalid section pattern', () => {
    const delta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'Invalid Section!',
      op: 'add',
      content: 'Test content',
      metadata: {
        source: { beadsId: 'bd-123' },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    expect(() => validateDelta(delta)).toThrow();
  });

  it('rejects delta with confidence out of range', () => {
    const delta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add',
      content: 'Test content',
      metadata: {
        source: { beadsId: 'bd-123' },
        confidence: 1.5,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    expect(() => validateDelta(delta)).toThrow();
  });

  it('rejects delta with short content', () => {
    const delta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add',
      content: 'Short',
      metadata: {
        source: { beadsId: 'bd-123' },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    expect(() => validateDelta(delta)).toThrow();
  });
});

describe('Content Normalization', () => {
  it('trims whitespace', () => {
    expect(normalizeContent('  test  ')).toBe('test');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeContent('test    content')).toBe('test content');
  });

  it('lowercases content', () => {
    expect(normalizeContent('Test Content')).toBe('test content');
  });

  it('handles all transformations together', () => {
    expect(normalizeContent('  Test    CONTENT  ')).toBe('test content');
  });
});

describe('Delta Hash Generation', () => {
  it('generates consistent hash', () => {
    const hash1 = generateDeltaHash('test/section', 'Test Content');
    const hash2 = generateDeltaHash('test/section', 'Test Content');
    expect(hash1).toBe(hash2);
  });

  it('normalizes before hashing', () => {
    const hash1 = generateDeltaHash('test/section', 'Test Content');
    const hash2 = generateDeltaHash('test/section', '  test   content  ');
    expect(hash1).toBe(hash2);
  });

  it('includes section in hash', () => {
    const hash1 = generateDeltaHash('section1', 'content');
    const hash2 = generateDeltaHash('section2', 'content');
    expect(hash1).not.toBe(hash2);
  });

  it('produces section::normalized format', () => {
    const hash = generateDeltaHash('test/section', 'Test Content');
    expect(hash).toBe('test/section::test content');
  });
});

describe('DeltaQueue', () => {
  let tempDir: string;
  let queuePath: string;
  let queue: DeltaQueue;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'delta-queue-test-'));
    queuePath = join(tempDir, 'queue.json');
    queue = new DeltaQueue(queuePath);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reads empty queue', async () => {
    const deltas = await queue.read();
    expect(deltas).toEqual([]);
  });

  it('writes and reads deltas', async () => {
    const delta: AceDelta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add',
      content: 'Test content with enough characters',
      metadata: {
        source: { beadsId: 'bd-123' },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: ['test'],
        evidence: 'Evidence with enough characters',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    await queue.write([delta]);
    const read = await queue.read();
    expect(read).toEqual([delta]);
  });

  it('enqueues deltas', async () => {
    const delta1: AceDelta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add',
      content: 'First delta content',
      metadata: {
        source: { beadsId: 'bd-1' },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence 1',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    const delta2: AceDelta = {
      id: '22345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add',
      content: 'Second delta content',
      metadata: {
        source: { beadsId: 'bd-2' },
        confidence: 0.90,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence 2',
        createdAt: '2025-01-02T00:00:00Z',
      },
    };

    await queue.enqueue([delta1]);
    await queue.enqueue([delta2]);

    const read = await queue.read();
    expect(read).toHaveLength(2);
  });

  it('dequeues deltas by ID', async () => {
    const delta1: AceDelta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add',
      content: 'First delta content',
      metadata: {
        source: { beadsId: 'bd-1' },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence 1',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    const delta2: AceDelta = {
      id: '22345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add',
      content: 'Second delta content',
      metadata: {
        source: { beadsId: 'bd-2' },
        confidence: 0.90,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence 2',
        createdAt: '2025-01-02T00:00:00Z',
      },
    };

    await queue.write([delta1, delta2]);
    await queue.dequeue([delta1.id]);

    const read = await queue.read();
    expect(read).toHaveLength(1);
    expect(read[0].id).toBe(delta2.id);
  });

  it('sorts deltas deterministically', async () => {
    const delta1: AceDelta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'z-section',
      op: 'add',
      content: 'Content for testing sort order',
      metadata: {
        source: { beadsId: 'bd-1' },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence 1 with enough length',
        createdAt: '2025-01-02T00:00:00Z',
      },
    };

    const delta2: AceDelta = {
      id: '22345678-1234-1234-1234-123456789012',
      section: 'a-section',
      op: 'add',
      content: 'Content for testing sort order',
      metadata: {
        source: { beadsId: 'bd-2' },
        confidence: 0.90,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence 2 with enough length',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    await queue.write([delta1, delta2]);
    const read = await queue.read();

    // Should be sorted by section ascending
    expect(read[0].section).toBe('a-section');
    expect(read[1].section).toBe('z-section');
  });

  it('clears queue', async () => {
    const delta: AceDelta = {
      id: '12345678-1234-1234-1234-123456789012',
      section: 'test/patterns',
      op: 'add',
      content: 'Test content with enough characters',
      metadata: {
        source: { beadsId: 'bd-1' },
        confidence: 0.85,
        helpful: 0,
        harmful: 0,
        tags: [],
        evidence: 'Evidence with enough characters',
        createdAt: '2025-01-01T00:00:00Z',
      },
    };

    await queue.write([delta]);
    await queue.clear();

    const read = await queue.read();
    expect(read).toEqual([]);
  });
});
