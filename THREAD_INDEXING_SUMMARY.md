# Thread Indexing Implementation Summary

## Overview
Implemented a comprehensive thread aggregation and indexing system for ACE_Beads_Amp-270 that tracks the relationship between Amp threads and beads across the entire project.

## Files Created

### 1. `src/lib/thread-indexer.ts` (235 lines)
**ThreadIndexer class** - Core indexing engine with the following capabilities:

**Key Features:**
- **Thread ID Normalization**: Supports multiple formats
  - Direct thread IDs: `T-abc-123`
  - URLs: `https://ampcode.com/threads/T-abc-123`
  - @-prefixed: `@T-abc-123`
- **JSONL-based Storage**: Stores index at `.beads/thread_index.jsonl`
- **In-memory Caching**: Optimizes repeated queries
- **Incremental Updates**: Merges data from multiple captures

**Schema (ThreadIndexEntry):**
```typescript
{
  thread_id: string;              // Normalized thread ID
  bead_ids: string[];             // All beads associated with thread
  tags: string[];                 // Feature/component tags
  component?: string;             // Component name
  feature?: string;               // Feature name
  first_seen: string;             // ISO timestamp
  last_seen: string;              // ISO timestamp
  trace_count: number;            // Total traces captured
  amp_metadata?: {                // Rich Amp context
    thread_url?: string;
    workspace_id?: string;
    created_by_agent?: string;
    created_in_context?: string;
    main_thread_id?: string;
    parent_thread_id?: string;
  };
}
```

**Query APIs:**
- `getThreadsForBead(beadId)` - Find all threads for a specific bead
- `getBeadsForThread(threadId)` - Find all beads in a thread
- `getAllThreads(query?)` - List/filter all threads
- `getThread(threadId)` - Get single thread details
- `indexThread(data)` - Add/update thread entry

**Query Filters:**
- `threadId` - Exact thread match
- `beadId` - Threads containing bead
- `tags` - Filter by tags (OR logic)
- `component` - Filter by component
- `after` / `before` - Date range filters

### 2. `src/commands/threads.ts` (157 lines)
**CLI Commands** - Three new subcommands under `ace threads`:

**Commands:**
1. **`ace threads list`**
   - Lists all indexed threads
   - Options: `--limit`, `--tags`, `--component`, `--json`
   - Shows: bead count, trace count, tags, timestamps
   
2. **`ace threads show <thread-id>`**
   - Detailed view of a specific thread
   - Shows: all associated beads, metadata, Amp context
   - Options: `--json`
   
3. **`ace threads by-bead <bead-id>`**
   - Find all threads that reference a bead
   - Useful for understanding cross-thread work
   - Options: `--json`

### 3. `tests/thread-indexer.test.ts` (408 lines)
**Comprehensive Test Suite** - 26 tests covering:

- Thread ID normalization (URLs, @-prefix, plain IDs)
- Thread creation and updates
- Bead association and deduplication
- Tag merging across captures
- Timestamp tracking (first_seen, last_seen)
- Amp metadata storage
- Query APIs (all filter combinations)
- Persistence across instances
- Cache management
- Empty state handling

**All tests passing ✅**

## Files Modified

### 1. `src/commands/capture.ts`
**Integration with auto-indexing:**
- Added ThreadIndexer import
- Automatically indexes threads when `--thread-refs` provided
- Captures Amp environment metadata (workspace, agent, context)
- Runs after trace is written but before output

### 2. `src/cli.ts`
**New CLI command registration:**
- Added `threads` import
- Registered `ace threads` command group with 3 subcommands
- Includes proper error handling and JSON output

## Key Design Decisions

### 1. **JSONL Storage Format**
**Why:** Consistent with existing ACE patterns (traces, insights)
- Append-only writes for concurrency safety
- Easy to grep/parse with standard tools
- Human-readable for debugging

### 2. **Normalization Strategy**
**Why:** Support multiple input formats without user friction
- Users can paste URLs directly
- CLI scripts can use thread IDs
- Slack/Amp notifications use @-mentions

### 3. **Incremental Index Updates**
**Why:** Handle multiple captures per thread gracefully
- Thread entries merge beads/tags across captures
- Trace count accumulates
- Last_seen updates automatically
- No duplicates in bead_ids

### 4. **In-Memory Caching**
**Why:** Optimize read-heavy workloads
- Cache invalidated on write
- Manual cache clearing for testing
- Trades memory for speed on repeated queries

### 5. **Rich Amp Metadata**
**Why:** Enable advanced thread analytics
- Track which agent created work
- Distinguish main vs subagent threads
- Support thread hierarchy analysis
- Workspace-level aggregation

### 6. **Query API Design**
**Why:** Support common access patterns
- Bead-to-threads: "What threads touched this issue?"
- Thread-to-beads: "What work happened in this thread?"
- Filtering: "Show threads tagged 'auth'"
- All JSONL entries loaded once, filtered in-memory

### 7. **Auto-Indexing on Capture**
**Why:** Zero-friction adoption
- No separate indexing step required
- Index builds naturally as traces captured
- Backwards compatible (no thread-refs = no indexing)

## Usage Examples

### Capture with thread indexing
```bash
ace capture --bead bd-42 \
  --thread-refs "T-abc-123,https://ampcode.com/threads/T-def-456" \
  --thread-summary "Implemented auth feature" \
  --outcome success
```

### Query threads
```bash
# List all threads
ace threads list

# Filter by component
ace threads list --component auth --limit 10

# Show thread details
ace threads show T-abc-123

# Find threads for a bead
ace threads by-bead bd-42

# JSON output for scripting
ace threads list --json | jq '.threads[] | select(.trace_count > 5)'
```

## Integration Points

### Existing Systems
- **Capture Command**: Auto-indexes on `--thread-refs`
- **Amp Metadata**: Captures workspace, agent, context
- **JSONL Storage**: Uses `.beads/` directory pattern

### Future Enhancements
- Integrate with `ace status` to show thread stats
- Add thread-based filtering to `ace trace list`
- Support thread tags in `ace get` queries
- Thread-based analytics in reports

## Testing

All functionality verified with:
- ✅ 26 unit tests (thread-indexer.test.ts)
- ✅ TypeScript compilation
- ✅ CLI integration test (capture → list → show → by-bead)
- ✅ JSONL storage verification
- ✅ Thread ID normalization (URLs, @-prefix, plain)

## Performance Characteristics

- **Index Load**: O(n) where n = unique threads (lazy-loaded, cached)
- **Index Write**: O(1) append + O(n) rewrite on save
- **Thread Query**: O(1) with cache, O(n) on first access
- **Bead Query**: O(n) linear scan (acceptable for expected thread counts)

## File Locations

```
.beads/
  thread_index.jsonl    # Project-level thread index
  amp_metadata.jsonl    # Bead-level Amp metadata

logs/
  execution_traces.jsonl  # Trace data with thread_refs

src/
  lib/thread-indexer.ts       # Core indexing logic
  commands/threads.ts          # CLI commands
  commands/capture.ts          # Auto-indexing integration

tests/
  thread-indexer.test.ts       # Comprehensive test suite
```

## Summary

Successfully implemented a production-ready thread indexing system with:
- Clean separation of concerns (indexer, commands, integration)
- Comprehensive testing (26 tests, all passing)
- Auto-indexing integration (zero-friction)
- Rich query APIs (4 query methods with filtering)
- CLI commands (3 subcommands with JSON support)
- Robust normalization (3 input formats)
- JSONL-based storage (consistent with ACE patterns)
- Amp metadata integration (workspace, agent, context tracking)
