#!/bin/bash
# Install bd wrapper that enforces ACE learning on close
# This makes ACE activation truly automatic until beads adds native hook support

set -e

WRAPPER_DIR="$HOME/.local/bin"
WRAPPER_PATH="$WRAPPER_DIR/bd"
BD_REAL=$(which bd 2>/dev/null || echo "/usr/local/bin/bd")

# Create wrapper directory
mkdir -p "$WRAPPER_DIR"

# Create wrapper script
cat > "$WRAPPER_PATH" << 'EOF'
#!/bin/bash
# bd wrapper - enforces ACE learning on close operations
# Original bd command is at: __BD_REAL__

BD_REAL="__BD_REAL__"

# Check if this is a close command
if [ "$1" = "close" ] && [ -f ".ace.json" ] || [ -f "AGENTS.md" ] || [ -d "logs" ]; then
    # Extract bead ID (first argument after 'close')
    BEAD_ID="$2"
    
    if [ -n "$BEAD_ID" ]; then
        echo "🔍 Running ACE learning for $BEAD_ID before close..."
        
        # Run final tests if npm test exists
        if [ -f "package.json" ] && grep -q '"test"' package.json; then
            npm test
            TEST_EXIT=$?
            
            # Capture test results
            if command -v ace >/dev/null 2>&1; then
                ace capture \
                  --bead "$BEAD_ID" \
                  --desc "Final test run before close" \
                  --outcome $([ $TEST_EXIT -eq 0 ] && echo "success" || echo "failure") \
                  --json > /dev/null 2>&1 || true
                
                # Run learning
                ace learn --beads "$BEAD_ID" --min-confidence 0.8 2>/dev/null || true
            fi
            
            # Prevent close if tests failed
            if [ $TEST_EXIT -ne 0 ]; then
                echo "❌ Tests failed! Cannot close bead while tests are failing."
                echo "Fix the failures and try again."
                exit 1
            fi
            
            echo "✓ ACE learning complete"
        fi
    fi
fi

# Execute real bd command
exec "$BD_REAL" "$@"
EOF

# Replace placeholder with actual bd path
sed -i.bak "s|__BD_REAL__|$BD_REAL|g" "$WRAPPER_PATH"
rm "$WRAPPER_PATH.bak"

# Make executable
chmod +x "$WRAPPER_PATH"

# Add to PATH if not already there
if ! echo "$PATH" | grep -q "$WRAPPER_DIR"; then
    SHELL_RC=""
    if [ -n "$BASH_VERSION" ]; then
        SHELL_RC="$HOME/.bashrc"
    elif [ -n "$ZSH_VERSION" ]; then
        SHELL_RC="$HOME/.zshrc"
    elif [ -f "$HOME/.config/fish/config.fish" ]; then
        SHELL_RC="$HOME/.config/fish/config.fish"
    fi
    
    if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
        echo "" >> "$SHELL_RC"
        echo "# bd wrapper for ACE integration" >> "$SHELL_RC"
        echo "export PATH=\"$WRAPPER_DIR:\$PATH\"" >> "$SHELL_RC"
        echo "✓ Added $WRAPPER_DIR to PATH in $SHELL_RC"
        echo "  Run: source $SHELL_RC"
    else
        echo "⚠️  Manually add to your shell config:"
        echo "  export PATH=\"$WRAPPER_DIR:\$PATH\""
    fi
fi

echo ""
echo "✓ bd wrapper installed to $WRAPPER_PATH"
echo "✓ Wraps: $BD_REAL"
echo ""
echo "The wrapper will:"
echo "  1. Detect 'bd close' commands"
echo "  2. Run tests before closing"
echo "  3. Capture results with ACE"
echo "  4. Run ACE learning"
echo "  5. Block close if tests fail"
echo ""
echo "Restart your shell or run:"
echo "  export PATH=\"$WRAPPER_DIR:\$PATH\""
