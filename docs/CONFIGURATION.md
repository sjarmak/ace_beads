# ACE Configuration

ACE supports flexible configuration through multiple sources with a clear precedence order.

> **Note**: This document covers ACE framework configuration (`.ace.json`). For directory-level Amp client configuration, see [Amp Configuration](#amp-configuration) below.

## Configuration Precedence

Configuration is loaded in the following order (later sources override earlier ones):

1. **Defaults** - Built-in defaults
2. **User config** - `~/.config/ace/config.json` (global settings)
3. **Project config** - `.ace.json` in project root (project-specific)
4. **Environment variables** - `ACE_*` prefixed variables
5. **CLI flags** - Command-line arguments (highest priority)

## Configuration Options

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

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentsPath` | string | `"AGENTS.md"` | Path to AGENTS.md knowledge file |
| `logsDir` | string | `"logs"` | Directory for ACE logs |
| `insightsPath` | string | `"logs/insights.jsonl"` | Path to insights JSONL |
| `tracesPath` | string | `"logs/execution_traces.jsonl"` | Path to execution traces JSONL |
| `maxDeltas` | number | `3` | Max knowledge updates per session |
| `defaultConfidence` | number | `0.8` | Default confidence threshold (0-1) |

## Usage Examples

### Project-Specific Config

Create `.ace.json` in your project root:

```json
{
  "maxDeltas": 5,
  "defaultConfidence": 0.9,
  "agentsPath": "docs/AGENT_GUIDE.md"
}
```

**Note**: `.ace.json` is git-ignored by default. Use `.ace.json.example` to share template configurations.

### Global User Config

Create `~/.config/ace/config.json`:

```json
{
  "defaultConfidence": 0.85,
  "maxDeltas": 4
}
```

This applies to all ACE projects unless overridden.

### Environment Variables

```bash
export ACE_AGENTS_PATH="docs/AGENTS.md"
export ACE_MAX_DELTAS=5
export ACE_CONFIDENCE=0.9
```

### CLI Flags

```bash
ace init --agents custom-agents.md --logs-dir my-logs
ace update --max-deltas 5 --min-confidence 0.9
```

## Complete Precedence Example

Given:
- Default `maxDeltas`: 3
- User config (`~/.config/ace/config.json`): `maxDeltas: 4`
- Project config (`.ace.json`): `maxDeltas: 5`
- Environment: `ACE_MAX_DELTAS=6`
- CLI flag: `--max-deltas 7`

Result: `maxDeltas = 7` (CLI flag wins)

## Validation

ACE validates configuration on load:

- `maxDeltas` must be ≥ 1
- `defaultConfidence` must be between 0 and 1

Invalid configs will show warnings but use the closest valid value.

## Tips

1. **Project config** (`.ace.json`) - Use for team-specific settings
2. **User config** (`~/.config/ace/config.json`) - Use for personal preferences
3. **Environment variables** - Use for CI/CD or temporary overrides
4. **CLI flags** - Use for one-off command customization

## Example Workflows

### Stricter Learning in Production

`.ace.json`:
```json
{
  "defaultConfidence": 0.95,
  "maxDeltas": 1
}
```

### Relaxed Learning in Development

```bash
ace learn --min-confidence 0.7 --max-deltas 10
```

### Custom Knowledge Location

```json
{
  "agentsPath": "knowledge/AGENTS.md",
  "logsDir": ".ace-logs"
}
```

---

## Amp Configuration

The `amp-config` command provides directory-level control of Amp client settings, allowing different Amp configurations per project.

### Overview

When you `cd` into a project directory, ACE can automatically apply project-specific Amp settings (MCP servers, agents, experimental features) to your Amp client configuration.

This solves the problem of:
- Different projects needing different MCP servers
- Team-specific Amp settings
- Environment-specific configurations (dev vs production)

### Quick Start

```bash
# Create project-specific config
cat > .amp-config.json << 'EOF'
{
  "mcpServers": {
    "ace-learning-server": {
      "command": "node",
      "args": ["/path/to/ace-mcp-server/dist/index.js"]
    }
  },
  "agents": {
    "planning": true,
    "testing": false
  }
}
EOF

# Apply to your Amp client
ace amp-config --apply

# List current config
ace amp-config --list

# Restore global defaults
ace amp-config --restore
```

### Configuration Methods

#### 1. Complete Override (`.amp-config.json`)

Create `.amp-config.json` in any project directory for full Amp configuration override:

```json
{
  "mcpServers": {
    "braingrid": {
      "url": "https://mcp.braingrid.ai/mcp"
    },
    "ace-learning-server": {
      "command": "node",
      "args": ["./dist/mcp-server.js"]
    }
  },
  "agents": {
    "planning": true,
    "testing": true,
    "autonomy": false
  },
  "experimental": {
    "librarian": true
  },
  "amp": {
    "dangerouslyAllowAll": false,
    "updates": {
      "mode": "manual"
    }
  }
}
```

**Priority**: `.amp-config.json` completely overrides global Amp settings.

#### 2. MCP Filtering (`.ace.json`)

For simple MCP server filtering without full override, use `.ace.json`:

```json
{
  "mcpServers": {
    "enabled": ["ace-learning-server", "braingrid"],
    "disabled": ["chrome-devtools"]
  }
}
```

**Note**: This only applies when **no** `.amp-config.json` exists in the directory tree.

### Commands

#### Apply Configuration

```bash
ace amp-config --apply
```

Applies the project configuration to your Amp client. Creates a backup before modifying.

#### List Current Configuration

```bash
ace amp-config --list
```

Shows the active configuration for the current directory.

```bash
ace amp-config --list --json
```

Output as JSON for scripting.

#### Restore Global Defaults

```bash
ace amp-config --restore
```

Restores your global Amp configuration from the most recent backup.

### How It Works

1. **Directory Discovery**: Walks up from current directory to find `.amp-config.json`
2. **Backup**: Creates timestamped backup of global Amp config
3. **Merge**: Applies project settings on top of global config
4. **Write**: Updates Amp client configuration file

Supported client paths:
- `~/.config/amp/settings.json` (Amp)
- `~/.config/amp/config.json` (Amp fallback)
- `~/.config/cline/settings.json` (Cline/VS Code)
- `~/Library/Application Support/Claude/claude_desktop_config.json` (Claude Desktop)

### Auto-Apply on Directory Change

You can set up automatic configuration application when changing directories. See the shell integration scripts:

- `scripts/mcp-auto-apply.sh` - Fish shell integration
- `scripts/setup-project-mcp.sh` - Project setup helper

### Example Workflows

#### Per-Project MCP Servers

**Project A** (`.amp-config.json`):
```json
{
  "mcpServers": {
    "database-server": { "url": "..." }
  }
}
```

**Project B** (`.amp-config.json`):
```json
{
  "mcpServers": {
    "api-server": { "url": "..." }
  }
}
```

When you `cd project-a && ace amp-config --apply`, only `database-server` is available.
When you `cd project-b && ace amp-config --apply`, only `api-server` is available.

#### Team Configuration

Commit `.amp-config.json` to your repo:

```json
{
  "mcpServers": {
    "company-tools": {
      "command": "npx",
      "args": ["@company/mcp-server"]
    }
  },
  "agents": {
    "planning": true
  }
}
```

All team members get consistent Amp settings when they run `ace amp-config --apply`.

#### Environment-Specific Settings

**Development** (`.amp-config.json`):
```json
{
  "mcpServers": {
    "dev-tools": { "url": "http://localhost:3000/mcp" }
  },
  "agents": {
    "autonomy": true
  }
}
```

**Production** (separate directory, different `.amp-config.json`):
```json
{
  "mcpServers": {
    "prod-tools": { "url": "https://api.prod.com/mcp" }
  },
  "agents": {
    "autonomy": false
  }
}
```

### Configuration Schema

`.amp-config.json` supports all Amp settings. Common fields:

| Field | Type | Description |
|-------|------|-------------|
| `mcpServers` | object | MCP server definitions (key: server name) |
| `agents` | object | Agent feature toggles (planning, testing, autonomy, etc.) |
| `experimental` | object | Experimental feature flags |
| `amp.dangerouslyAllowAll` | boolean | Allow all tool permissions |
| `amp.updates.mode` | string | Update mode ("auto", "manual") |

### Tips

1. **Use `.gitignore`** for sensitive configs (API keys, local paths)
2. **Use `.amp-config.json.example`** to share template configs with team
3. **Run `--restore`** if something breaks
4. **Check backups** in `~/.config/amp/*.backup.*` before manual edits

### Troubleshooting

**Config not applying?**
```bash
ace amp-config --list --json  # Check what config is detected
ace amp-config --apply --verbose  # See detailed application logs
```

**Want to reset?**
```bash
ace amp-config --restore  # Restore from latest backup
```

**Multiple projects conflicting?**
- Only the nearest `.amp-config.json` up the directory tree applies
- Use `ace amp-config --list` to see which config is active
