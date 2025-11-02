# ACE Framework - Agent Onboarding Guide

## What is ACE?

ACE (Agentic Context Engineering) is a **self-improving coding agent framework**. It learns from your execution feedback to continuously improve performance over time.

### Core Concept

When you complete work, ACE:
1. **Captures** execution traces (build/test/lint results, errors, discovered issues)
2. **Analyzes** patterns across those traces (what went wrong, what contexts would have prevented issues)
3. **Updates** this AGENTS.md file with learned patterns as actionable bullets
4. **Applies** these bullets in future work to avoid repeating mistakes

## How to Use ACE as an Agent

### 1. During Task Execution

When working on a task, **automatically capture execution feedback**:

```bash
# After running build/test/lint and encountering errors
ace capture --bead <task-id> --exec <execution-json-file> --outcome failure
```

The execution JSON should contain:
```json
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
```

### 2. After Completing Work

When you finish a task, **trigger learning**:

```bash
ace learn --beads <task-id> --min-confidence 0.8
```

This analyzes your traces and updates AGENTS.md with new patterns.

### 3. Before Starting New Work

**Consult learned patterns** to avoid past mistakes:

```bash
ace get bullets --sections "TypeScript Patterns" --sort-by helpful --limit 10
```

The patterns below are automatically managed - they accumulate over time based on real execution feedback.

## Integration with Beads (bd)

ACE works **automatically** with Beads - no manual commands needed:

1. **Create issues**: `bd create "Fix auth bug" -t bug -p 1`
2. **Work on task**: `bd update bd-42 --status in_progress`
3. **Run tests**: `npm test` ← **Auto-captures** results to your bead
4. **Complete task**: `bd close bd-42 --reason "Fixed"` ← **Auto-learns** and blocks if tests fail

### How Auto-Activation Works

**Auto-Capture (during tests):**
- Posttest hook queries `bd list --status in_progress`
- If you have in-progress beads, test results auto-capture
- No env vars or branch names needed

**Auto-Learn (on close):**
- `bd` command is wrapped to run ACE hooks
- Before closing: runs tests, captures results, runs `ace learn`
- Blocks close if tests fail
- You never have to remember to run `ace learn` manually

## Example Workflow (Fully Automatic)

```bash
# 1. Start work
bd ready
bd update bd-123 --status in_progress

# 2. Work on the task, run builds/tests
npm run build  # fails with TypeScript error

# 3. Fix the issue (e.g., add .js extension to import)

# 4. Verify fix
npm test  # ← Auto-captures test results to bd-123

# 5. Complete task
bd close bd-123 --reason "Fixed import extensions"
# ↑ This automatically:
#   - Runs tests one final time
#   - Captures results
#   - Runs ace learn
#   - Updates AGENTS.md with new patterns
#   - Closes the bead (or blocks if tests fail)
```

After closing, AGENTS.md will have a new bullet like:
> [Bullet #abc123, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements when using ESM module resolution

**You never have to manually run `ace capture` or `ace learn` - it happens automatically!**

## Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->
<!-- Bullets accumulate over time and are never compressed -->

### Build & Test Patterns
<!-- Curator adds build/test insights here -->

[Bullet #59835aa2, helpful:0, harmful:0, Aggregated from 2 instances] Generic error pattern - Address the error pattern: Generic error pattern
### TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

### Dependency Patterns
<!-- Curator adds patterns about Beads dependency chains here -->

### Architecture Patterns
<!-- Curator adds high-level design insights here -->

## Available Commands

### Automatic (you rarely need these):
- Auto-capture happens during `npm test`
- Auto-learn happens during `bd close`

### Manual (for debugging/exploration):
- `ace init` - Initialize ACE in a project
- `ace status` - Check ACE system status
- `ace trace list` - View captured traces
- `ace get bullets` - Query learned patterns
- `ace learn --beads <id>` - Manually trigger learning

### Setup (run once):
- `bash scripts/install-bd-hooks.sh` - Install bd wrapper for auto-learning

## Key Principles for Agents

1. **Always create a bead before starting work** - Use `bd create "Task description" -t task -p 1` before starting any new work
2. **Mark beads in-progress** - Use `bd update <id> --status in_progress` so auto-capture works
3. **Run tests during work** - `npm test` auto-captures results
4. **Close beads properly** - `bd close <id>` auto-learns (never skip this!)
5. **Trust the automation** - ACE captures and learns automatically, you don't need manual commands
6. **Tests must pass** - You cannot close beads with failing tests (enforced automatically)

## Files and Directories

- `AGENTS.md` - This file, contains learned patterns
- `logs/execution_traces.jsonl` - Raw execution traces
- `logs/insights.jsonl` - Extracted insights from Reflector
- `.ace.json` - Optional project configuration

## Configuration

Create `.ace.json` to customize paths:

```json
{
  "agentsPath": "AGENTS.md",
  "logsDir": "logs",
  "maxDeltas": 3,
  "defaultConfidence": 0.8
}
```

---

**Ready to start?** Run `bd ready` to see available work, or `bd create "Task name"` to create a new task.
