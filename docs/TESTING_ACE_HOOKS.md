# Testing ACE Auto-Activation

This guide tests that ACE hooks are working correctly in a fresh session.

## Test 1: Auto-Capture on Tests

```bash
# 1. Create and start a bead
bd create "Test ACE auto-capture" -p 1 -t task
bd update ACE_Beads_Amp-XXX --status in_progress

# 2. Run tests (should auto-capture)
npm test

# 3. Verify capture happened
ace trace list --beads ACE_Beads_Amp-XXX

# Expected: Should show a trace for this bead with test results
```

## Test 2: Auto-Learn on Close (Success Path)

```bash
# 1. Create and start a bead
bd create "Test ACE auto-learn success" -p 1 -t task
bd update ACE_Beads_Amp-YYY --status in_progress

# 2. Close the bead (should auto-run tests + learning)
bd close ACE_Beads_Amp-YYY --reason "Testing hooks"

# Expected output:
# - Tests run automatically
# - ACE learning runs
# - Bead closes successfully
# - Should see: "🧠 ACE: Running learning cycle..."
# - Should see: "✅ Learning complete"
```

## Test 3: Auto-Learn Blocks Failed Tests

```bash
# 1. Create and start a bead
bd create "Test ACE blocks on failure" -p 1 -t task
bd update ACE_Beads_Amp-ZZZ --status in_progress

# 2. Introduce a test failure
echo "// BROKEN CODE" >> src/lib/test-file.ts

# 3. Try to close (should be blocked)
bd close ACE_Beads_Amp-ZZZ --reason "Attempt close"

# Expected output:
# - Tests run automatically
# - Tests fail
# - ACE captures failure
# - Close is BLOCKED with error message
# - Should see: "❌ Tests failed! Cannot close bead while tests are failing."

# 4. Fix the issue
git checkout src/lib/test-file.ts

# 5. Try again (should succeed)
bd close ACE_Beads_Amp-ZZZ --reason "Fixed tests"
```

## Test 4: Full Workflow in Fresh Amp Session

**Start a fresh Amp session and paste this:**

```
I need you to:
1. Create a bead called "Test ACE integration"
2. Update it to in_progress status
3. Run the tests
4. Check if a trace was captured for this bead
5. Close the bead

Then tell me if you saw:
- Auto-capture happening during tests
- Auto-learning happening during close
```

## What to Look For

### ✅ Auto-Capture is Working If You See:
- After `npm test`, check `ace trace list` shows a new trace
- The trace has `outcome: success` (or failure if tests failed)
- Trace shows `Bead: ACE_Beads_Amp-XXX`

### ✅ Auto-Learn on Close is Working If You See:
When running `bd close`:
```
🔍 ACE: Running learning for ACE_Beads_Amp-XXX before close...
[test output]
🧠 ACE: Running learning cycle...
🧠 ACE Learning Pipeline...
Step 1/2: Analyzing traces...
Step 2/2: Updating knowledge...
✅ Learning complete!
✓ Closed ACE_Beads_Amp-XXX: [reason]
```

### ✅ Test Blocking is Working If You See:
When tests fail:
```
❌ ACE: Tests failed! Cannot close bead.
Fix the failures and try again.
```

## Troubleshooting

**Auto-capture not working:**
```bash
# Check if bd wrapper is installed
head -1 $(which bd)
# Should show: #!/bin/bash

# Check for in-progress beads
bd list --status in_progress

# Run with verbose mode
ACE_VERBOSE=1 npm test
```

**Auto-learn not triggering:**
```bash
# Check bd wrapper exists
ls -la ~/.local/share/mise/installs/go/*/bin/bd*

# Should see:
# bd        (wrapper script)
# bd-real   (original binary)

# Test the wrapper directly
cat $(which bd) | head -20
# Should see ACE hook code
```

**Wrapper not found:**
```bash
# Reinstall the wrapper
bash scripts/install-bd-hooks.sh
```

## Quick Smoke Test

One command to test everything:

```bash
# Create, work, and close in one go
TEST_ID=$(bd create "ACE smoke test" -p 1 --json | jq -r '.id') && \
bd update $TEST_ID --status in_progress && \
npm test && \
ace trace list --beads $TEST_ID && \
bd close $TEST_ID --reason "Smoke test complete"
```

Expected: Should see test output, ACE learning output, and successful close.
