# ACE Framework for Amp

Make Amp learn from its mistakes automatically.

## What Is This?

ACE (Agentic Context Engineering) creates a learning loop:
```
Work → Fail → Learn → Improve → Repeat
```

Your AI coding agent gets better over time by capturing failures, extracting patterns, and updating its knowledge base.

## Quick Start (For New Projects)

**Install in your project:**
```bash
./scripts/create-ace-starter.sh /path/to/your-project
```

**Use it:**
```bash
cd your-project
amp "Build something"
npm run ace-learn  # After work is done
```

**See results:**
```bash
cat AGENTS.md  # Patterns automatically added here
```

## Documentation

- 🚀 **[QUICK_START.md](QUICK_START.md)** - Start here! (5 min read)
- 📦 **[EASY_INSTALL.md](EASY_INSTALL.md)** - One-command installation
- 📖 **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - Complete usage guide
- 🏗️ **[SETUP_COMPLETE.md](SETUP_COMPLETE.md)** - Original complex setup (reference)

## How It Works

### The Three Agents

1. **Generator** (agents/Generator.ts) - Captures what went wrong
2. **Reflector** (agents/Reflector.ts) - Finds patterns in failures  
3. **Curator** (agents/Curator.ts) - Updates AGENTS.md with learnings

### The Flow

```
You use Amp → Build/test fails → Generator captures trace
                                          ↓
AGENTS.md ← Curator adds patterns ← Reflector analyzes
    ↓
Next time: Amp reads patterns and does better ✓
```

## Architecture

\`\`\`
ACE Framework
├── Generator (executes tasks, discovers issues)
├── Reflector (analyzes execution traces)
└── Curator (integrates insights into AGENT.md)

Beads (task tracking)
├── Issue graph with dependencies
├── discovered-from links
└── Auto-sync to git via JSONL

Core Modules
├── mcp/guarded-fs.ts (role-based file permissions)
├── mcp/exec-runner.ts (build/test/lint feedback)
└── mcp/beads-client.ts (task management)
\`\`\`

## ACE Learning Workflow

### Online Adaptation (During Work)
1. Generator completes task
2. Reflector analyzes execution feedback
3. Curator applies high-confidence deltas (confidence ≥ 0.8)
4. Max 3 deltas per session

### Offline Adaptation (Batch Learning)
1. Multi-epoch analysis across all completed work
2. Extract meta-patterns
3. Propose consolidated deltas
4. Human review for lower-confidence insights

## Example Usage

Create a test issue and work on it with ACE Generator:

\`\`\`bash
# Create test task
bd create "Implement hello world function" -t task -p 1

# The ace-generator subagent would:
# 1. Claim the task
# 2. Implement the function
# 3. Run tests
# 4. File discovered issues if problems found
# 5. Report feedback for reflection
\`\`\`

After completion, run reflection:

\`\`\`bash
# Reflector analyzes the completed work
# Curator updates knowledge/AGENT.md with insights
\`\`\`

## Project Structure

\`\`\`
ACE_Beads_Amp/
├── agents/          # Future: agent implementations
├── mcp/             # Core modules
│   ├── types.ts
│   ├── guarded-fs.ts
│   ├── exec-runner.ts
│   └── beads-client.ts
├── knowledge/
│   └── AGENT.md     # Curated knowledge base (ACE-managed)
├── prompts/         # Subagent system prompts
├── logs/traces/     # Execution traces
├── scripts/         # Automation scripts
├── tests/           # Test suites
└── AGENTS.md        # Project guidance for AI agents
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## Linting

\`\`\`bash
npm run lint
\`\`\`

## Type Checking

\`\`\`bash
npm run typecheck
\`\`\`

## Learn More

- [ACE Framework Paper](https://arxiv.org/html/2510.04618v1)
- [Beads](https://github.com/steveyegge/beads)
- [Amp Manual](https://ampcode.com/manual)
- [Custom Subagents](https://github.com/sjarmak/amp-custom-subagents)
