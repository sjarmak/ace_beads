#!/bin/bash
# Setup project-specific MCP server configuration
# This script helps configure which MCP servers are enabled for this project

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACE_JSON="$PROJECT_ROOT/.ace.json"

echo "🔧 Setting up project-specific MCP server configuration"
echo "Project: $PROJECT_ROOT"
echo

# Check if .ace.json exists
if [ ! -f "$ACE_JSON" ]; then
    echo "Creating .ace.json with default MCP configuration..."
    cat > "$ACE_JSON" << 'EOF'
{
  "agentsPath": "AGENTS.md",
  "logsDir": "logs",
  "insightsPath": "logs/insights.jsonl",
  "tracesPath": "logs/execution_traces.jsonl",
  "maxDeltas": 3,
  "defaultConfidence": 0.8,
  "mcpServers": {
    "enabled": ["braingrid", "ace-learning-server"],
    "disabled": ["chrome-devtools", "gong-extended", "salesforce", "notion", "sourcegraph", "codemode"]
  }
}
EOF
    echo "✅ Created .ace.json"
else
    echo "✅ .ace.json already exists"
fi

echo
echo "📋 Current MCP server configuration:"
npm run cli -- mcp-config --list

echo
echo "💡 To apply this configuration to your AI client:"
echo "   ace mcp-config --apply"
echo
echo "💡 To modify the configuration, edit .ace.json:"
echo "   - enabled: Whitelist of servers to allow (takes precedence)"
echo "   - disabled: Blacklist of servers to exclude"
echo
echo "🔄 If you change .ace.json, run 'ace mcp-config --apply' to update your client."
