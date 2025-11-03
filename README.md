# ACE Framework

**Agentic Context Engineering**: Make your AI coding agent learn from mistakes automatically.

## What Is This?

ACE creates a self-improving learning loop:
```
Work → Fail → Learn → Improve → Repeat
```

Your AI agent gets better over time by:
1. **Capturing** execution failures
2. **Extracting** patterns from those failures
3. **Updating** its knowledge base (AGENTS.md)

## Quick Start

### Install

```bash
npm install -g ace-beads-amp
```

### Initialize in Your Project

```bash
cd your-project
ace init
ace doctor  # Verify setup
```

### Use

```bash
# After working on a task and encountering failures
ace learn

# Preview what would be learned
ace review

# Check status
ace status

# Apply queued insights
ace apply
```

**See [QUICKSTART_CLI.md](QUICKSTART_CLI.md) for detailed workflow.**

## Documentation

- **[QUICKSTART_CLI.md](QUICKSTART_CLI.md)** - Get started in 5 minutes
- **[docs/CLI_LOOP.md](docs/CLI_LOOP.md)** - Complete CLI reference
- **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** - Configuration guide (ACE & Amp)
- **[TESTING.md](TESTING.md)** - Testing guide and strategies

## How It Works

### Three Roles

1. **Generator** (Main Amp agent)
   - Executes coding tasks
   - Captures failures in Beads issues
   - Labels with `ace,reflect`

2. **Reflector** (Amp subagent, read-only)
   - Analyzes execution traces
   - Extracts patterns from failures
   - Outputs JSON deltas (max 3 per session)

3. **Curator** (Amp subagent, write-scoped)
   - Validates and deduplicates deltas
   - Merges into AGENTS.md deterministically
   - Updates playbook.yaml

### Data Flow

```
Beads (bd) → Reflector → Delta Queue → Curator → AGENTS.md
                ↑                          ↓
         Execution Traces            Playbook.yaml
```

## Core Commands

| Command | Purpose |
|---------|---------|
| `ace init` | Initialize workspace |
| `ace status` | Show system status |
| `ace learn` | Run full learning pipeline (analyze + apply + cleanup) |
| `ace apply` | Apply queued deltas |
| `ace delta ls` | List queue |
| `ace amp-config` | Manage directory-level Amp settings |
| `ace doctor` | Run diagnostics |

See `ace --help` for all commands.

## Example Workflow

```bash
# 1. Work on a task, build fails
npm run build
# Error: Cannot find module './auth.js'

# 2. Track in Beads (optional)
bd create "Fix ESM imports" --labels ace,reflect

# 3. Fix the issue
sed -i "s/import '.\/auth'/import '.\/auth.js'/g" src/index.ts

# 4. Verify
npm run build  # passes

# 5. Close and learn
bd close bd-123 --reason "Added .js extensions"
ace learn --beads bd-123

# 6. Review and apply
ace status
ace delta ls
ace apply
```

Result: AGENTS.md now has a bullet about ESM import extensions.

## Features

### Pure CLI
- No MCP server required
- All operations via CLI commands
- Subagents launch programmatically (Amp SDK)

### Deterministic Merging
- Content normalization for deduplication
- Stable sorting (section → helpful → content)
- Identical inputs → byte-identical outputs

### Write-Scope Enforcement
- Curator can only write to `knowledge/**` and `prompts/**`
- Validated at code level
- Explicit errors logged

### Beads Integration
- Prefer `--json` outputs from `bd` commands
- Fall back to `.beads/issues.jsonl`
- Auto-linking via `discovered-from`

### Schema Validation
- Strict Zod validation for all deltas
- Min confidence threshold (default 0.80)
- Evidence requirements enforced

## Configuration

Edit `.ace/config.json`:

```json
{
  "roles": {
    "generator": { "agent": "amp", "permissions": [...] },
    "reflector": { "agent": "amp-subagent", "permissions": ["read"] },
    "curator": { "agent": "amp-subagent", "permissions": ["read", "write:knowledge", "write:prompts"] }
  },
  "learning": {
    "confidenceMin": 0.80,
    "maxDeltasPerSession": 3
  },
  "beads": {
    "bin": "bd",
    "labels": ["ace", "reflect"]
  }
}
```

## Project Structure

```
ACE_Beads_Amp/
├── .ace/                   # ACE configuration
│   ├── config.json         # Role definitions, learning config
│   └── delta-queue.json    # Pending deltas
├── knowledge/              # Knowledge base
│   ├── AGENTS.md           # Curated patterns (ACE-managed)
│   └── playbook.yaml       # Section weights
├── prompts/                # Role-specific prompts
│   ├── generator.md
│   ├── reflector.md
│   └── curator.md
├── src/
│   ├── lib/                # Core modules
│   │   ├── beads.ts        # Beads CLI wrapper
│   │   ├── deltas.ts       # Delta schema & queue
│   │   ├── merger.ts       # Deterministic merge
│   │   ├── knowledge.ts    # AGENTS.md I/O
│   │   ├── Reflector.ts    # Pattern extraction
│   │   └── Curator.ts      # Knowledge curation
│   └── commands/           # CLI commands
├── tests/                  # Test suites
├── logs/                   # Execution traces
└── docs/                   # Documentation
```

## Advanced Usage

### Offline Sweeps

Learn from completed work:

```bash
ace learn --beads bd-100,bd-101,bd-102
```

### Custom Confidence

```bash
ace learn --min-confidence 0.9  # High confidence only
ace learn --min-confidence 0.7  # Lower threshold
```

### Delta Management

```bash
ace delta ls --json
ace delta show <id>
ace delta rm <id1> <id2>
```

### Git Integration

```bash
# Creates commits on ace/curations branch
ace apply

# Skip git operations
ace apply --no-branch
```

## Testing

```bash
npm test              # Run all tests
npm run typecheck     # Type checking
npm run lint          # Linting
npm run build         # Build CLI
```

## MCP Server (Optional)

While ACE is primarily CLI-based, an MCP server is available for Amp integration:

```bash
ace-mcp-server  # Start MCP server
```

See [docs/MCP_SERVER_GUIDE.md](docs/MCP_SERVER_GUIDE.md) for setup.

## Beads CLI

ACE integrates with [Beads](https://github.com/steveyegge/beads) for task tracking:

```bash
# Install Beads
curl -fsSL https://github.com/steveyegge/beads/install.sh | bash

# Initialize in project
bd init
```

You can use ACE without Beads, but tracking provides better provenance.

## Learn More

- [ACE Framework Paper](https://arxiv.org/html/2510.04618v1)
- [Beads](https://github.com/steveyegge/beads)
- [Amp Manual](https://ampcode.com/manual)
- [Custom Subagents](https://github.com/sjarmak/amp-custom-subagents)

## License

MIT - see [LICENSE](LICENSE)

## Contributing

Issues and PRs welcome at [github.com/sjarmak/ace_beads](https://github.com/sjarmak/ace_beads)
