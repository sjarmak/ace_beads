import { readFile, writeFile, mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';

export interface ThreadIndexEntry {
  thread_id: string;
  bead_ids: string[];
  tags: string[];
  component?: string;
  feature?: string;
  first_seen: string;
  last_seen: string;
  trace_count: number;
  amp_metadata?: {
    thread_url?: string;
    workspace_id?: string;
    created_by_agent?: string;
    created_in_context?: string;
    main_thread_id?: string;
    parent_thread_id?: string;
  };
}

export interface ThreadIndexQuery {
  threadId?: string;
  beadId?: string;
  tags?: string[];
  component?: string;
  after?: string;
  before?: string;
}

export class ThreadIndexer {
  private readonly indexPath: string;
  private cache: Map<string, ThreadIndexEntry> | null = null;

  constructor(options?: { indexPath?: string }) {
    const defaultPath = resolve(process.cwd(), '.beads/thread_index.jsonl');
    this.indexPath = options?.indexPath || defaultPath;
  }

  private normalizeThreadId(threadRef: string): string {
    if (threadRef.startsWith('http')) {
      const match = threadRef.match(/threads\/(T-[\w-]+)/i);
      return match ? match[1] : threadRef;
    }
    if (threadRef.startsWith('@')) {
      return threadRef.substring(1);
    }
    return threadRef;
  }

  private async ensureIndexDir(): Promise<void> {
    const dir = dirname(this.indexPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  private async loadIndex(): Promise<Map<string, ThreadIndexEntry>> {
    if (this.cache) {
      return this.cache;
    }

    const index = new Map<string, ThreadIndexEntry>();

    if (!existsSync(this.indexPath)) {
      this.cache = index;
      return index;
    }

    try {
      const content = await readFile(this.indexPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const entry: ThreadIndexEntry = JSON.parse(line);
        const normalized = this.normalizeThreadId(entry.thread_id);
        
        const existing = index.get(normalized);
        if (existing) {
          existing.bead_ids = Array.from(new Set([...existing.bead_ids, ...entry.bead_ids]));
          existing.tags = Array.from(new Set([...existing.tags, ...entry.tags]));
          existing.last_seen = entry.last_seen > existing.last_seen ? entry.last_seen : existing.last_seen;
          existing.trace_count = (existing.trace_count || 0) + (entry.trace_count || 1);
          if (entry.amp_metadata) {
            existing.amp_metadata = { ...existing.amp_metadata, ...entry.amp_metadata };
          }
        } else {
          entry.thread_id = normalized;
          index.set(normalized, entry);
        }
      }

      this.cache = index;
      return index;
    } catch (error) {
      throw new Error(`Failed to load thread index: ${error}`);
    }
  }

  private async saveIndex(index: Map<string, ThreadIndexEntry>): Promise<void> {
    await this.ensureIndexDir();

    const lines = Array.from(index.values())
      .map(entry => JSON.stringify(entry))
      .join('\n');

    await writeFile(this.indexPath, lines + '\n', 'utf-8');
    this.cache = index;
  }

  async indexThread(data: {
    threadId: string;
    beadId: string;
    tags?: string[];
    component?: string;
    feature?: string;
    ampMetadata?: any;
  }): Promise<void> {
    const index = await this.loadIndex();
    const normalized = this.normalizeThreadId(data.threadId);
    const now = new Date().toISOString();

    const existing = index.get(normalized);

    if (existing) {
      if (!existing.bead_ids.includes(data.beadId)) {
        existing.bead_ids.push(data.beadId);
      }
      if (data.tags) {
        existing.tags = Array.from(new Set([...existing.tags, ...data.tags]));
      }
      if (data.component && !existing.component) {
        existing.component = data.component;
      }
      if (data.feature && !existing.feature) {
        existing.feature = data.feature;
      }
      existing.last_seen = now;
      existing.trace_count = (existing.trace_count || 0) + 1;
      
      if (data.ampMetadata) {
        existing.amp_metadata = {
          ...existing.amp_metadata,
          thread_url: data.ampMetadata.thread_url || existing.amp_metadata?.thread_url,
          workspace_id: data.ampMetadata.workspace_id || existing.amp_metadata?.workspace_id,
          created_by_agent: data.ampMetadata.created_by_agent || existing.amp_metadata?.created_by_agent,
          created_in_context: data.ampMetadata.created_in_context || existing.amp_metadata?.created_in_context,
          main_thread_id: data.ampMetadata.main_thread_id || existing.amp_metadata?.main_thread_id,
          parent_thread_id: data.ampMetadata.parent_thread_id || existing.amp_metadata?.parent_thread_id,
        };
      }
    } else {
      const newEntry: ThreadIndexEntry = {
        thread_id: normalized,
        bead_ids: [data.beadId],
        tags: data.tags || [],
        component: data.component,
        feature: data.feature,
        first_seen: now,
        last_seen: now,
        trace_count: 1,
        amp_metadata: data.ampMetadata ? {
          thread_url: data.ampMetadata.thread_url,
          workspace_id: data.ampMetadata.workspace_id,
          created_by_agent: data.ampMetadata.created_by_agent,
          created_in_context: data.ampMetadata.created_in_context,
          main_thread_id: data.ampMetadata.main_thread_id,
          parent_thread_id: data.ampMetadata.parent_thread_id,
        } : undefined,
      };
      index.set(normalized, newEntry);
    }

    await this.saveIndex(index);
  }

  async getThreadsForBead(beadId: string): Promise<ThreadIndexEntry[]> {
    const index = await this.loadIndex();
    return Array.from(index.values())
      .filter(entry => entry.bead_ids.includes(beadId))
      .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());
  }

  async getBeadsForThread(threadId: string): Promise<string[]> {
    const index = await this.loadIndex();
    const normalized = this.normalizeThreadId(threadId);
    const entry = index.get(normalized);
    return entry ? entry.bead_ids : [];
  }

  async getAllThreads(query?: ThreadIndexQuery): Promise<ThreadIndexEntry[]> {
    const index = await this.loadIndex();
    let results = Array.from(index.values());

    if (query?.threadId) {
      const normalized = this.normalizeThreadId(query.threadId);
      results = results.filter(e => e.thread_id === normalized);
    }

    if (query?.beadId) {
      results = results.filter(e => e.bead_ids.includes(query.beadId!));
    }

    if (query?.tags && query.tags.length > 0) {
      results = results.filter(e => 
        query.tags!.some(tag => e.tags.includes(tag))
      );
    }

    if (query?.component) {
      results = results.filter(e => e.component === query.component);
    }

    if (query?.after) {
      results = results.filter(e => e.last_seen >= query.after!);
    }

    if (query?.before) {
      results = results.filter(e => e.last_seen <= query.before!);
    }

    return results.sort((a, b) => 
      new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
    );
  }

  async getThread(threadId: string): Promise<ThreadIndexEntry | undefined> {
    const index = await this.loadIndex();
    const normalized = this.normalizeThreadId(threadId);
    return index.get(normalized);
  }

  clearCache(): void {
    this.cache = null;
  }
}
