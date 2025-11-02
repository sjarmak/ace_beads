#!/bin/bash
# Shell integration for ACE MCP auto-apply
# Source this file in your ~/.bashrc or ~/.zshrc

# Configuration
ACE_PROJECT_ROOT="${ACE_PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
MCP_AUTO_APPLY_SCRIPT="$ACE_PROJECT_ROOT/scripts/mcp-auto-apply.sh"

# Function to override cd with MCP auto-apply
function cd() {
    builtin cd "$@" && "$MCP_AUTO_APPLY_SCRIPT" check 2>/dev/null || true
}

# Alternative: Use PROMPT_COMMAND for automatic checking (uncomment to use)
# PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND$'\n'} $MCP_AUTO_APPLY_SCRIPT check 2>/dev/null || true"

# Utility functions
function mcp-status() {
    "$MCP_AUTO_APPLY_SCRIPT" status
}

function mcp-apply() {
    "$MCP_AUTO_APPLY_SCRIPT" force
}

function mcp-restore() {
    # Remove the cache to force restoration of default config
    rm -f "$HOME/.cache/ace-mcp/last_project"
    echo "Cache cleared. MCP config will be restored on next directory change."
}

echo "✅ ACE MCP shell integration loaded"
echo "💡 Commands: cd (auto-applies), mcp-status, mcp-apply, mcp-restore"
