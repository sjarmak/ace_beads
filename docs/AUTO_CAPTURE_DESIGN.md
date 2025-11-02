# ACE Auto-Capture Design (CLI-Based)

## Problem
ACE requires manual invocation, so it never runs. We need **automatic, transparent** learning.

## Solution: Hook-Based Auto-Capture (No MCP Required)

### 1. npm Script Hooks

**Automatic test capture:**
```json
// package.json
{
  "scripts": {
    "test": "vitest --run",
    "posttest": "ace-posttest-hook"
  }
}
```

**Hook script (`scripts/ace-posttest-hook.sh`):**
```bash
#!/bin/bash
# Captures test results automatically

# Get current bead (if working on one)
CURRENT_BEAD=$(bd ready --json | jq -r '.[0].id // empty')

if [ -z "$CURRENT_BEAD" ]; then
  echo "No active bead, skipping ACE capture"
  exit 0
fi

# Capture test execution
ace capture \
  --bead "$CURRENT_BEAD" \
  --desc "Automated test run" \
  --exec <(echo '[]') \
  --outcome "${TEST_EXIT_CODE:-0}" \
  --json > /tmp/ace-capture.json

echo "✓ ACE captured test execution for $CURRENT_BEAD"
```

### 2. Beads Git Hooks

**Install hook:**
```bash
ace beads hook install
```

**Creates `.git/hooks/post-commit`:**
```bash
#!/bin/bash
# Auto-capture on commit

# Parse commit message for bead ID
BEAD_ID=$(git log -1 --pretty=%B | grep -oE 'ACE_Beads_Amp-[0-9]+' | head -1)

if [ -n "$BEAD_ID" ]; then
  # Get bead status
  STATUS=$(bd show "$BEAD_ID" --json | jq -r '.[0].status')
  
  if [ "$STATUS" = "in_progress" ]; then
    # Capture work-in-progress
    ace capture --bead "$BEAD_ID" --desc "Code committed" --outcome success
  fi
fi
```

**Creates Beads on-close hook (`.beads/hooks/on-close`):**
```bash
#!/bin/bash
# Auto-learn when closing bead
BEAD_ID=$1

echo "Running ACE learning for $BEAD_ID..."

# Run final tests
npm test
TEST_EXIT=$?

# Capture final test results
ace capture \
  --bead "$BEAD_ID" \
  --desc "Final test run before close" \
  --outcome $([ $TEST_EXIT -eq 0 ] && echo "success" || echo "failure")

# Run learning cycle
ace learn --beads "$BEAD_ID" --json

# If tests failed, prevent close and create discovered issues
if [ $TEST_EXIT -ne 0 ]; then
  echo "❌ Tests failed! Creating discovered issues..."
  
  # Parse test failures and create issues
  npm test 2>&1 | ace parse-failures --bead "$BEAD_ID" --create-issues
  
  echo "Cannot close bead while tests are failing"
  exit 1
fi

echo "✓ ACE learning complete"
```

### 3. AGENTS.md Instructions for Amp

**Add to project AGENTS.md:**
```markdown
## ACE Integration (Auto-Learning Framework)

### Before Closing Any Bead

1. **ALWAYS run full test suite:**
   ```bash
   npm run build && npm test
   ```

2. **If tests fail:**
   - DO NOT close the bead yet
   - Create discovered issues for each failure:
     ```bash
     bd create "Fix test: [test name]" -p 1 --deps discovered-from:[bead-id]
     ```

3. **When ready to close:**
   ```bash
   bd close [bead-id] --reason "Completed"
   # This triggers ACE learning automatically via hook
   ```

### ACE Auto-Captures

The following happen automatically (via hooks):
- ✅ Test executions → `ace capture` (via npm posttest)
- ✅ Commits → traces captured (via git hook)
- ✅ Bead close → learning cycle runs (via beads hook)

### Manual ACE Commands

Only needed for special cases:
```bash
# View recent traces
ace trace list --limit 10

# Force learning cycle
ace learn --beads [bead-id]

# View learned patterns
ace get bullets --sections "TypeScript Patterns" --sort-by helpful
```
```

### 4. Installation Script

**`scripts/setup-ace-hooks.sh`:**
```bash
#!/bin/bash
set -e

echo "Setting up ACE hooks..."

# 1. Initialize ACE
ace init --yes

# 2. Install npm hooks
npm set-script posttest "scripts/ace-posttest-hook.sh"
chmod +x scripts/ace-posttest-hook.sh

# 3. Install git hooks
ace beads hook install

# 4. Verify installation
echo ""
echo "✓ ACE hooks installed:"
echo "  - npm posttest → captures test results"
echo "  - git post-commit → captures commits"
echo "  - beads on-close → runs learning cycle"
echo ""
echo "ACE will now automatically learn from your work!"
```

### 5. Preventing Premature Closes

**Beads on-close hook prevents closing with failing tests:**
```bash
# .beads/hooks/on-close
if npm test fails:
  - Create discovered issues
  - Prevent close (exit 1)
  - Show: "Fix tests first: bd ready"
```

## Implementation Order

1. ✅ Create discovered issues for current failures
2. Create `ace beads hook install` command
3. Create `ace parse-failures` command
4. Create setup script
5. Test on ACE_Beads_Amp project itself
6. Document in README

## Benefits Over MCP

- ✅ Works with ANY IDE/tool (not just Amp)
- ✅ Simpler to understand and debug
- ✅ Portable across projects
- ✅ Standard Unix hooks (git, npm)
- ✅ Easy to disable/customize
- ✅ No server/protocol overhead

## How It Solves The Problem

**Before (broken):**
```
[Human] Work on code
[Human] npm test → fails
[Human] bd close ACE-24  ❌ NO LEARNING
```

**After (automatic):**
```
[Human] Work on code
[Human] npm test → fails
  └─> posttest hook → ace capture
[Human] bd close ACE-24
  └─> on-close hook → blocks close!
  └─> Creates discovered issues
  └─> "Fix tests first"
[Human] Fix tests
[Human] npm test → passes
  └─> posttest hook → ace capture
[Human] bd close ACE-24
  └─> on-close hook → ace learn ✓
  └─> AGENTS.md updated automatically
```

## Key Insight

**ACE should be like git hooks - invisible but essential.**

You don't think about git hooks, they just work. ACE should be the same.
