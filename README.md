# ACE Framework for Amp

Make Amp learn from its mistakes automatically.

## What Is This?

ACE (Agentic Context Engineering) creates a learning loop:
```
Work → Fail → Learn → Improve → Repeat
```

Your AI coding agent gets better over time by capturing failures, extracting patterns, and updating its knowledge base.

## Installation

### Option 1: Global Install (Recommended)

```bash
npm install -g ace-beads-amp
```

**Use it:**
```bash
cd your-project
ace init           # Set up ACE in your project
ace learn          # Run learning cycle
ace review         # Preview updates without applying
ace-mcp-server     # Start MCP server for Amp/Cline/Claude Desktop
```

### Option 2: Download Binary

Download the pre-built binary for your platform from [Releases](https://github.com/sjarmak/ace_beads/releases):
- Linux (x64, arm64)
- macOS (x64, arm64)
- Windows (x64)

```bash
# Example for Linux x64
wget https://github.com/sjarmak/ace_beads/releases/latest/download/ace-linux-x64.tar.gz
tar -xzf ace-linux-x64.tar.gz
./ace --version
```

### Option 3: Project-Local Setup

```bash
./scripts/create-ace-starter.sh /path/to/your-project
cd your-project
npm run ace-learn
```

**See results:**
```bash
cat AGENTS.md  # Patterns automatically added here
```

## Documentation

- 🚀 **[QUICK_START.md](QUICK_START.md)** - Start here! (5 min read)
- 📦 **[EASY_INSTALL.md](EASY_INSTALL.md)** - One-command installation
- 📖 **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - Complete usage guide
- 🔌 **[MCP_SERVER_GUIDE.md](docs/MCP_SERVER_GUIDE.md)** - MCP server setup for AI assistants
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

## Toolbox Scripts

ACE includes toolbox scripts for workflow automation:

### ace-learn
Extracts patterns from recent work and updates AGENTS.md:
```bash
amp "Run ace-learn on this project"
```

### ace-review
Reviews AGENTS.md for duplicate bullets and archival candidates:
```bash
amp "Run ace-review to analyze AGENTS.md"
```

### ace-mcp-config
Complete directory-level Amp configuration management:
```bash
# List current configuration (MCP servers, agents, settings)
ace mcp-config --list

# Apply project config to client (Amp/VS Code/Claude Desktop)
ace mcp-config --apply

# Restore global defaults from backup
ace mcp-config --restore

# Setup automatic per-directory switching
./scripts/setup-shell-integration.sh  # Supports bash, zsh, and fish
```

See [.toolbox/README.md](file:///.toolbox/README.md) for details.

## 📚 Documentation

- **[Directory Configuration Guide](docs/DIRECTORY_CONFIG_GUIDE.md)** - Complete setup and usage guide for per-directory Amp configuration management

## Directory Configuration Management

ACE provides complete directory-level Amp configuration management:

### Per-Project Configuration

Configure which MCP servers are active for specific projects:

1. **Edit `.ace.json`** in your project root:
```json
{
  "mcpServers": {
    "enabled": ["braingrid", "ace-learning-server"],
    "disabled": ["chrome-devtools", "gong-extended", "salesforce"]
  }
}
```

2. **Apply configuration**:
```bash
ace mcp-config --apply
```

### Automatic Per-Directory Switching

For seamless per-project configurations:

```bash
# Setup automatic switching when changing directories
./scripts/setup-shell-integration.sh  # Supports bash, zsh, and fish

# Now 'cd' automatically applies the right MCP config
cd my-project/    # Automatically applies my-project's MCP config
cd other-project/ # Automatically switches to other-project's config
```

### Manual Control

```bash
# Check current configuration
ace mcp-config --list

# After shell integration is loaded:
mcp-status    # Check which project config is active
mcp-apply     # Force apply current directory's config
mcp-restore   # Clear cache (restores default on next cd)
```

### Configuration Modes

- **Enabled mode**: Only listed servers are active (`enabled` takes precedence)
- **Disabled mode**: All servers except listed ones are active
- **Default**: No filtering, all configured servers active

## Learn More

- [ACE Framework Paper](https://arxiv.org/html/2510.04618v1)
- [Beads](https://github.com/steveyegge/beads)
- [Amp Manual](https://ampcode.com/manual)
- [Custom Subagents](https://github.com/sjarmak/amp-custom-subagents)
