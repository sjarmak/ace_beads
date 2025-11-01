# ACE CLI Design

Based on oracle analysis and https://clig.dev/ best practices.

## Overview

Single-binary CLI tool (`ace`) for the ACE (Agentic Context Engineering) framework. Distributed via Bun compilation for fast, dependency-free execution.

## Core Workflow

```bash
ace init                    # Set up project
ace capture --bead <id> ... # Record execution trace
ace analyze batch           # Extract patterns
ace update                  # Apply to AGENTS.md
# OR use convenience pipeline:
ace learn                   # analyze → update
```

## Commands

### `ace init`
Scaffold ACE files and directories (idempotent).

```bash
ace init [--agents <path>] [--logs-dir <dir>] [--yes]
```

Creates:
- `logs/` directory
- `logs/execution_traces.jsonl`
- `logs/insights.jsonl`
- `AGENTS.md` with required sections

Output: Summary + paths (JSON with `--json`)

---

### `ace capture`
Record execution trace in one-shot.

```bash
# Flags mode
ace capture --bead <id> --exec <json-file|-> [options]

# Stdin mode
echo '{...}' | ace capture --stdin
```

**Flags:**
- `--bead <id>` (required) - Bead/task identifier
- `--desc <text>` - Description (defaults to bead title)
- `--exec <path|->` - JSON file with executions array or stdin `-`
- `--discovered <id,id,...>` - Discovered issue IDs
- `--outcome success|failure|partial` - Overall outcome
- `--kb <path>` - Override AGENTS.md path
- `--traces <path>` - Override traces path

**Output:**
```json
{
  "traceId": "uuid",
  "timestamp": "2025-10-29T...",
  "written": true,
  "bulletsConsulted": 42
}
```

---

### `ace analyze`
Generate insights from traces.

```bash
# Single trace
ace analyze single --trace <traceId> [--min-confidence 0.8]

# Batch analysis
ace analyze batch [--beads <id,id,...>] [--min-confidence 0.8] [--min-frequency 2]
```

**Flags:**
- `--trace <id>` - Specific trace ID (single mode)
- `--beads <ids>` - Filter by bead IDs (batch mode)
- `--min-confidence <0..1>` - Filter threshold
- `--min-frequency <N>` - Min occurrences (batch)
- `--dry-run` - Don't write insights
- `--insights <path>` - Override insights path

**Output:**
```json
{
  "insights": [...],
  "tracesAnalyzed": 5,
  "written": true
}
```

---

### `ace update`
Apply insights to AGENTS.md.

```bash
ace update [--min-confidence 0.8] [--max-deltas 3] [--dry-run]
```

**Flags:**
- `--min-confidence <0..1>` - Threshold (default: 0.8)
- `--max-deltas <N>` - Max updates per session (default: 3)
- `--dry-run` - Preview without writing
- `--agents <path>` - Override AGENTS.md path
- `--insights <path>` - Override insights path

**Output:**
```json
{
  "deltas": [{
    "bulletId": "a1b2c3d4",
    "section": "TypeScript Patterns",
    "content": "Always use .js extensions...",
    "confidence": 0.85,
    "applied": true
  }],
  "duplicatesSkipped": 2,
  "lowConfidenceSkipped": 5,
  "updated": true
}
```

---

### `ace learn`
Convenience pipeline (analyze → update).

```bash
ace learn [--beads <id,id,...>] [--min-confidence 0.8] [--max-deltas 3] [--dry-run]
```

Combines analyze batch + update with same confidence threshold.

**Output:**
```json
{
  "insights": [...],
  "deltas": [...],
  "updated": true
}
```

---

### `ace get`
Query insights or bullets (read-only).

```bash
# Query insights
ace get insights [--min-confidence 0.8] [--tags t1,t2] [--beads b1,b2] [--limit 10]

# Query bullets
ace get bullets [--sections s1,s2] [--limit 5] [--sort-by helpful]
```

**Insights flags:**
- `--min-confidence <0..1>`
- `--tags <t1,t2>` - Filter by tags (OR)
- `--beads <id,id>` - Filter by beads
- `--after <ISO>` - After timestamp
- `--before <ISO>` - Before timestamp
- `--limit <N>` - Max results
- `--sort-by confidence|timestamp`

**Bullets flags:**
- `--sections <s1,s2>` - Filter by sections (OR)
- `--limit <N>`
- `--sort-by helpful|score`

---

### `ace beads`
Beads integration.

```bash
# Install hook
ace beads hook install

# Manual trigger
ace beads on-close --bead <id>
```

**Subcommands:**
- `hook install` - Sets up post-close hook
- `on-close --bead <id>` - Run learning for specific bead

---

### `ace trace`
Introspection (optional).

```bash
ace trace list [--limit 10] [--beads <ids>]
ace trace show <traceId>
```

---

## Global Flags

- `--json` - Structured JSON output
- `--verbose|-v` - Debug logs to stderr
- `--quiet|-q` - Suppress info logs
- `--config <path>` - Config file override
- `--cwd <dir>` - Working directory

---

## Configuration

**Precedence:** flags > env > project config > user config > defaults

### Project Config (`.ace.json`)
```json
{
  "agentsPath": "AGENTS.md",
  "logsDir": "logs",
  "insightsPath": "logs/insights.jsonl",
  "tracesPath": "logs/execution_traces.jsonl",
  "maxDeltas": 3,
  "defaultConfidence": 0.8
}
```

### User Config (`~/.config/ace/config.json`)
Same schema as project config.

### Environment Variables
- `ACE_AGENTS_PATH`
- `ACE_TRACES_PATH`
- `ACE_INSIGHTS_PATH`
- `ACE_LOGS_DIR`
- `ACE_MAX_DELTAS`
- `ACE_CONFIDENCE`

---

## Exit Codes

- `0` - Success
- `2` - Invalid arguments
- `3` - I/O error
- `4` - Not found
- `5` - Conflict
- `6` - External tool missing (bd)
- `7` - Parse error

---

## Error Messages (clig.dev aligned)

Clear, actionable, suggest next step:

```
❌ AGENTS.md not found at ./AGENTS.md
   Run 'ace init' or pass --agents <path>

❌ Invalid --min-confidence 1.2
   Must be between 0 and 1

❌ Beads CLI (bd) not found in PATH
   Install: https://github.com/steveyegge/beads
```

In `--json` mode:
```json
{
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "AGENTS.md not found at ./AGENTS.md",
    "details": { "path": "./AGENTS.md" }
  }
}
```

---

## Distribution via Bun

### Build
```bash
bun build src/cli.ts --compile --outfile dist/ace
```

### Multi-platform Releases
GitHub Actions matrix:
- macOS x64, macOS ARM64
- Linux x64
- Windows x64

Each produces: `ace-${os}-${arch}` binary

### Installation

**Global (recommended):**
```bash
# macOS/Linux
curl -L https://github.com/org/ace/releases/download/v1.0.0/ace-$(uname -s)-$(uname -m) -o /usr/local/bin/ace
chmod +x /usr/local/bin/ace

# Windows
# Download ace-windows-x64.exe, rename to ace.exe, add to PATH
```

**Homebrew (optional):**
```bash
brew tap org/ace
brew install ace
```

**Local project:**
```bash
# Download to tools/
./tools/ace learn

# Or via npm (node fallback)
npm i -D @ace/cli
npx ace learn
```

---

## Example Workflows

### Initialize Project
```bash
ace init
bd init  # if not done
```

### Capture Trace from Script
```bash
# Create execution JSON
cat > exec.json << 'EOF'
[{
  "runner": "tsc",
  "command": "npm run build",
  "status": "fail",
  "errors": [{
    "tool": "tsc",
    "severity": "error",
    "message": "Cannot find module './auth.js'",
    "file": "src/index.ts",
    "line": 5
  }]
}]
EOF

# Capture trace
ace capture --bead ACE-42 --desc "Fix imports" --exec exec.json
```

### Learning Cycle After Task
```bash
bd close ACE-42 --reason "Completed"
ace beads on-close --bead ACE-42

# Or with hook installed:
ace beads hook install  # once
bd close ACE-42 --reason "Done"  # auto-triggers ace learn
```

### Query Learned Patterns
```bash
# Get top TypeScript patterns
ace get bullets --sections "TypeScript Patterns" --sort-by helpful --limit 5

# Get recent high-confidence insights
ace get insights --min-confidence 0.8 --tags tsc,error-pattern --limit 10 --json
```

### Dry Run Learning
```bash
ace learn --dry-run --json | jq .deltas
```

---

## Project Structure

```
ace/
├── src/
│   ├── cli.ts                  # Entry point
│   ├── commands/
│   │   ├── init.ts
│   │   ├── capture.ts
│   │   ├── analyze.ts
│   │   ├── update.ts
│   │   ├── learn.ts
│   │   ├── get.ts
│   │   ├── beads.ts
│   │   └── trace.ts
│   └── lib/
│       ├── generator.ts        # From agents/Generator.ts
│       ├── reflector.ts        # From agents/Reflector.ts
│       ├── curator.ts          # From agents/Curator.ts
│       ├── types.ts            # From mcp/types.ts
│       └── beads-client.ts     # From mcp/beads-client.ts
├── bin/
│   └── ace                     # Dev shim: bun run src/cli.ts
├── dist/
│   └── ace                     # Compiled binary
├── package.json
└── bunfig.toml
```

---

## Implementation Checklist

- [ ] Restructure: move `mcp/*` → `lib/*`, `agents/*` → `lib/*`
- [ ] Update Generator/Reflector/Curator for project-relative paths
- [ ] Create `src/cli.ts` entry point
- [ ] Implement `ace init`
- [ ] Implement `ace capture`
- [ ] Implement `ace analyze`
- [ ] Implement `ace update`
- [ ] Implement `ace learn`
- [ ] Implement `ace get`
- [ ] Implement `ace beads`
- [ ] Add config file support (.ace.json)
- [ ] Add help text for all commands
- [ ] Set up `bun build --compile`
- [ ] Create GitHub Actions for releases
- [ ] Write documentation

---

## Why CLI > MCP/Toolbox

✅ **Simpler** - No server, no protocol overhead  
✅ **Portable** - Single binary, no dependencies  
✅ **Universal** - Works with any tool/script  
✅ **Faster** - Direct execution, ~50ms vs MCP ~150ms  
✅ **Debuggable** - Standard CLI, clear errors  
✅ **Distributable** - GitHub releases, Homebrew, npm fallback  
✅ **Scriptable** - JSON output for automation
