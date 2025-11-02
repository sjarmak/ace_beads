#!/bin/bash
# Auto-apply MCP server configuration based on current directory
# This script checks for .ace.json and applies MCP config if found

set -e

# Get the project root (look for .ace.json by walking up directories)
find_project_config() {
    local current="$PWD"
    while [[ "$current" != "/" ]]; do
        if [[ -f "$current/.ace.json" ]]; then
            echo "$current/.ace.json"
            return 0
        fi
        current="$(dirname "$current")"
    done
    return 1
}

# Apply MCP config for a specific project
apply_project_config() {
    local config_file="$1"
    local project_dir="$(dirname "$config_file")"

    echo "🔄 Applying MCP config from: $project_dir"

    # Change to project directory and run the command
    (cd "$project_dir" && npm run cli -- amp-config --apply >/dev/null 2>&1)

    if [[ $? -eq 0 ]]; then
        echo "✅ MCP config applied for project: $(basename "$project_dir")"
    else
        echo "❌ Failed to apply MCP config for project: $(basename "$project_dir")"
    fi
}

# Check if we need to apply a new config
check_and_apply() {
    local config_file
    if config_file=$(find_project_config); then
        local project_dir="$(dirname "$config_file")"
        local cache_file="$HOME/.cache/ace-mcp/last_project"

        # Create cache directory if it doesn't exist
        mkdir -p "$(dirname "$cache_file")"

        # Check if this is a different project than last time
        if [[ ! -f "$cache_file" ]] || [[ "$(cat "$cache_file")" != "$project_dir" ]]; then
            apply_project_config "$config_file"
            echo "$project_dir" > "$cache_file"
        fi
    else
        # No project config found, check if we need to restore default
        local cache_file="$HOME/.cache/ace-mcp/last_project"
        if [[ -f "$cache_file" ]]; then
            echo "🏠 No project config found, restoring default MCP configuration"
            # For now, just clear the cache - user can manually restore defaults
            rm -f "$cache_file"
        fi
    fi
}

# Main function
main() {
    case "${1:-}" in
        "check")
            check_and_apply
            ;;
        "force")
            local config_file
            if config_file=$(find_project_config); then
                apply_project_config "$config_file"
            else
                echo "❌ No .ace.json found in current directory tree"
                exit 1
            fi
            ;;
        "status")
            local config_file
            if config_file=$(find_project_config); then
                local project_dir="$(dirname "$config_file")"
                echo "📍 Current project: $(basename "$project_dir")"
                echo "📁 Config file: $config_file"
                (cd "$project_dir" && npm run cli -- amp-config --list)
            else
                echo "🏠 No project-specific MCP config found"
            fi
            ;;
        "help"|*)
            cat << 'EOF'
MCP Auto-Apply - Automatic per-directory MCP server configuration

USAGE:
    mcp-auto-apply.sh [command]

COMMANDS:
    check     Check and apply config if in a new project (default)
    force     Force apply config for current project
    status    Show current project MCP config status
    help      Show this help

INTEGRATION:
Add this to your ~/.bashrc or ~/.zshrc:

    # Auto-apply MCP config when changing directories
    function cd() {
        builtin cd "$@" && /path/to/ace_beads_amp/scripts/mcp-auto-apply.sh check
    }

    # Or use a PROMPT_COMMAND for automatic checking
    PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND$'\n'} /path/to/ace_beads_amp/scripts/mcp-auto-apply.sh check"

EXAMPLES:
    mcp-auto-apply.sh check    # Auto-apply when changing dirs
    mcp-auto-apply.sh force    # Force apply current project config
    mcp-auto-apply.sh status   # Show what's currently applied
EOF
            ;;
    esac
}

main "$@"
