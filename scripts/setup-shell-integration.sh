#!/bin/bash
# Setup shell integration for automatic MCP server configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Setting up ACE MCP shell integration"
echo "This will add automatic MCP config switching to your shell."
echo

# Detect shell - check SHELL env var first, then version vars
if [[ "$SHELL" == *"fish" ]] || [[ -n "$FISH_VERSION" ]]; then
    SHELL_RC="$HOME/.config/fish/config.fish"
    INTEGRATION_SCRIPT="$SCRIPT_DIR/shell-integration.fish"
    SHELL_NAME="fish"
elif [[ "$SHELL" == *"zsh" ]] || [[ -n "$ZSH_VERSION" ]]; then
    SHELL_RC="$HOME/.zshrc"
    INTEGRATION_SCRIPT="$SCRIPT_DIR/shell-integration.sh"
    SHELL_NAME="zsh"
elif [[ "$SHELL" == *"bash" ]] || [[ -n "$BASH_VERSION" ]]; then
    SHELL_RC="$HOME/.bashrc"
    INTEGRATION_SCRIPT="$SCRIPT_DIR/shell-integration.sh"
    SHELL_NAME="bash"
else
    echo "❌ Unsupported shell. Please manually add the integration."
    echo "   Supported: bash, zsh, fish"
    echo "   Your SHELL: $SHELL"
    exit 1
fi

echo "📁 Detected shell: $SHELL_NAME"
echo "📄 Config file: $SHELL_RC"
echo

# Check if already integrated
if grep -q "shell-integration.sh" "$SHELL_RC" 2>/dev/null; then
    echo "✅ Integration already configured in $SHELL_RC"
    echo
    echo "💡 To test: cd to a different directory with .ace.json"
    exit 0
fi

# Backup existing config
if [[ -f "$SHELL_RC" ]]; then
    cp "$SHELL_RC" "${SHELL_RC}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📋 Backed up $SHELL_RC"
fi

# Add integration
cat >> "$SHELL_RC" << EOF

# ACE MCP Auto-Apply Integration
# Automatically switches MCP server configurations based on current directory
# Added by ACE setup on $(date)
source "$INTEGRATION_SCRIPT"
EOF

echo "✅ Added integration to $SHELL_RC"
echo
echo "🔄 Restart your shell or run: source $SHELL_RC"
echo
echo "🧪 Test it:"
echo "   cd $PROJECT_ROOT"
echo "   mcp-status"
echo
echo "💡 The 'cd' command now automatically applies MCP configs when entering directories with .ace.json"
echo "💡 Use 'mcp-status' to see current config, 'mcp-apply' to force apply, 'mcp-restore' to clear cache"
