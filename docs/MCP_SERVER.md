# ACE Learning MCP Server

MCP (Model Context Protocol) server that exposes ACE framework learning capabilities to AI agents.

## Features

- **ace_capture_insight** - Capture learned patterns to insights.jsonl
- **ace_get_insights** - Query existing insights with filters
- **ace_analyze_patterns** - Analyze execution traces for error patterns

## Setup

### 1. Build the server

```bash
npm run build
```

### 2. Configure Amp

The MCP server is already configured in `.amp-config.json`:

```json
{
  "mcpServers": {
    "ace-learning": {
      "command": "node",
      "args": ["dist/src/mcp/server.js"],
      "description": "ACE framework learning and insights server"
    }
  }
}
```

### 3. Test the server

Run the server directly:

```bash
npm run mcp:server
```

Or use the `ace-mcp-server` binary after installation:

```bash
ace-mcp-server
```

## Tools

### ace_capture_insight

Capture a learned pattern or insight to the ACE knowledge base.

**Parameters:**
- `pattern` (required) - The pattern discovered (e.g., "TypeScript ESM requires .js extensions")
- `evidence` (required) - Array of evidence (file paths, error messages)
- `confidence` (required) - Confidence level 0.0-1.0 (use 0.8+ for high-confidence)
- `section` (required) - AGENTS.md section (e.g., "TypeScript Patterns")
- `recommendation` (optional) - Actionable recommendation
- `scope` (optional) - Scope limiting where pattern applies
- `metaTags` (optional) - Tags for categorization
- `interactive` (optional) - If true, generate but don't save (for review)

**Auto-tagging:**
- Automatically tags insights with `AMP_THREAD_ID` environment variable if available
- Useful for tracking which Amp thread discovered the pattern

**Example:**

```json
{
  "pattern": "TypeScript ESM imports require .js extension",
  "evidence": ["src/index.ts:5 - Cannot find module './auth'"],
  "confidence": 0.9,
  "section": "TypeScript Patterns",
  "recommendation": "Always use .js extensions in TypeScript import statements"
}
```

### ace_get_insights

Query learned insights from the knowledge base.

**Parameters:**
- `minConfidence` (optional) - Minimum confidence threshold
- `section` (optional) - Filter by section
- `tags` (optional) - Filter by tags (OR logic)
- `limit` (optional) - Maximum results to return
- `after` (optional) - ISO 8601 timestamp - insights after this time
- `before` (optional) - ISO 8601 timestamp - insights before this time

**Returns:**
- `insights` - Array of matching insights
- `total` - Total insights before filtering
- `filtered` - Number of results after filtering

**Example:**

```json
{
  "minConfidence": 0.8,
  "section": "TypeScript Patterns",
  "limit": 10
}
```

### ace_analyze_patterns

Analyze execution traces to extract error patterns.

**Parameters:**
- `traceId` (optional) - Specific trace ID to analyze
- `beadIds` (optional) - Array of bead IDs to analyze
- `minFrequency` (optional) - Minimum error occurrences (default: 1)
- `minConfidence` (optional) - Minimum confidence (default: 0.5)

**Returns:**
- `patterns` - Array of detected patterns with frequency, confidence, evidence
- `tracesAnalyzed` - Number of traces analyzed

**Example:**

```json
{
  "beadIds": ["bd-123", "bd-124"],
  "minFrequency": 2,
  "minConfidence": 0.7
}
```

## Usage in Amp Threads

When an Amp agent uses these tools:

1. The `AMP_THREAD_ID` environment variable is automatically detected
2. All captured insights are tagged with the thread ID
3. Query insights by thread ID to see what that thread learned

This creates a feedback loop where agents can:
- Capture insights during work
- Query insights before starting new work
- Build on previous learnings

## Integration with ACE CLI

The MCP server complements the CLI commands:

- MCP tools are for **real-time agent interaction**
- CLI commands are for **human workflows** (manual learning, batch analysis)

Both write to the same `logs/insights.jsonl` file, maintaining a unified knowledge base.

## Environment Variables

- `AMP_THREAD_ID` - Auto-tagged on captured insights (set by Amp)
- `ACE_CONFIG_PATH` - Optional custom config path (default: `.ace.json`)

## Testing

Test each tool using the MCP inspector or by invoking through Amp:

```bash
# Build first
npm run build

# Run server
npm run mcp:server
```

Then in an Amp thread, use the tools:
- "Use ace_capture_insight to record this TypeScript pattern..."
- "Query insights with ace_get_insights for TypeScript patterns..."
- "Analyze recent traces with ace_analyze_patterns..."
