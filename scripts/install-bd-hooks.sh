#!/bin/bash
# Install bd hooks by wrapping the bd binary
# This makes ACE learning automatic without waiting for upstream support

set -e

# Find the real bd binary (skip wrappers in ~/.local/bin)
BD_PATH=$(find ~/.local/share/mise/installs/go/*/bin/bd -type f 2>/dev/null | head -1)

if [ -z "$BD_PATH" ]; then
    # Fallback to which, but skip if it's a script
    BD_PATH=$(which bd)
    if head -1 "$BD_PATH" 2>/dev/null | grep -q "^#!/"; then
        echo "❌ Found a wrapper at $BD_PATH but need the real binary"
        echo "Please locate your bd binary and run this script directly on it"
        exit 1
    fi
fi

if [ -z "$BD_PATH" ] || [ ! -f "$BD_PATH" ]; then
    echo "❌ bd binary not found. Install beads first."
    exit 1
fi

echo "Found bd binary at: $BD_PATH"

# Check if already wrapped
if head -1 "$BD_PATH" 2>/dev/null | grep -q "^#!/"; then
    echo "✓ bd is already a wrapper script"
    if grep -q "ACE hooks" "$BD_PATH" 2>/dev/null; then
        echo "✓ ACE hooks already installed"
        exit 0
    else
        echo "⚠️  bd is a script but doesn't have ACE hooks"
        echo "Skipping to avoid breaking existing wrapper"
        exit 1
    fi
fi

# Backup original binary
BD_DIR=$(dirname "$BD_PATH")
BD_BACKUP="$BD_DIR/bd-real"

if [ ! -f "$BD_BACKUP" ]; then
    echo "Creating backup: $BD_BACKUP"
    cp "$BD_PATH" "$BD_BACKUP"
    chmod +x "$BD_BACKUP"
fi

# Create wrapper script
cat > "$BD_PATH" << 'WRAPPER_EOF'
#!/bin/bash
# bd wrapper with ACE hooks
# Real bd binary: bd-real (in same directory)

BD_REAL="$(dirname "$0")/bd-real"

# Hook: before close
if [ "$1" = "close" ]; then
    # Check if ACE is present
    if [ -f ".ace.json" ] || [ -f "AGENTS.md" ] || [ -d "logs" ]; then
        # Extract bead ID from arguments
        BEAD_ID=""
        for arg in "$@"; do
            if [[ "$arg" =~ ^(ACE_Beads_|bd-) ]]; then
                BEAD_ID="$arg"
                break
            fi
        done
        
        if [ -n "$BEAD_ID" ]; then
            echo "🔍 ACE: Running learning for $BEAD_ID before close..."
            
            # Run tests if available
            if [ -f "package.json" ] && grep -q '"test"' package.json 2>/dev/null; then
                npm test
                TEST_EXIT=$?
                
                # Capture test results
                if command -v ace >/dev/null 2>&1; then
                    ace capture \
                      --bead "$BEAD_ID" \
                      --desc "Final test run before close" \
                      --outcome $([ $TEST_EXIT -eq 0 ] && echo "success" || echo "failure") \
                      --json >/dev/null 2>&1 || true
                fi
                
                # Block close if tests failed
                if [ $TEST_EXIT -ne 0 ]; then
                    echo "❌ ACE: Tests failed! Cannot close bead."
                    echo "Fix the failures and try again."
                    exit 1
                fi
            fi
            
            # Run ACE learning
            if command -v ace >/dev/null 2>&1; then
                echo "🧠 ACE: Running learning cycle..."
                ace learn --beads "$BEAD_ID" --min-confidence 0.8 2>/dev/null || true
                echo "✓ ACE: Learning complete"
            fi
        fi
    fi
fi

# Execute real bd command
exec "$BD_REAL" "$@"
WRAPPER_EOF

# Make wrapper executable
chmod +x "$BD_PATH"

echo ""
echo "✓ bd hooks installed successfully!"
echo ""
echo "The wrapper will automatically:"
echo "  1. Run tests before closing beads"
echo "  2. Capture results with ace"
echo "  3. Run ace learn for the bead"
echo "  4. Block close if tests fail"
echo ""
echo "Original binary backed up to: $BD_BACKUP"
echo "Wrapper installed at: $BD_PATH"
echo ""
echo "Test it:"
echo "  bd create \"Test hook\" -p 1"
echo "  bd update <id> --status in_progress"
echo "  bd close <id> --reason \"Test\""
