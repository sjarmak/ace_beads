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

ACE works seamlessly with Beads for issue tracking:

1. **Create issues**: `bd create "Fix auth bug" -t bug -p 1`
2. **Work on task**: `bd update bd-42 --status in_progress`
3. **Capture traces**: `ace capture --bead bd-42 --exec errors.json`
4. **Complete task**: `bd close bd-42 --reason "Fixed"`
5. **Learn from work**: `ace learn --beads bd-42`

### Auto-Learning Hook (Optional)

Install a post-close hook to automatically learn when closing beads:

```bash
ace beads hook install
```

Now when you `bd close <id>`, ACE automatically runs learning on that task.

## Example Workflow

```bash
# 1. Start work
bd ready
bd update bd-123 --status in_progress

# 2. Work on the task, run builds/tests
npm run build  # fails with TypeScript error

# 3. Capture the failure
cat > exec.json << 'EOF'
[{
  "runner": "tsc",
  "command": "npm run build",
  "status": "fail",
  "errors": [{
    "tool": "tsc",
    "severity": "error",
    "message": "Cannot find module './utils.js'",
    "file": "src/main.ts",
    "line": 3
  }]
}]
EOF

ace capture --bead bd-123 --exec exec.json --outcome failure

# 4. Fix the issue (e.g., add .js extension to import)
# 5. Verify fix
npm run build  # passes

# 6. Complete task
bd close bd-123 --reason "Fixed import extensions"

# 7. Learn from this work
ace learn --beads bd-123
```

After this, AGENTS.md will have a new bullet like:
> [Bullet #abc123, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements when using ESM module resolution

## Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->
<!-- Bullets accumulate over time and are never compressed -->

### Build & Test Patterns
<!-- Curator adds build/test insights here -->

### TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

### Dependency Patterns
<!-- Curator adds patterns about Beads dependency chains here -->

### Architecture Patterns
<!-- Curator adds high-level design insights here -->

## Available Commands

- `ace init` - Initialize ACE in a project
- `ace capture` - Record execution trace
- `ace analyze` - Extract patterns from traces
- `ace update` - Apply insights to AGENTS.md
- `ace learn` - Convenience: analyze → update
- `ace get insights` - Query insights
- `ace get bullets` - Query learned patterns
- `ace beads hook install` - Auto-learn on bead close

## Key Principles for Agents

1. **Always capture failures** - Don't let execution errors go unrecorded
2. **Learn after completing work** - Run `ace learn` when finishing tasks
3. **Consult patterns before work** - Check `ace get bullets` for relevant guidance
4. **Link discovered issues** - When you find new work, capture it with `--discovered`
5. **Trust the feedback loop** - The more you use ACE, the better it gets

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
