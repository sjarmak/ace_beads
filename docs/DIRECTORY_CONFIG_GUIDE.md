# ACE Directory Configuration Management Guide

This guide explains how to set up per-project Amp configuration overrides that automatically modify your global Amp settings based on the current directory. This extends beyond MCP servers to include all Amp configuration options.

## 🎯 Overview

The ACE framework provides **complete directory-level configuration override** - when you enter a project directory, any aspect of Amp's configuration can be overridden with project-specific settings. This includes MCP servers, agent behaviors, experimental features, and all other Amp configuration options.

## 📁 Configuration Architecture

### Global Config
Your main Amp configuration (`~/.config/amp/settings.json`) contains:
- Global MCP server definitions
- Default settings that apply everywhere

### Project Config
Each project can have a `.amp-config.json` file that:
- **Completely overrides** any global Amp configuration settings
- Contains project-specific settings for MCP servers, agents, experimental features, etc.
- Is automatically applied when entering the directory

## 🚀 Quick Setup

### 1. Install Shell Integration

```bash
# Run this once to set up automatic config switching
./scripts/setup-shell-integration.sh
```

This adds functions to your shell that automatically apply configs when you `cd` into directories.

### 2. Create Project Config

In any project directory, create `.amp-config.json`:

```json
{
  "mcpServers": {
    "braingrid": {
      "url": "https://mcp.braingrid.ai/mcp",
      "_target": "project"
    },
    "sourcegraph": {
      "url": "https://sourcegraph.sourcegraph.com/.api/mcp/v1",
      "headers": {"Authorization": "token ..."},
      "_target": "project"
    }
  },
  "agents": {
    "planning": true,
    "testing": true,
    "devops": false,
    "autonomy": true
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

### 3. Test It

```bash
# Enter project directory
cd my-project/

# Config is automatically applied
mcp-status  # Shows project config is active

# Start Amp - it will use project-specific MCP servers
amp "help me with this code"
```

## 📝 Configuration Format

### Complete Amp Configuration Override

The `.amp-config.json` file can contain **any valid Amp configuration setting**. It will completely override the corresponding sections in your global `settings.json`.

### Key Configuration Sections

#### MCP Servers
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {"KEY": "value"},
      "url": "https://api.example.com/mcp",
      "headers": {"Authorization": "Bearer ..."},
      "_target": "project"
    }
  }
}
```

#### Agent Behaviors
```json
{
  "agents": {
    "planning": true,
    "testing": true,
    "devops": false,
    "docs": true,
    "compliance": false,
    "autonomy": true
  }
}
```

#### Experimental Features
```json
{
  "experimental": {
    "librarian": true
  }
}
```

#### Amp Core Settings
```json
{
  "amp": {
    "dangerouslyAllowAll": false,
    "updates": {"mode": "manual"},
    "url": "https://your-amp-instance.com",
    "internal": {
      "modes": true,
      "showCost": false
    }
  }
}
```

### Complete Example
```json
{
  "mcpServers": {
    "braingrid": {
      "url": "https://mcp.braingrid.ai/mcp",
      "_target": "project"
    },
    "sourcegraph": {
      "url": "https://sourcegraph.sourcegraph.com/.api/mcp/v1",
      "headers": {"Authorization": "token ..."},
      "_target": "project"
    }
  },
  "agents": {
    "planning": true,
    "testing": true,
    "devops": false,
    "autonomy": true
  },
  "experimental": {
    "librarian": true
  },
  "amp": {
    "dangerouslyAllowAll": false,
    "updates": {"mode": "auto"},
    "internal": {"showCost": true}
  }
}
```

## 🛠️ Manual Control Commands

After shell integration is loaded:

```bash
# Check current active configuration
mcp-status

# Force apply current directory's config
mcp-apply

# Clear cache (restore default config)
mcp-restore
```

## 🔄 Automatic Switching

The shell integration automatically:

1. **Detects** when you enter a directory with `.amp-config.json`
2. **Applies** the project configuration to your global Amp settings
3. **Caches** the application to avoid re-applying unnecessarily
4. **Restores** defaults when leaving project directories

## 📂 Multi-Project Setup

### Project A: Full-Stack Web App
```json
// ProjectA/.amp-config.json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "chrome-devtools-mcp",
      "_target": "project"
    },
    "notion": {
      "command": "npx",
      "args": ["@notionhq/notion-mcp-server"],
      "env": {"NOTION_TOKEN": "..."},
      "_target": "project"
    }
  },
  "agents": {
    "planning": true,
    "testing": true,
    "devops": true,
    "docs": true
  },
  "experimental": {
    "librarian": false
  }
}
```

### Project B: CLI Tool Development (Minimal)
```json
// ProjectB/.amp-config.json
{
  "mcpServers": {},
  "agents": {
    "planning": false,
    "testing": true,
    "devops": false,
    "docs": false,
    "autonomy": false
  },
  "amp": {
    "dangerouslyAllowAll": false,
    "updates": {"mode": "manual"}
  }
}
```

### Project C: Research & Analysis (Max Context)
```json
// ProjectC/.amp-config.json
{
  "mcpServers": {
    "sourcegraph": {
      "url": "https://sourcegraph.sourcegraph.com/.api/mcp/v1",
      "headers": {"Authorization": "token ..."},
      "_target": "project"
    },
    "braingrid": {
      "url": "https://mcp.braingrid.ai/mcp",
      "_target": "project"
    },
    "gong-extended": {
      "command": "node",
      "args": ["/path/to/gong-mcp-extended/dist/index.js"],
      "env": {"GONG_ACCESS_KEY": "..."},
      "_target": "project"
    }
  },
  "agents": {
    "planning": true,
    "testing": true,
    "devops": false,
    "compliance": true,
    "docs": true,
    "autonomy": true
  },
  "experimental": {
    "librarian": true
  },
  "amp": {
    "dangerouslyAllowAll": true,
    "updates": {"mode": "auto"},
    "internal": {
      "modes": true,
      "showCost": true
    }
  }
}
```

## 🏗️ Advanced Configuration

### Environment Variables

Use environment variables in your configs:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "$MY_API_KEY",
        "DEBUG": "true"
      }
    }
  }
}
```

### Conditional Configuration

Create different configs for different environments:

```bash
# Development config
cp .amp-config.dev.json .amp-config.json

# Production config
cp .amp-config.prod.json .amp-config.json
```

### Config Templates

Create reusable config templates:

```json
// .amp-config-templates/web-dev.json
{
  "mcpServers": {
    "chrome-devtools": {"command": "chrome-devtools-mcp"},
    "notion": {"command": "npx", "args": ["@notionhq/notion-mcp-server"]}
  }
}

// Then in project:
ln -s .amp-config-templates/web-dev.json .amp-config.json
```

## 🐛 Troubleshooting

### Config Not Applying

```bash
# Check if shell integration is loaded
type mcp-status

# Force reapply
mcp-apply

# Check current status
mcp-status
```

### Permission Issues

```bash
# Ensure config files are writable
chmod 644 ~/.config/amp/settings.json
chmod 644 .amp-config.json
```

### Cache Issues

```bash
# Clear cache and restart
mcp-restore
source ~/.config/fish/config.fish
```

## 🔧 Development & Customization

### Extending the System

The MCP config system is built on these components:

- **Shell Integration**: `scripts/shell-integration.fish`
- **Auto-apply Logic**: `scripts/mcp-auto-apply.sh`
- **Config Commands**: `src/commands/mcp-config.ts`

### Custom Detection Logic

Modify `scripts/mcp-auto-apply.sh` to support different config file names:

```bash
# Add support for .project-config.json
find_project_config() {
    local current="$PWD"
    while [[ "$current" != "/" ]]; do
        if [[ -f "$current/.amp-config.json" ]] || [[ -f "$current/.project-config.json" ]]; then
            echo "$current/.amp-config.json"
            return 0
        fi
        current="$(dirname "$current")"
    done
    return 1
}
```

## 📋 Best Practices

### 1. Version Control
```bash
# Include config templates in version control
git add .amp-config.example.json
echo ".amp-config.json" >> .gitignore
```

### 2. Documentation
```bash
# Document your project's MCP setup
echo "# MCP Setup: Run ./scripts/setup-mcp.sh" >> README.md
```

### 3. Team Consistency
```bash
# Share config templates across team
mkdir .team-configs
cp .amp-config.json .team-configs/standard-web.json
```

### 4. Security
```bash
# Never commit secrets
# Use environment variables or secure credential management
grep -r "password\|token\|key" .amp-config.json  # Should be empty
```

## 🎯 Use Cases

### Clean Development Environments
- **Web Dev Project**: Only Chrome DevTools MCP
- **API Project**: Only API testing tools
- **Research**: Only Sourcegraph and documentation tools

### Context Isolation
- **Client Work**: Limited to client-approved tools
- **Open Source**: Full research and analysis tools
- **Internal Tools**: Company-specific MCP servers only

### Performance Optimization
- **Large Projects**: Minimal MCP servers for speed
- **Small Projects**: Rich context with many tools
- **CI/CD**: No MCP servers for automated builds

## 🔗 Integration with ACE

This MCP config system integrates seamlessly with ACE's learning framework:

```json
// .amp-config.json for ACE development
{
  "mcpServers": {
    "ace-learning-server": {
      "command": "node",
      "args": ["/path/to/ace/dist/mcp/server.js"]
    }
  },
  "agents": {
    "planning": true,
    "testing": true,
    "autonomy": false
  }
}
```

The system automatically manages context switching, ensuring each project has its optimal AI assistant configuration.
