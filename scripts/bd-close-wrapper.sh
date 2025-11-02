#!/bin/bash
# Wrapper for 'bd close' that automatically triggers ACE learning
# Usage: Same as 'bd close'

set -e

# Get the actual bd binary location
BD_BIN=$(which bd)

# Extract bead ID from arguments
BEAD_ID=""
REASON=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --reason)
      REASON="$2"
      shift 2
      ;;
    -*)
      # Other flags, pass through
      shift
      ;;
    *)
      # First non-flag argument is bead ID
      if [ -z "$BEAD_ID" ]; then
        BEAD_ID="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$BEAD_ID" ]; then
  echo "Error: No bead ID provided"
  exit 1
fi

echo "🔍 Running ACE learning for $BEAD_ID before close..."

# Run final tests to capture last execution state
npm test
TEST_EXIT=$?

# Capture final test results
ace capture \
  --bead "$BEAD_ID" \
  --desc "Final test run before close" \
  --outcome $([ $TEST_EXIT -eq 0 ] && echo "success" || echo "failure") \
  --json > /dev/null 2>&1 || true

# Run learning cycle to extract insights and update knowledge base
ace learn --beads "$BEAD_ID" --min-confidence 0.8 || true

# If tests failed, prevent close
if [ $TEST_EXIT -ne 0 ]; then
  echo "❌ Tests failed! Cannot close bead while tests are failing."
  echo ""
  echo "Please fix the test failures before closing this bead."
  echo "Run 'npm test' to see the failures."
  exit 1
fi

echo "✓ ACE learning complete for $BEAD_ID"
echo ""

# Now actually close the bead
if [ -n "$REASON" ]; then
  "$BD_BIN" close "$BEAD_ID" --reason "$REASON"
else
  "$BD_BIN" close "$BEAD_ID"
fi
