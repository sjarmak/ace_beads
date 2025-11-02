# ACE MCP Server Guide

Complete guide to installing, configuring, and using the ACE MCP (Model Context Protocol) server.

## What Is the MCP Server?

The ACE MCP server exposes the ACE learning framework as a Model Context Protocol server, allowing AI coding assistants (Amp, Cline, Claude Desktop) to:
- Capture execution traces during task work
- Analyze error patterns across tasks  
- Update AGENTS.md with learned insights
- Query existing knowledge bullets

## Installation

### Option 1: Global Install (Recommended)

```bash
npm install -g ace-beads-amp
```

The MCP server is included in the package at `dist/mcp/server.js`.

### Option 2: Local Install

```bash
cd your-project
npm install ace-beads-amp --save-dev
```

Server location: `node_modules/ace-beads-amp/dist/mcp/server.js`

### Option 3: From Source

```bash
git clone https://github.com/sjarmak/ace_beads.git
cd ace_beads
npm install
npm run build
```

Server location: `dist/mcp/server.js`

## Configuration

The MCP server uses stdio transport and requires configuration in your AI assistant's MCP config file.

### Amp Configuration

Add to `~/.config/amp/config.json`:

```json
{
  "mcpServers": {
    "ace": {
      "command": "node",
      "args": ["/Users/yourusername/ACE_Beads_Amp/dist/mcp/server.js"],
      "env": {
        "ACE_KNOWLEDGE_BASE": "/path/to/your-project/AGENTS.md",
        "ACE_TRACES_PATH": "/path/to/your-project/logs/execution_traces.jsonl",
        "ACE_INSIGHTS_PATH": "/path/to/your-project/logs/insights.jsonl"
      }
    }
  }
}
```

**For global install:**
```json
{
  "mcpServers": {
    "ace": {
      "command": "ace-mcp-server"
    }
  }
}
```

### Cline Configuration (VS Code)

Add to VS Code settings (`.vscode/settings.json` or user settings):

```json
{
  "cline.mcpServers": {
    "ace": {
      "command": "node",
      "args": ["/Users/yourusername/ACE_Beads_Amp/dist/mcp/server.js"]
    }
  }
}
```

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "ace": {
      "command": "node",
      "args": ["/Users/yourusername/ACE_Beads_Amp/dist/mcp/server.js"]
    }
  }
}
```

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux:** `~/.config/Claude/claude_desktop_config.json`

## Running the Server

The MCP server starts automatically when your AI assistant connects. You don't run it manually.

### Verify Server Is Running

After configuring, restart your AI assistant and check logs:

**Amp:**
```bash
tail -f ~/.config/amp/logs/mcp-ace.log
```

**Claude Desktop:**
```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp-ace.log
```

You should see:
```
[ACE MCP Server] Started successfully on stdio
[ACE MCP Server] Config: {...}
```

## Available Tools

The server exposes four MCP tools:

### 1. ace_capture_trace

**Purpose:** Capture execution traces during task work  
**Use when:** Recording build/test/lint failures for later analysis

**Parameters:**
```typescript
{
  beadId: string;              // Task ID (e.g., "ACE_Beads_Amp-42")
  taskDescription?: string;    // Optional task description
  executions: Array<{
    runner: string;            // Tool: "tsc" | "vitest" | "eslint"
    command: string;           // Full command run
    status: "pass" | "fail";
    errors: Array<{
      tool: string;
      severity: "error" | "warning" | "info";
      message: string;
      file: string;
      line: number;
      column?: number;
    }>;
  }>;
  discoveredIssues?: string[]; // Linked bead IDs
  outcome?: "success" | "failure" | "partial";
}
```

**Example:**
```bash
# Via Amp
amp "Capture the failed build for ACE_Beads_Amp-42"
```

The assistant will call:
```javascript
mcp.callTool('ace_capture_trace', {
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
```

### 2. ace_analyze_patterns

**Purpose:** Extract insights from execution traces  
**Use when:** Analyzing single task or finding patterns across multiple tasks

**Parameters:**
```typescript
{
  mode: "single" | "batch";
  traceId?: string;           // For single mode
  beadIds?: string[];         // For batch mode
  minConfidence?: number;     // Filter threshold (0.0-1.0)
  minFrequency?: number;      // Batch mode: min occurrences
}
```

**Examples:**

**Single trace analysis:**
```bash
amp "Analyze the trace from ACE_Beads_Amp-42"
```

**Batch analysis:**
```bash
amp "Find patterns across tasks ACE_Beads_Amp-40 through ACE_Beads_Amp-45"
```

### 3. ace_update_knowledge

**Purpose:** Apply insights to AGENTS.md  
**Use when:** Updating knowledge base with learned patterns

**Parameters:**
```typescript
{
  minConfidence?: number;      // Default: 0.8
  maxDeltas?: number;          // Default: 3
  dryRun?: boolean;            // Preview without writing
  forceInsightIds?: string[];  // Force specific insights
}
```

**Examples:**

**Normal update:**
```bash
amp "Update AGENTS.md with recent insights"
```

**Dry run (preview):**
```bash
amp "Show me what would be added to AGENTS.md without applying"
```

**High confidence only:**
```bash
amp "Update AGENTS.md with only high-confidence patterns (>0.9)"
```

### 4. ace_get_insights

**Purpose:** Query learned patterns  
**Use when:** Checking existing knowledge before starting work

**Parameters:**
```typescript
{
  source: "insights" | "bullets" | "both";
  filters?: {
    minConfidence?: number;
    tags?: string[];          // e.g., ["typescript", "build"]
    sections?: string[];      // e.g., ["TypeScript Patterns"]
    beadIds?: string[];
    after?: string;           // ISO timestamp
    before?: string;
  };
  limit?: number;             // Default: 50
  sortBy?: "confidence" | "timestamp" | "helpful";
}
```

**Examples:**

**Check TypeScript patterns:**
```bash
amp "What TypeScript patterns have we learned?"
```

**Query recent insights:**
```bash
amp "Show me insights from the last week with confidence > 0.85"
```

**Most helpful patterns:**
```bash
amp "What are our top 10 most helpful patterns?"
```

## Usage Workflows

### Workflow 1: Auto-Learning During Development

```bash
# 1. Start work on a task
amp "Work on ACE_Beads_Amp-42: Add authentication"

# Agent works, encounters build failure
# → Automatically calls ace_capture_trace

# 2. Complete the task
amp "The task is complete"

# → Agent automatically:
#    - Calls ace_analyze_patterns (if traces exist)
#    - Calls ace_update_knowledge (if insights generated)
```

### Workflow 2: Batch Learning After Sprint

```bash
# After completing 10 tasks, analyze all at once
amp "Analyze patterns from ACE_Beads_Amp-40 through ACE_Beads_Amp-50 and update AGENTS.md"

# Agent calls:
# 1. ace_analyze_patterns with mode: "batch"
# 2. ace_update_knowledge with learned insights
```

### Workflow 3: Query Before Starting

```bash
# Before refactoring TypeScript code
amp "What TypeScript patterns should I be aware of?"

# Agent calls ace_get_insights
# Returns relevant bullets from AGENTS.md
```

### Workflow 4: Manual Review

```bash
# Preview what would be added
amp "Show me what patterns would be added to AGENTS.md in dry-run mode"

# Agent calls ace_update_knowledge with dryRun: true
# You review the proposed changes
# Then: "Apply those changes" to actually update
```

## Server Configuration Options

The server accepts configuration via constructor (when imported as a module):

```typescript
import { ACEMCPServer } from 'ace-beads-amp/dist/mcp/server.js';

const server = new ACEMCPServer({
  knowledgeBasePath: '/custom/path/AGENTS.md',
  executionTracePath: '/custom/path/logs/execution_traces.jsonl',
  insightsPath: '/custom/path/logs/insights.jsonl',
  maxDeltasPerSession: 5,           // Default: 3
  defaultConfidenceThreshold: 0.85   // Default: 0.8
});

await server.start();
```

## Environment Variables

Override default paths via environment variables:

```bash
export ACE_KNOWLEDGE_BASE="/path/to/AGENTS.md"
export ACE_TRACES_PATH="/path/to/logs/execution_traces.jsonl"
export ACE_INSIGHTS_PATH="/path/to/logs/insights.jsonl"
export ACE_MAX_DELTAS="5"
export ACE_MIN_CONFIDENCE="0.85"
```

Then configure your AI assistant to use these:

```json
{
  "mcpServers": {
    "ace": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "ACE_KNOWLEDGE_BASE": "/your-project/AGENTS.md"
      }
    }
  }
}
```

## Troubleshooting

### Server Not Starting

**Check logs:**
```bash
# Amp
tail -f ~/.config/amp/logs/mcp-ace.log

# Claude Desktop
tail -f ~/Library/Logs/Claude/mcp-ace.log
```

**Common issues:**
1. **Wrong path:** Verify `server.js` path is correct and built
2. **Node version:** Requires Node.js >= 18
3. **Permissions:** Server needs read/write access to AGENTS.md and logs/

### Tools Not Available

**In Amp:**
```bash
amp "List available MCP servers"
```

Should show `ace` server with 4 tools.

**If missing:**
1. Restart Amp after config change
2. Check config JSON syntax
3. Verify server path is absolute

### "NOT_IMPLEMENTED" Errors

The server stubs may not be fully implemented. Check:
```bash
grep "TODO: Implementation needed" dist/mcp/server.js
```

If you see TODOs, the server needs full implementation. See [MCP_VS_TOOLBOX.md](../MCP_VS_TOOLBOX.md) for implementation status.

### File Not Found Errors

**Error:** `AGENTS.md or log file missing`

**Fix:**
```bash
# Create required files
mkdir -p logs
touch AGENTS.md
touch logs/execution_traces.jsonl
touch logs/insights.jsonl
```

Or run:
```bash
ace init
```

### Permission Denied

**Error:** `EACCES: permission denied`

**Fix:**
```bash
chmod 644 AGENTS.md
chmod 644 logs/*.jsonl
chmod 755 logs/
```

## Integration with CLI

The MCP server complements the CLI tools:

**CLI (direct):**
```bash
ace capture --bead ACE_Beads_Amp-42 --exec results.json
ace analyze batch --beads ACE_Beads_Amp-40,ACE_Beads_Amp-41
ace update --min-confidence 0.8
```

**MCP (via AI assistant):**
```bash
amp "Capture execution for ACE_Beads_Amp-42"
amp "Analyze patterns and update knowledge"
```

Both approaches write to the same files:
- `logs/execution_traces.jsonl`
- `logs/insights.jsonl`  
- `AGENTS.md`

## Querying Server Metrics

The server exposes operational metrics via the `ace://metrics/operational` resource.

### Using Amp

```bash
amp "Show me the ACE server metrics"
```

The assistant will read the `ace://metrics/operational` resource and display:
- Total calls to each tool (ace_capture_trace, ace_analyze_patterns, etc.)
- Server start time
- Server uptime in seconds

### Example Metrics Output

```json
{
  "toolCalls": {
    "ace_capture_trace": 15,
    "ace_analyze_patterns": 8,
    "ace_update_knowledge": 5,
    "ace_get_insights": 12
  },
  "startTime": "2025-11-01T10:30:00.000Z",
  "uptime": 3600
}
```

### Use Cases

**Monitor usage:**
```bash
amp "How many times have we updated knowledge today?"
```

**Check server health:**
```bash
amp "Is the ACE server running? Show uptime."
```

**Track learning activity:**
```bash
amp "Show me all ACE metrics and tell me if we're learning from our work"
```

## Advanced Usage

### Custom Configuration Per Project

Create `.ace.json` in your project root:

```json
{
  "knowledgeBasePath": "./docs/AGENTS.md",
  "executionTracePath": "./.ace/traces.jsonl",
  "insightsPath": "./.ace/insights.jsonl",
  "maxDeltasPerSession": 5,
  "defaultConfidenceThreshold": 0.85
}
```

Then point MCP config to a wrapper script:

```bash
#!/bin/bash
# ace-server-wrapper.sh
cd /path/to/project
node /path/to/ace/dist/mcp/server.js --config .ace.json
```

### Multi-Project Setup

Run separate server instances per project:

```json
{
  "mcpServers": {
    "ace-project-a": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "ACE_KNOWLEDGE_BASE": "/projects/a/AGENTS.md"
      }
    },
    "ace-project-b": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "ACE_KNOWLEDGE_BASE": "/projects/b/AGENTS.md"
      }
    }
  }
}
```

Then in Amp:
```bash
amp "Use ace-project-a to analyze recent patterns"
```

### Programmatic Usage

Import and use in your own scripts:

```typescript
import { initServer } from 'ace-beads-amp/dist/mcp/server.js';

// Start server with custom config
await initServer({
  knowledgeBasePath: './AGENTS.md',
  maxDeltasPerSession: 10
});
```

## Next Steps

1. ✅ Install and configure the MCP server
2. Work on 3-5 tasks using your AI assistant
3. Check AGENTS.md - it should auto-populate with patterns
4. Query learned patterns before starting new work
5. After 10-20 tasks, your assistant avoids past mistakes

## See Also

- [INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md) - Manual ACE setup
- [ACE_MCP_DESIGN.md](../mcp/ACE_MCP_DESIGN.md) - Server API reference
- [CLI_DESIGN.md](../CLI_DESIGN.md) - CLI command reference
- [Amp MCP Documentation](https://ampcode.com/manual/mcp)
