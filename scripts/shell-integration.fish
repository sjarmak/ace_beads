# Shell integration for ACE MCP auto-apply (Fish shell)
# Source this file in your ~/.config/fish/config.fish

# Configuration
set -q ACE_PROJECT_ROOT; or set -gx ACE_PROJECT_ROOT (cd (dirname (status -f))/.. && pwd)
set -gx MCP_AUTO_APPLY_SCRIPT "$ACE_PROJECT_ROOT/scripts/mcp-auto-apply.sh"

# Function to override cd with MCP auto-apply
if not functions -q _original_cd
    functions -c cd _original_cd
end
function cd
    _original_cd $argv
    and $MCP_AUTO_APPLY_SCRIPT check >/dev/null 2>&1
    or true
end

# Utility functions
function mcp-status
    "$ACE_PROJECT_ROOT/scripts/mcp-auto-apply.sh" status
end

function mcp-apply
    "$ACE_PROJECT_ROOT/scripts/mcp-auto-apply.sh" force
end

function mcp-restore
    # Remove the cache to force restoration of default config
    rm -f "$HOME/.cache/ace-mcp/last_project"
    echo "Cache cleared. MCP config will be restored on next directory change."
end

echo "✅ ACE MCP fish integration loaded"
echo "💡 Commands: cd (auto-applies), mcp-status, mcp-apply, mcp-restore"
