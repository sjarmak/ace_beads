# ACE Toolbox Installation Guide

## Quick Install (For Any Project)

### Option 1: Use from ACE_Beads_Amp directly

```bash
# In your shell config (~/.zshrc, ~/.bashrc, etc.)
export AMP_TOOLBOX="/Users/sjarmak/ACE_Beads_Amp/.toolbox"
```

Then reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

Now `ace-learn` is available in any Amp session!

### Option 2: Copy to your project

```bash
# In your project directory
cp -r /Users/sjarmak/ACE_Beads_Amp/.toolbox .
export AMP_TOOLBOX="$(pwd)/.toolbox"
```

Or add to your project's README:
```bash
export AMP_TOOLBOX="/path/to/your-project/.toolbox"
```

### Option 3: NPM script (No environment variable needed)

Add to `package.json`:
```json
{
  "scripts": {
    "ace-learn": "TOOLBOX_ACTION=execute node .toolbox/ace-learn <<< \"dir: $(pwd)\""
  }
}
```

Run with:
```bash
npm run ace-learn
```

## Usage

### With Amp

Once `AMP_TOOLBOX` is set, just ask Amp:

```bash
amp "Run ace-learn to extract patterns from my recent work"
```

Or in Amp chat:
```
Can you run ace-learn on this project?
```

### Manual Execution

```bash
# Auto-detect mode (recommended)
printf "dir: /path/to/project" | TOOLBOX_ACTION=execute node $AMP_TOOLBOX/ace-learn

# Simple mode (quick pattern extraction)
printf "dir: /path/to/project\nmode: simple" | TOOLBOX_ACTION=execute node $AMP_TOOLBOX/ace-learn

# Full mode (requires full ACE framework)
printf "dir: /path/to/project\nmode: full" | TOOLBOX_ACTION=execute node $AMP_TOOLBOX/ace-learn
```

### With Git Hooks

Auto-learn after every commit:

```bash
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
if [ -z "$AMP_TOOLBOX" ]; then
  export AMP_TOOLBOX="$(pwd)/.toolbox"
fi
printf "dir: $(pwd)" | TOOLBOX_ACTION=execute node $AMP_TOOLBOX/ace-learn &
EOF

chmod +x .git/hooks/post-commit
```

## Prerequisites

- Node.js (v16+)
- Git (optional, for commit analysis)
- npm/pnpm/yarn (for build/test commands)

## What Gets Installed

```
.toolbox/
├── ace-learn           # Main learning script
├── README.md          # Usage documentation
└── INSTALLATION.md    # This file
```

## Verifying Installation

Test that the toolbox is accessible:

```bash
# Should output the tool description
TOOLBOX_ACTION=describe node $AMP_TOOLBOX/ace-learn
```

Expected output:
```
name: ace-learn
description: Extract patterns from recent work and update AGENTS.md with ACE learnings
dir: string the workspace directory (optional, defaults to current)
mode: string learning mode - "simple" for quick patterns, "full" for Reflector+Curator (default: auto-detect)
```

## AGENTS.md Setup

The script will create `AGENTS.md` automatically if it doesn't exist, but you can create it manually:

```markdown
# My Project

## Learned Patterns (ACE-managed)
<!-- ACE learns patterns here -->

### Build & Test Patterns

### TypeScript Patterns

### Architecture Patterns
```

## Troubleshooting

### "command not found: node"
Install Node.js: https://nodejs.org/

### "AMP_TOOLBOX not set"
Add to your shell config:
```bash
export AMP_TOOLBOX="/Users/sjarmak/ACE_Beads_Amp/.toolbox"
```

### "No patterns detected"
This is normal! Patterns are only extracted when:
- Build fails with errors
- Tests fail with errors
- Git commits mention fixes

### "Section not found in AGENTS.md"
Ensure AGENTS.md has these exact sections:
- `### Build & Test Patterns`
- `### TypeScript Patterns`
- `### Architecture Patterns`

## Next Steps

1. ✅ Install toolbox (you're here!)
2. 📝 Ensure AGENTS.md exists in your project
3. 🔨 Do some work, fix bugs, commit code
4. 🧠 Run `ace-learn` to extract patterns
5. 🚀 Next time Amp will apply those patterns!

## Advanced: Full ACE Framework

For the complete ACE framework with Reflector + Curator:

1. Copy the full framework:
```bash
cp -r /Users/sjarmak/ACE_Beads_Amp/{agents,mcp,scripts} /path/to/project/
```

2. Install dependencies:
```bash
npm install --save-dev typescript tsx
```

3. Build:
```bash
npm run build
```

4. Now `ace-learn` will auto-detect and use full mode!

See [INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md) for details.
