import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ThreadIndexer } from '../src/lib/thread-indexer.js';

describe('ThreadIndexer', () => {
  let tempDir: string;
  let indexPath: string;
  let indexer: ThreadIndexer;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'thread-indexer-test-'));
    indexPath = join(tempDir, '.beads', 'thread_index.jsonl');
    indexer = new ThreadIndexer({ indexPath });
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('normalizeThreadId', () => {
    it('should normalize thread URL to ID', async () => {
      await indexer.indexThread({
        threadId: 'https://ampcode.com/threads/T-abc-123',
        beadId: 'bd-1',
      });

      const threads = await indexer.getAllThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0].thread_id).toBe('T-abc-123');
    });

    it('should normalize @T-xxx format', async () => {
      await indexer.indexThread({
        threadId: '@T-def-456',
        beadId: 'bd-2',
      });

      const threads = await indexer.getAllThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0].thread_id).toBe('T-def-456');
    });

    it('should keep plain thread ID as-is', async () => {
      await indexer.indexThread({
        threadId: 'T-xyz-789',
        beadId: 'bd-3',
      });

      const threads = await indexer.getAllThreads();
      expect(threads).toHaveLength(1);
      expect(threads[0].thread_id).toBe('T-xyz-789');
    });
  });

  describe('indexThread', () => {
    it('should create new thread entry', async () => {
      await indexer.indexThread({
        threadId: 'T-test-1',
        beadId: 'bd-100',
        tags: ['bug', 'critical'],
        component: 'auth',
        feature: 'login',
      });

      const thread = await indexer.getThread('T-test-1');
      expect(thread).toBeDefined();
      expect(thread?.bead_ids).toEqual(['bd-100']);
      expect(thread?.tags).toEqual(['bug', 'critical']);
      expect(thread?.component).toBe('auth');
      expect(thread?.feature).toBe('login');
      expect(thread?.trace_count).toBe(1);
    });

    it('should update existing thread with new bead', async () => {
      await indexer.indexThread({
        threadId: 'T-test-2',
        beadId: 'bd-200',
      });

      await indexer.indexThread({
        threadId: 'T-test-2',
        beadId: 'bd-201',
      });

      const thread = await indexer.getThread('T-test-2');
      expect(thread?.bead_ids).toEqual(['bd-200', 'bd-201']);
      expect(thread?.trace_count).toBe(2);
    });

    it('should not duplicate beads', async () => {
      await indexer.indexThread({
        threadId: 'T-test-3',
        beadId: 'bd-300',
      });

      await indexer.indexThread({
        threadId: 'T-test-3',
        beadId: 'bd-300',
      });

      const thread = await indexer.getThread('T-test-3');
      expect(thread?.bead_ids).toEqual(['bd-300']);
      expect(thread?.trace_count).toBe(2);
    });

    it('should merge tags from multiple indexing calls', async () => {
      await indexer.indexThread({
        threadId: 'T-test-4',
        beadId: 'bd-400',
        tags: ['tag1', 'tag2'],
      });

      await indexer.indexThread({
        threadId: 'T-test-4',
        beadId: 'bd-401',
        tags: ['tag2', 'tag3'],
      });

      const thread = await indexer.getThread('T-test-4');
      expect(thread?.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should update last_seen timestamp', async () => {
      await indexer.indexThread({
        threadId: 'T-test-5',
        beadId: 'bd-500',
      });

      const thread1 = await indexer.getThread('T-test-5');
      const firstSeen = thread1?.first_seen;
      const firstLastSeen = thread1?.last_seen;

      await new Promise(resolve => setTimeout(resolve, 10));

      await indexer.indexThread({
        threadId: 'T-test-5',
        beadId: 'bd-501',
      });

      const thread2 = await indexer.getThread('T-test-5');
      expect(thread2?.first_seen).toBe(firstSeen);
      expect(thread2?.last_seen).not.toBe(firstLastSeen);
      expect(new Date(thread2!.last_seen).getTime()).toBeGreaterThan(
        new Date(firstLastSeen!).getTime()
      );
    });

    it('should store amp_metadata', async () => {
      await indexer.indexThread({
        threadId: 'T-test-6',
        beadId: 'bd-600',
        ampMetadata: {
          thread_url: 'https://ampcode.com/threads/T-test-6',
          workspace_id: 'ws-123',
          created_by_agent: 'generator',
          created_in_context: 'main-thread',
          main_thread_id: 'T-main',
          parent_thread_id: 'T-parent',
        },
      });

      const thread = await indexer.getThread('T-test-6');
      expect(thread?.amp_metadata).toEqual({
        thread_url: 'https://ampcode.com/threads/T-test-6',
        workspace_id: 'ws-123',
        created_by_agent: 'generator',
        created_in_context: 'main-thread',
        main_thread_id: 'T-main',
        parent_thread_id: 'T-parent',
      });
    });
  });

  describe('getThreadsForBead', () => {
    it('should return all threads for a bead', async () => {
      await indexer.indexThread({
        threadId: 'T-thread-1',
        beadId: 'bd-999',
      });

      await indexer.indexThread({
        threadId: 'T-thread-2',
        beadId: 'bd-999',
      });

      await indexer.indexThread({
        threadId: 'T-thread-3',
        beadId: 'bd-888',
      });

      const threads = await indexer.getThreadsForBead('bd-999');
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.thread_id).sort()).toEqual(['T-thread-1', 'T-thread-2']);
    });

    it('should return empty array if bead not found', async () => {
      const threads = await indexer.getThreadsForBead('bd-nonexistent');
      expect(threads).toEqual([]);
    });

    it('should sort threads by last_seen descending', async () => {
      await indexer.indexThread({
        threadId: 'T-old',
        beadId: 'bd-sort',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await indexer.indexThread({
        threadId: 'T-new',
        beadId: 'bd-sort',
      });

      const threads = await indexer.getThreadsForBead('bd-sort');
      expect(threads[0].thread_id).toBe('T-new');
      expect(threads[1].thread_id).toBe('T-old');
    });
  });

  describe('getBeadsForThread', () => {
    it('should return all beads for a thread', async () => {
      await indexer.indexThread({
        threadId: 'T-multi-bead',
        beadId: 'bd-1',
      });

      await indexer.indexThread({
        threadId: 'T-multi-bead',
        beadId: 'bd-2',
      });

      await indexer.indexThread({
        threadId: 'T-multi-bead',
        beadId: 'bd-3',
      });

      const beads = await indexer.getBeadsForThread('T-multi-bead');
      expect(beads).toEqual(['bd-1', 'bd-2', 'bd-3']);
    });

    it('should return empty array if thread not found', async () => {
      const beads = await indexer.getBeadsForThread('T-nonexistent');
      expect(beads).toEqual([]);
    });

    it('should normalize thread ID in query', async () => {
      await indexer.indexThread({
        threadId: 'T-normalize-test',
        beadId: 'bd-100',
      });

      const beads = await indexer.getBeadsForThread('https://ampcode.com/threads/T-normalize-test');
      expect(beads).toEqual(['bd-100']);
    });
  });

  describe('getAllThreads', () => {
    beforeEach(async () => {
      await indexer.indexThread({
        threadId: 'T-1',
        beadId: 'bd-1',
        tags: ['bug'],
        component: 'auth',
      });

      await indexer.indexThread({
        threadId: 'T-2',
        beadId: 'bd-2',
        tags: ['feature'],
        component: 'payment',
      });

      await indexer.indexThread({
        threadId: 'T-3',
        beadId: 'bd-3',
        tags: ['bug', 'critical'],
        component: 'auth',
      });
    });

    it('should return all threads without filter', async () => {
      const threads = await indexer.getAllThreads();
      expect(threads).toHaveLength(3);
    });

    it('should filter by threadId', async () => {
      const threads = await indexer.getAllThreads({ threadId: 'T-2' });
      expect(threads).toHaveLength(1);
      expect(threads[0].thread_id).toBe('T-2');
    });

    it('should filter by beadId', async () => {
      const threads = await indexer.getAllThreads({ beadId: 'bd-1' });
      expect(threads).toHaveLength(1);
      expect(threads[0].bead_ids).toContain('bd-1');
    });

    it('should filter by tags (OR logic)', async () => {
      const threads = await indexer.getAllThreads({ tags: ['critical'] });
      expect(threads).toHaveLength(1);
      expect(threads[0].thread_id).toBe('T-3');
    });

    it('should filter by component', async () => {
      const threads = await indexer.getAllThreads({ component: 'auth' });
      expect(threads).toHaveLength(2);
      expect(threads.map(t => t.thread_id).sort()).toEqual(['T-1', 'T-3']);
    });

    it('should combine multiple filters', async () => {
      const threads = await indexer.getAllThreads({
        tags: ['bug'],
        component: 'auth',
      });
      expect(threads).toHaveLength(2);
    });

    it('should sort by last_seen descending', async () => {
      const threads = await indexer.getAllThreads();
      const timestamps = threads.map(t => new Date(t.last_seen).getTime());
      
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });
  });

  describe('persistence', () => {
    it('should persist threads across indexer instances', async () => {
      await indexer.indexThread({
        threadId: 'T-persist',
        beadId: 'bd-persist',
        tags: ['persistent'],
      });

      const newIndexer = new ThreadIndexer({ indexPath });
      const thread = await newIndexer.getThread('T-persist');
      
      expect(thread).toBeDefined();
      expect(thread?.bead_ids).toEqual(['bd-persist']);
      expect(thread?.tags).toEqual(['persistent']);
    });

    it('should handle empty index file', async () => {
      const threads = await indexer.getAllThreads();
      expect(threads).toEqual([]);
    });
  });

  describe('cache management', () => {
    it('should use cache on subsequent reads', async () => {
      await indexer.indexThread({
        threadId: 'T-cache',
        beadId: 'bd-cache',
      });

      const thread1 = await indexer.getThread('T-cache');
      const thread2 = await indexer.getThread('T-cache');
      
      expect(thread1).toEqual(thread2);
    });

    it('should clear cache when requested', async () => {
      await indexer.indexThread({
        threadId: 'T-clear',
        beadId: 'bd-clear',
      });

      await indexer.getThread('T-clear');
      indexer.clearCache();
      
      const thread = await indexer.getThread('T-clear');
      expect(thread).toBeDefined();
    });
  });
});
