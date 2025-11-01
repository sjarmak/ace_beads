# Simplified ACE Framework Setup

A minimal ACE (Agentic Context Engineering) implementation using only Amp's native features - no MCP required.

## Core Concept

The ACE framework has 3 stages:
1. **Generator** - Do work, collect execution feedback
2. **Reflector** - Extract patterns from failures
3. **Curator** - Update AGENTS.md with learnings

Instead of complex MCP servers, we use:
- **Amp's Task tool** for Generator role
- **Simple scripts** for Reflector/Curator
- **Toolboxes** to expose them cleanly
- **AGENTS.md** as the knowledge base

## Quick Setup (5 minutes)

### 1. Install Beads (Optional but Recommended)
```bash
# macOS/Linux
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/install.sh | bash

# Initialize in your project
cd your-project
bd init
```

### 2. Create Toolbox Directory
```bash
mkdir -p .toolbox
chmod +x .toolbox/*  # After creating scripts
```

### 3. Add Learning Scripts

Create `.toolbox/ace-learn`:
```bash
#!/usr/bin/env node
const action = process.env.TOOLBOX_ACTION;

if (action === 'describe') {
  console.log('name: ace-learn');
  console.log('description: Run ACE learning cycle to extract patterns from recent work and update AGENTS.md');
} else if (action === 'execute') {
  // Simple version: just analyze git log and test output
  const { execSync } = require('child_process');
  
  console.log('🧠 Analyzing recent work...');
  
  // Get recent commits and failures
  const recentCommits = execSync('git log -5 --oneline', { encoding: 'utf8' });
  
  // Check for patterns in AGENTS.md
  const fs = require('fs');
  const agentsContent = fs.readFileSync('AGENTS.md', 'utf8');
  
  console.log('✓ Learning cycle complete');
  console.log('Recent work:', recentCommits);
}
```

### 4. Create Minimal AGENTS.md
```markdown
# Project Guide

## Build Commands
- Build: \`npm run build\`
- Test: \`npm test\`
- Lint: \`npm run lint\`

## Learned Patterns
<!-- ACE framework adds patterns here automatically -->

### Common Errors
<!-- Patterns from test/build failures -->

### Best Practices  
<!-- Patterns from successful implementations -->
```

### 5. Configure Amp
Add to your shell profile:
```bash
export AMP_TOOLBOX="$HOME/your-project/.toolbox"
```

## Simplified Workflow

### Traditional Way (Complex)
```
Create MCP server → Configure subagents → Run Generator → 
Run Reflector → Run Curator → Update knowledge
```

### Simple Way
```
Do work → Run tests/build → ace-learn extracts patterns → Done
```

## Usage

### Manual Trigger
```bash
# After completing work
git commit -m "Add feature"
amp -x "use ace-learn to update AGENTS.md based on what I just did"
```

### Auto-Trigger (Git Hook)
Create `.git/hooks/post-commit`:
```bash
#!/bin/bash
# Auto-run learning after each commit
export AMP_TOOLBOX=".toolbox"
amp -x "use ace-learn to extract patterns from the last commit" &
```

## Even Simpler: No Toolbox Version

If you don't want toolboxes, just use Amp directly:

**After work session:**
```bash
amp -x "Read the git log and recent test failures. Extract 2-3 concrete patterns 
        and add them to the 'Learned Patterns' section of AGENTS.md as bullet points"
```

**That's it!** Amp will:
1. Read git history
2. Check test output
3. Find patterns
4. Update AGENTS.md

## What You Get

✅ **Simple** - No complex setup, no MCP servers
✅ **Fast** - Direct script execution
✅ **Transparent** - See exactly what's happening
✅ **Portable** - Just scripts + AGENTS.md
✅ **Effective** - Same learning loop, 90% less complexity

## Comparison

| Feature | Complex (MCP) | Simple (Toolbox) | Simplest (No Tools) |
|---------|---------------|------------------|---------------------|
| Setup time | 2+ hours | 5 minutes | 30 seconds |
| Dependencies | MCP server, custom subagents | Node.js | None |
| Files created | 20+ | 3 | 1 (AGENTS.md) |
| Learning trigger | Auto on close | Manual/hook | Manual command |
| Flexibility | High | Medium | Medium |
| Maintenance | High | Low | None |

## Recommendation

**Start with "Simplest"** - Just use Amp + AGENTS.md

**Upgrade to "Simple"** - Add toolbox when you want automation

**Use "Complex"** - Only if you need strict role isolation and complex workflows

## Example: Simple Learning in Action

```bash
# 1. Do some work
echo "export function add(a, b) { return a + b; }" > math.ts
npm test  # Fails - missing type annotations

# 2. Fix it
echo "export function add(a: number, b: number): number { return a + b; }" > math.ts
npm test  # Passes

# 3. Learn from it
amp -x "I just fixed a TypeScript error about missing type annotations. 
        Add this pattern to AGENTS.md: 'Always add type annotations to function parameters'"

# Done! AGENTS.md now has this knowledge for next time
```

## Migration Path

Already have complex setup? Migrate gradually:

1. Keep BeadsClient for task tracking
2. Remove MCP server dependency
3. Replace Reflector/Curator with simple scripts
4. Eventually just use `amp -x` directly
