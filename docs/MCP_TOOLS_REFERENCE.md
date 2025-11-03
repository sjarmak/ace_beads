# ACE MCP Tools Reference

Complete reference for all 6 MCP tools available in the ACE Learning Server.

## Overview

The ACE MCP server exposes 6 tools organized into two categories:

### Core Learning Tools
1. **ace_capture_insight** - Capture patterns during conversation
2. **ace_get_insights** - Query existing insights  
3. **ace_analyze_patterns** - Analyze execution traces

### Thread & Workflow Tools
4. **ace_query_threads** - Query thread↔bead associations
5. **ace_trigger_learning** - Start ACE learning cycle
6. **ace_postmortem** - Extract insights from completed work

---

## Core Learning Tools

### 1. ace_capture_insight

**Purpose:** Capture learned patterns to insights.jsonl during agent conversations.

**Parameters:**
- `pattern` (string, **required**) - The pattern discovered
- `evidence` (string[], **required**) - Evidence supporting the pattern
- `confidence` (number, **required**) - Confidence level 0.0-1.0
- `section` (string, **required**) - AGENTS.md section to target
- `recommendation` (string, optional) - Actionable recommendation
- `scope` (object, optional) - Scope limiting where pattern applies
  - `glob` (string) - File glob pattern
  - `files` (string[]) - Specific files
- `metaTags` (string[], optional) - Tags for categorization
- `interactive` (boolean, optional) - If true, don't save (for review)

**Auto-Detection:**
- Thread ID from `AMP_THREAD_ID` environment variable
- Bead ID from environment or git branch
- Automatically tagged with "manual" meta-tag

**Example:**
```typescript
ace_capture_insight({
  pattern: "TypeScript ESM imports require .js extension",
  evidence: ["src/index.ts:5 - Cannot find module './auth'"],
  confidence: 0.9,
  section: "TypeScript Patterns",
  recommendation: "Always use .js extensions in import statements"
})
```

---

### 2. ace_get_insights

**Purpose:** Query learned insights from the knowledge base with filters.

**Parameters:**
- `minConfidence` (number, optional) - Minimum confidence threshold 0.0-1.0
- `section` (string, optional) - Filter by AGENTS.md section
- `tags` (string[], optional) - Filter by tags (OR logic)
- `limit` (number, optional) - Maximum results to return
- `after` (string, optional) - ISO 8601 timestamp - insights after this time
- `before` (string, optional) - ISO 8601 timestamp - insights before this time

**Returns:**
```typescript
{
  insights: Insight[],
  total: number,
  filtered: number
}
```

**Example:**
```typescript
// Get high-confidence TypeScript patterns
ace_get_insights({
  minConfidence: 0.8,
  section: "TypeScript Patterns",
  limit: 10
})

// Get recent manual insights
ace_get_insights({
  tags: ["manual"],
  after: "2025-11-01T00:00:00Z",
  limit: 20
})
```

---

### 3. ace_analyze_patterns

**Purpose:** Analyze execution traces to extract error patterns and insights.

**Parameters:**
- `traceId` (string, optional) - Specific trace ID to analyze
- `beadIds` (string[], optional) - Analyze traces from these bead IDs
- `minFrequency` (number, optional) - Minimum error occurrences (default: 1)
- `minConfidence` (number, optional) - Minimum confidence threshold (default: 0.5)

**Returns:**
```typescript
{
  patterns: Array<{
    pattern: string,
    frequency: number,
    confidence: number,
    evidence: string[]
  }>,
  tracesAnalyzed: number
}
```

**Example:**
```typescript
// Analyze traces from specific beads
ace_analyze_patterns({
  beadIds: ["ACE_Beads_Amp-269", "ACE_Beads_Amp-270"],
  minConfidence: 0.7,
  minFrequency: 2
})
```

---

## Thread & Workflow Tools

### 4. ace_query_threads

**Purpose:** Query thread↔bead associations from the thread index.

**Parameters:**
- `beadId` (string, optional) - Get all threads for this bead
- `threadId` (string, optional) - Get all beads for this thread
- `tags` (string[], optional) - Filter by tags (OR logic)
- `component` (string, optional) - Filter by component
- `limit` (number, optional) - Maximum results

**Returns:**
```typescript
{
  threads?: Array<{
    thread_id: string,
    bead_ids: string[],
    tags: string[],
    component?: string,
    first_seen: string,
    last_seen: string
  }>,
  beads?: string[],
  query: QueryThreadsParams
}
```

**Examples:**
```typescript
// Get all threads for a bead
ace_query_threads({
  beadId: "ACE_Beads_Amp-269"
})

// Get all beads worked on in current thread
ace_query_threads({
  threadId: "T-7ead7cfb-3c52-4dab-ab89-044513fb7b6d"
})

// Find threads by component
ace_query_threads({
  component: "mcp-server",
  limit: 10
})
```

**Use Cases:**
- Discover work history for a bead
- Find related beads worked on in same thread
- Track feature development across threads
- Generate project dashboards

---

### 5. ace_trigger_learning

**Purpose:** Trigger the ACE learning cycle to update AGENTS.md with learned patterns.

**Parameters:**
- `beadIds` (string[], optional) - Specific bead IDs to learn from
- `minConfidence` (number, optional) - Minimum confidence threshold 0.0-1.0
- `epochs` (number, optional) - Number of learning epochs (for offline mode)
- `mode` ('online' | 'offline', optional) - Learning mode
- `dryRun` (boolean, optional) - If true, analyze but don't apply changes

**Returns:**
```typescript
{
  triggered: boolean,
  command: string,
  beadIds?: string[],
  output?: string,
  error?: string
}
```

**Examples:**
```typescript
// Trigger learning for specific beads
ace_trigger_learning({
  beadIds: ["ACE_Beads_Amp-269", "ACE_Beads_Amp-270"],
  minConfidence: 0.8
})

// Dry run to preview changes
ace_trigger_learning({
  beadIds: ["ACE_Beads_Amp-271"],
  dryRun: true
})

// Offline learning with multiple epochs
ace_trigger_learning({
  mode: "offline",
  epochs: 3,
  minConfidence: 0.85
})
```

**Use Cases:**
- After completing work, consolidate learnings
- Periodic batch learning from multiple beads
- Preview what would be learned before applying
- Multi-epoch offline learning for better patterns

---

### 6. ace_postmortem

**Purpose:** Extract insights from all threads associated with a completed bead.

**Parameters:**
- `beadId` (string, **required**) - Bead ID to analyze
- `interactive` (boolean, optional) - If true, review insights before saving
- `minConfidence` (number, optional) - Minimum confidence for extracted insights 0.0-1.0

**Returns:**
```typescript
{
  beadId: string,
  threadsAnalyzed: number,
  insightsExtracted: number,
  status: 'success' | 'error' | 'pending',
  message: string,
  error?: string
}
```

**Example:**
```typescript
// Analyze completed work
ace_postmortem({
  beadId: "ACE_Beads_Amp-269",
  minConfidence: 0.9
})
```

**Use Cases:**
- After closing a bead, extract all learnings
- Post-mortem analysis of complex bugs
- Capture architecture decisions from implementation threads
- Build comprehensive knowledge from multi-thread work

**Note:** Currently returns stub response indicating pending LLM integration. Will automatically discover threads from `.beads/amp_metadata.jsonl` and extract insights once complete.

---

## Quick Reference Table

| Tool | Primary Use | When to Call |
|------|-------------|--------------|
| `ace_capture_insight` | Save patterns in real-time | When you discover something worth learning |
| `ace_get_insights` | Query existing knowledge | Before starting work to avoid repeating mistakes |
| `ace_analyze_patterns` | Extract from test failures | After running tests with failures |
| `ace_query_threads` | Understand work history | When you need context about past work |
| `ace_trigger_learning` | Update AGENTS.md | After completing significant work |
| `ace_postmortem` | Analyze completed beads | After closing a bead to capture all insights |

---

## Environment Variables

All tools automatically detect:
- `AMP_THREAD_ID` - Current Amp thread ID (auto-tagged on insights)
- `AMP_BEAD_ID` - Current bead being worked on
- `ACE_CONFIG_PATH` - Custom config path (default: `.ace.json`)

---

## Integration Workflow

**Typical agent workflow:**

1. **Start work** → `ace_get_insights()` to check existing patterns
2. **During work** → `ace_capture_insight()` when discovering patterns
3. **After tests fail** → `ace_analyze_patterns()` to understand errors
4. **Complete work** → `ace_trigger_learning()` to consolidate learnings
5. **Close bead** → `ace_postmortem()` to extract all insights from threads

**Cross-bead context:**

1. Query threads → `ace_query_threads({ beadId: "..." })`
2. Check related work → `ace_query_threads({ threadId: "..." })`
3. Learn from related beads → `ace_trigger_learning({ beadIds: [...] })`

---

## Testing

All tools write to the same storage as CLI commands:
- Insights → `logs/insights.jsonl`
- Threads → `.beads/thread_index.jsonl`
- Knowledge → `knowledge/AGENTS.md`

You can verify tool output using CLI commands:
```bash
# Check captured insights
ace get insights --tags manual --limit 5

# Check thread index
ace threads list

# Check learned patterns
cat knowledge/AGENTS.md
```
