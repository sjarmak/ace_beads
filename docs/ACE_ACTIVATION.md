# ACE Auto-Activation Guide

## Problem
ACE framework is useless if agents don't actually run the capture/learn commands. This doc explains how we made ACE activation automatic and reliable.

## Solution Overview

We implemented **2 automatic mechanisms** so ACE works without agent intervention:

### 1. Auto-Capture on Tests (npm posttest hook)
**File:** `scripts/posttest-hook.js`

Automatically captures test results when:
- ACE is present (`.ace.json`, `AGENTS.md`, or `logs/` directory exists)
- An in-progress bead exists (queried via `bd list --status in_progress`)

**How it works:**
1. Checks for ACE presence
2. Queries beads for in-progress issues
3. If exactly one in-progress: uses it
4. If multiple in-progress: uses most recently updated
5. Captures test outcome to that bead

**Usage:**
```bash
# Start working on a bead
bd update ACE_Beads_Amp-123 --status in_progress

# Now tests auto-capture!
npm test  # Automatically captures for ACE_Beads_Amp-123

# Verbose mode to see what's happening
ACE_VERBOSE=1 npm test

# Manual override (optional)
ACE_CURRENT_BEAD=ACE_Beads_Amp-456 npm test
```

### 2. Auto-Learn on Bead Close (.beads/hooks/on-close)
**File:** `.beads/hooks/on-close`

Automatically runs when closing a bead:
1. Runs `npm test` one final time
2. Captures test results with `ace capture`
3. Runs `ace learn` to extract insights
4. **Prevents closing if tests fail** (enforcement!)

**Installation:**
```bash
ace beads hook install
```

**Usage:**
```bash
bd close ACE_Beads_Amp-123 --reason "Feature complete"
# Hook automatically:
# - Runs tests
# - Captures results
# - Runs learning
# - Blocks close if tests fail
```

## How to Use ACE Effectively

### For Agents Working on Tasks

**Before starting work:**
```bash
# Check existing patterns
ace get bullets --sort-by helpful --limit 10

# Check for pending knowledge updates
ace status
```

**During work:**
```bash
# Mark bead as in-progress
bd update ACE_Beads_Amp-234 --status in_progress

# Now tests auto-capture!
npm test  # Automatically captures results for ACE_Beads_Amp-234
```

**After completing work:**
```bash
# Close the bead (auto-learns via hook)
bd close ACE_Beads_Amp-234 --reason "Feature complete"

# Or manually run learning
ace learn --beads ACE_Beads_Amp-234 --min-confidence 0.8
```

### For Manual Testing

Test the auto-capture:
```bash
# Create a test branch with bead ID
git checkout -b test/ACE_Beads_Amp-999-test

# Run tests with verbose mode
ACE_VERBOSE=1 npm test

# Check if trace was captured
ace trace list --beads ACE_Beads_Amp-999
```

## How Bead Detection Works

The auto-capture hook queries beads directly:
```bash
bd list --status in_progress --json
```

- If **one** in-progress bead: uses it automatically
- If **multiple** in-progress beads: uses most recently updated
- If **no** in-progress beads: skips capture (silent)

You can override with: `ACE_CURRENT_BEAD=bd-42 npm test`

## Configuration

### Enable/Disable Auto-Capture

Auto-capture is enabled when ACE is present. To disable:
```bash
# Remove ACE markers (not recommended)
rm .ace.json

# Or set env var
ACE_DISABLE_AUTO_CAPTURE=1 npm test
```

### Verbose Logging

See what the auto-capture hook is doing:
```bash
ACE_VERBOSE=1 npm test
```

### CI Configuration

Edit `.github/workflows/ace-learning.yml` to:
- Make it a hard gate (uncomment `exit 1`)
- Adjust confidence threshold
- Change when it runs

## Troubleshooting

**Auto-capture not running:**
```bash
# Check if ACE is detected
ls .ace.json AGENTS.md logs/

# Check if there are in-progress beads
bd list --status in_progress

# Test with explicit ID
ACE_CURRENT_BEAD=test-123 ACE_VERBOSE=1 npm test
```

**Learning not happening:**
```bash
# Check for traces
ace trace list

# Manually trigger learning
ace learn --beads ACE_Beads_Amp-123 --min-confidence 0.8

# Check status
ace status
```

## Architecture Decision

We chose **automatic activation via beads state** over:
- ❌ Pure instructions (agents skip them)
- ❌ Branch name parsing (requires specific workflows)
- ❌ Environment variables (agents forget to set them)
- ❌ CI enforcement (not always available)
- ❌ MCP-only integration (requires server setup)
- ❌ Orchestrator integration (too coupled)

This approach:
- ✅ Works automatically when you `bd update --status in_progress`
- ✅ No special branch names or env vars required
- ✅ No CI dependency (works purely locally)
- ✅ Minimal configuration (install hook once)
- ✅ Works with normal beads workflow
- ✅ Easy to debug (verbose mode)

## Future Improvements

Potential enhancements:
- Auto-capture for build failures (`postbuild` hook)
- Auto-capture for lint failures (`postlint` hook)
- Better multi-bead handling (tag traces with all in-progress beads)
- Optional CI gate for teams that want enforcement
