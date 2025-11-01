# ACE MCP Server Interface Design

## Overview

This document defines the MCP (Model Context Protocol) server interface for the ACE (Agentic Context Engineering) framework. The server exposes four core tools that wrap the existing Generator, Reflector, and Curator agent logic.

## MCP Server Metadata

**Server Name:** `ace-learning-server`  
**Version:** `1.0.0`  
**Protocol:** MCP (Model Context Protocol)  
**Transport:** stdio (standard input/output)

## Tool Definitions

### 1. `ace_capture_trace`

Captures execution traces during task execution. Wraps `Generator.ts` logic.

**Description:**  
Records execution results (build/test/lint outcomes) and associates them with a task. Used to capture failures and errors that the Reflector will later analyze for patterns.

**Parameters:**
```typescript
{
  beadId: string;           // Bead/task identifier (e.g., "ACE_Beads_Amp-42")
  taskDescription?: string; // Optional description (defaults to bead title)
  executions: Array<{       // Array of execution results
    runner: string;         // Tool that ran (e.g., "tsc", "vitest", "eslint")
    command: string;        // Command executed (e.g., "npm run build")
    status: "pass" | "fail"; // Execution outcome
    errors: Array<{         // Errors encountered (empty for pass)
      tool: string;         // Tool that reported error
      severity: "error" | "warning" | "info";
      message: string;      // Error message
      file: string;         // File path
      line: number;         // Line number
      column?: number;      // Optional column number
    }>;
  }>;
  discoveredIssues?: string[]; // Optional array of discovered bead IDs
  outcome?: "success" | "failure" | "partial"; // Overall outcome
}
```

**Returns:**
```typescript
{
  traceId: string;          // Generated trace identifier
  timestamp: string;        // ISO 8601 timestamp
  written: boolean;         // Whether trace was written to logs/execution_traces.jsonl
  bulletsConsulted: number; // Number of knowledge bullets loaded
}
```

**Implementation Notes:**
- Initializes `Generator` with default paths
- Calls `startTask()`, `recordExecution()` for each execution
- Calls `recordDiscoveredIssue()` for each discovered issue
- Calls `completeTask()` to finalize and write trace
- Writes to: `/Users/sjarmak/ACE_Beads_Amp/logs/execution_traces.jsonl`

---

### 2. `ace_analyze_patterns`

Analyzes execution traces to extract insights. Wraps `Reflector.ts` logic.

**Description:**  
Processes execution traces to identify error patterns, recurring issues, and learning opportunities. Can analyze a single trace or multiple traces to find cross-task patterns.

**Parameters:**
```typescript
{
  mode: "single" | "batch";     // Analysis mode
  traceId?: string;             // For single mode: specific trace to analyze
  beadIds?: string[];           // For batch mode: analyze traces from these beads
  minConfidence?: number;       // Filter insights by minimum confidence (0.0-1.0)
  minFrequency?: number;        // For batch mode: minimum error occurrences
}
```

**Returns:**
```typescript
{
  insights: Array<{
    id: string;                 // Insight UUID
    timestamp: string;          // ISO 8601 timestamp
    taskId: string;             // Primary bead ID
    source: {
      runner?: string;          // Tool that produced errors
      beadIds: string[];        // All related bead IDs
    };
    signal: {
      pattern: string;          // Pattern description
      evidence: string[];       // Supporting evidence
    };
    recommendation: string;     // Actionable recommendation
    scope: {
      files?: string[];         // Affected file paths
      glob?: string;            // File pattern (e.g., "**/*.ts")
    };
    confidence: number;         // 0.0-1.0
    onlineEligible: boolean;    // Can be applied immediately?
    metaTags: string[];         // Categorization tags
  }>;
  tracesAnalyzed: number;       // Count of traces processed
  written: boolean;             // Whether insights written to logs/insights.jsonl
}
```

**Implementation Notes:**
- Initializes `Reflector` with default paths
- For `single` mode: loads specific trace, calls `analyzeTrace()`
- For `batch` mode: calls `analyzeMultipleTraces()` with optional bead filters
- Filters results by `minConfidence` if provided
- Writes to: `/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl`

---

### 3. `ace_update_knowledge`

Updates AGENTS.md with learned patterns. Wraps `Curator.ts` logic.

**Description:**  
Processes insights from the Reflector and applies them as delta updates to AGENTS.md. Handles deduplication, section routing, and bullet formatting with helpfulness counters.

**Parameters:**
```typescript
{
  minConfidence?: number;       // Minimum confidence threshold (default: 0.8)
  maxDeltas?: number;           // Max updates per session (default: 3)
  dryRun?: boolean;             // Preview changes without writing (default: false)
  forceInsightIds?: string[];   // Force process specific insights regardless of confidence
}
```

**Returns:**
```typescript
{
  deltas: Array<{
    bulletId: string;           // Generated bullet ID (8-char hex)
    section: string;            // Target section in AGENTS.md
    content: string;            // Full bullet text
    confidence: number;         // Insight confidence
    applied: boolean;           // Whether actually written (false in dryRun)
  }>;
  duplicatesSkipped: number;    // Count of duplicate patterns skipped
  lowConfidenceSkipped: number; // Count of insights below threshold
  updated: boolean;             // Whether AGENTS.md was modified
}
```

**Implementation Notes:**
- Initializes `Curator` with paths and `maxDeltas`
- Calls `processInsights(minConfidence)`
- In `dryRun` mode: generates deltas but doesn't write to AGENTS.md
- Uses section mapping:
  - TypeScript/module errors → "TypeScript Patterns"
  - Build/test errors → "Build & Test Patterns"
  - Discovery chains → "Dependency Patterns"
  - High-level patterns → "Architecture Patterns"
- Updates: `/Users/sjarmak/ACE_Beads_Amp/AGENTS.md`

---

### 4. `ace_get_insights`

Queries learned patterns and insights. New query-only tool.

**Description:**  
Retrieves insights from logs/insights.jsonl or extracts bullets from AGENTS.md. Supports filtering by confidence, tags, sections, and time ranges. Does not modify any files.

**Parameters:**
```typescript
{
  source: "insights" | "bullets" | "both"; // What to query
  filters?: {
    minConfidence?: number;     // Filter by confidence (0.0-1.0)
    tags?: string[];            // Filter by metaTags (OR logic)
    sections?: string[];        // Filter bullets by section (OR logic)
    beadIds?: string[];         // Filter by related beads
    after?: string;             // ISO 8601 timestamp: insights after this time
    before?: string;            // ISO 8601 timestamp: insights before this time
  };
  limit?: number;               // Max results to return (default: 50)
  sortBy?: "confidence" | "timestamp" | "helpful"; // Sort order
}
```

**Returns:**
```typescript
{
  insights?: Array<{            // If source includes "insights"
    id: string;
    timestamp: string;
    taskId: string;
    recommendation: string;
    confidence: number;
    onlineEligible: boolean;
    metaTags: string[];
  }>;
  bullets?: Array<{             // If source includes "bullets"
    id: string;                 // Bullet ID (8-char hex)
    content: string;            // Pattern description
    helpful: number;            // Helpfulness counter
    harmful: number;            // Harmfulness counter
    section: string;            // Section name in AGENTS.md
    score: number;              // helpful - harmful
  }>;
  totalMatched: number;         // Total matches before limit
  filtered: boolean;            // Whether filters were applied
}
```

**Implementation Notes:**
- Read-only operation
- For `insights`: parses `/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl`
- For `bullets`: parses `/Users/sjarmak/ACE_Beads_Amp/AGENTS.md` using regex from `Generator.loadKnowledgeBullets()`
- Applies filters in order: time range → confidence → tags → beadIds → sections
- Sorts results before applying limit
- Returns metadata about filtering/limiting

---

## MCP Resources

The server exposes read-only resources for quick access:

### Resource: `ace://knowledge/bullets`
**URI:** `ace://knowledge/bullets`  
**MIME Type:** `application/json`  
**Description:** All knowledge bullets from AGENTS.md  
**Content:** Array of bullets with IDs, content, counters, sections

### Resource: `ace://knowledge/sections`
**URI:** `ace://knowledge/sections`  
**MIME Type:** `application/json`  
**Description:** Available sections in AGENTS.md  
**Content:** Array of section names for routing

### Resource: `ace://logs/recent-insights`
**URI:** `ace://logs/recent-insights`  
**MIME Type:** `application/json`  
**Description:** Last 20 insights from insights.jsonl  
**Content:** Array of recent insights with timestamps

---

## File Paths (Configurable via Constructor)

All paths default to `/Users/sjarmak/ACE_Beads_Amp/` but can be overridden:

```typescript
const server = new ACEMCPServer({
  knowledgeBasePath: '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md',
  executionTracePath: '/Users/sjarmak/ACE_Beads_Amp/logs/execution_traces.jsonl',
  insightsPath: '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
  maxDeltasPerSession: 3,
  defaultConfidenceThreshold: 0.8,
});
```

---

## Error Handling

All tools return structured errors:

```typescript
{
  error: {
    code: string;           // Error code (e.g., "TRACE_NOT_FOUND")
    message: string;        // Human-readable error
    details?: any;          // Additional context
  }
}
```

**Error Codes:**
- `INVALID_PARAMS`: Missing or invalid parameters
- `TRACE_NOT_FOUND`: TraceId doesn't exist in logs
- `FILE_NOT_FOUND`: AGENTS.md or log file missing
- `PARSE_ERROR`: Failed to parse JSONL or markdown
- `WRITE_ERROR`: Failed to write to file
- `SECTION_NOT_FOUND`: Target section missing in AGENTS.md

---

## Workflow Examples

### Example 1: Full Learning Cycle via MCP

```typescript
// 1. Capture execution during task
const trace = await mcp.callTool('ace_capture_trace', {
  beadId: 'ACE_Beads_Amp-42',
  executions: [{
    runner: 'tsc',
    command: 'npm run build',
    status: 'fail',
    errors: [{
      tool: 'tsc',
      severity: 'error',
      message: 'Cannot find module ./auth.js',
      file: 'src/index.ts',
      line: 5
    }]
  }],
  outcome: 'failure'
});

// 2. Analyze the trace
const analysis = await mcp.callTool('ace_analyze_patterns', {
  mode: 'single',
  traceId: trace.traceId
});

// 3. Update knowledge base
const update = await mcp.callTool('ace_update_knowledge', {
  minConfidence: 0.8,
  maxDeltas: 3
});

// 4. Query what was learned
const learned = await mcp.callTool('ace_get_insights', {
  source: 'bullets',
  filters: { sections: ['TypeScript Patterns'] },
  limit: 10,
  sortBy: 'helpful'
});
```

### Example 2: Batch Analysis Across Tasks

```typescript
// Analyze patterns across multiple completed tasks
const patterns = await mcp.callTool('ace_analyze_patterns', {
  mode: 'batch',
  beadIds: ['ACE_Beads_Amp-40', 'ACE_Beads_Amp-41', 'ACE_Beads_Amp-42'],
  minConfidence: 0.7,
  minFrequency: 2  // Only patterns that occurred 2+ times
});

// Apply high-confidence patterns
const applied = await mcp.callTool('ace_update_knowledge', {
  minConfidence: 0.85,
  maxDeltas: 5
});
```

### Example 3: Query Insights for Context

```typescript
// Before starting TypeScript refactor, check past patterns
const tsPatterns = await mcp.callTool('ace_get_insights', {
  source: 'bullets',
  filters: {
    sections: ['TypeScript Patterns'],
    tags: ['type-error', 'import']
  },
  sortBy: 'helpful',
  limit: 5
});

// Use returned patterns to inform current work
console.log(tsPatterns.bullets);
```

---

## Implementation Checklist

- [ ] Create `mcp/server.ts` with MCP SDK setup
- [ ] Implement `ace_capture_trace` tool handler
- [ ] Implement `ace_analyze_patterns` tool handler
- [ ] Implement `ace_update_knowledge` tool handler
- [ ] Implement `ace_get_insights` tool handler
- [ ] Add resource handlers for `ace://` URIs
- [ ] Add parameter validation for all tools
- [ ] Add error handling with structured codes
- [ ] Write integration tests for each tool
- [ ] Update package.json with MCP server entry point
- [ ] Document client configuration in README

---

## Client Configuration

After implementation, clients add to their MCP config:

**Amp (`~/.config/amp/config.json`):**
```json
{
  "mcpServers": {
    "ace": {
      "command": "node",
      "args": ["/Users/sjarmak/ACE_Beads_Amp/dist/mcp/server.js"]
    }
  }
}
```

**Cline (VS Code settings):**
```json
{
  "cline.mcpServers": {
    "ace": {
      "command": "node",
      "args": ["/Users/sjarmak/ACE_Beads_Amp/dist/mcp/server.js"]
    }
  }
}
```

**Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "ace": {
      "command": "node",
      "args": ["/Users/sjarmak/ACE_Beads_Amp/dist/mcp/server.js"]
    }
  }
}
```
