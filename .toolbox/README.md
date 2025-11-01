# ACE Toolbox Scripts

Production-ready scripts for the ACE (Agentic Context Engineering) framework.

## Installation

```bash
# In your project
export AMP_TOOLBOX="/path/to/ACE_Beads_Amp/.toolbox"
```

Or copy to your project:
```bash
cp -r .toolbox /path/to/your-project/
export AMP_TOOLBOX="/path/to/your-project/.toolbox"
```

## Scripts

### ace-learn

Extract patterns from recent work and update AGENTS.md with learnings.

### ace-review

Review AGENTS.md for duplicate bullets and archival candidates. Generates cleanup reports with token savings estimates.

**Modes:**

- **Auto** (default): Detects whether to use simple or full mode
- **Simple**: Quick pattern extraction from git/build/test output
- **Full**: Runs complete Reflector → Curator pipeline

**Usage with Amp:**

```bash
amp "Run ace-learn on this project"
```

**Manual usage:**

```bash
# Auto-detect mode
TOOLBOX_ACTION=execute node .toolbox/ace-learn <<< "dir: /path/to/project"

# Force simple mode
TOOLBOX_ACTION=execute node .toolbox/ace-learn <<< "dir: /path/to/project
mode: simple"

# Force full mode (requires agents/ and dist/)
TOOLBOX_ACTION=execute node .toolbox/ace-learn <<< "dir: /path/to/project
mode: full"
```

**What it does:**

1. **Simple Mode:**
   - Analyzes last 5 git commits
   - Runs `npm run build` and extracts build errors
   - Runs `npm test` and extracts test failures
   - Generates pattern bullets from errors
   - Updates AGENTS.md with new patterns

2. **Full Mode:**
   - Reads execution traces from `logs/execution_traces.jsonl`
   - Runs Reflector to analyze patterns
   - Runs Curator to update AGENTS.md
   - Falls back to simple mode if traces unavailable

**Patterns detected:**

- TypeScript import errors (`.js` extension required)
- Type mismatches and build errors
- Test timeouts and async issues
- Connection errors in integration tests
- Duplicate declarations
- Import pattern issues

**Example output:**

```
🧠 ACE Learning Cycle Starting...

📂 Working directory: /Users/bob/my-project
🔍 Auto-detected mode: simple

⚡ Running Simple Pattern Extraction

📊 Gathering context...
   Found 5 recent commits
🔍 Analyzing patterns...
   Running build...
   ⚠ Build had errors
   Running tests...
   ✓ Tests passed

✨ Found 1 new pattern(s):

  • [TypeScript Patterns] TypeScript module imports require .js extension...

✅ Updated AGENTS.md

📝 Recent commits:
abc123 Fix import error
def456 Add new feature
789ghi Update tests

🎓 Learning cycle complete!
```

## Git Hook Integration

Auto-learn after every commit:

```bash
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
export AMP_TOOLBOX="$(pwd)/.toolbox"
TOOLBOX_ACTION=execute node $AMP_TOOLBOX/ace-learn <<< "dir: $(pwd)" &
EOF

chmod +x .git/hooks/post-commit
```

## NPM Script Integration

Add to your `package.json`:

```json
{
  "scripts": {
    "ace-learn": "TOOLBOX_ACTION=execute node .toolbox/ace-learn <<< \"dir: $(pwd)\""
  }
}
```

Then run:
```bash
npm run ace-learn
```

## Troubleshooting

**"No new patterns detected"**
- This is normal if no build/test errors occurred
- Patterns are only extracted from failures

**"Section not found in AGENTS.md"**
- Ensure AGENTS.md has these sections:
  - `### Build & Test Patterns`
  - `### TypeScript Patterns`
  - `### Architecture Patterns`

**"Falling back to simple mode"**
- Full mode requires:
  - `agents/Reflector.ts` and `agents/Curator.ts` files
  - Compiled `dist/` directory
  - `logs/execution_traces.jsonl` with content
- Simple mode is perfectly fine for most use cases!

## Next Steps

1. Run `ace-learn` after completing work
2. Check `AGENTS.md` for new patterns
3. Next time Amp will read and apply these patterns
4. After 10-20 sessions, you'll see ~10% improvement in code quality
