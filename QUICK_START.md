# ACE Framework - Quick Start

## For the Impatient

**One command to install:**
```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/ACE_Beads_Amp/main/scripts/create-ace-starter.sh | bash -s your-project-dir
```

**One command to use:**
```bash
npm run ace-learn  # After completing work
```

**That's it.**

## What Is This?

ACE (Agentic Context Engineering) makes Amp learn from mistakes:

```
You work → Something fails → ACE learns → Next time Amp does better
```

## 30-Second Setup

```bash
cd your-project

# 1. Clone & copy files
git clone https://github.com/yourusername/ACE_Beads_Amp /tmp/ace
cp -r /tmp/ace/{agents,mcp,scripts} .

# 2. Install
npm install -D typescript tsx
npm run build

# 3. Done
```

## 30-Second Usage

```bash
# 1. Work (build fails, tests fail, whatever)
amp "Add authentication feature"

# 2. Learn from failures
npm run ace-learn

# 3. Check what was learned
tail AGENTS.md
```

## How It Actually Works

### The Three Agents

**Generator** (agents/Generator.ts)
- Captures what went wrong during work
- Saves to `logs/execution_traces.jsonl`

**Reflector** (agents/Reflector.ts)  
- Finds patterns in failures
- Saves to `logs/insights.jsonl`

**Curator** (agents/Curator.ts)
- Adds best patterns to `AGENTS.md`
- Amp reads this and learns

### The Flow

```
┌─────────────┐
│  You work   │
└──────┬──────┘
       │ (build/test fails)
       ▼
┌─────────────┐
│  Generator  │ Captures: "TypeScript import error"
└──────┬──────┘
       ▼
┌─────────────┐
│  Reflector  │ Analyzes: "Pattern: Need .js extension"
└──────┬──────┘
       ▼
┌─────────────┐
│   Curator   │ Adds to AGENTS.md
└──────┬──────┘
       ▼
┌─────────────┐
│ AGENTS.md   │ "TypeScript imports need .js extension"
└──────┬──────┘
       ▼
  Next time Amp reads this ✓
```

## Example

**Before:**
```typescript
// You write:
import { auth } from './auth';  // ← Build fails
```

**Generator captures:**
```json
{"error": "Cannot find module './auth'", "file": "src/index.ts"}
```

**Reflector finds pattern:**
```json
{"pattern": "TypeScript ESM needs .js extension", "confidence": 0.95}
```

**Curator updates AGENTS.md:**
```markdown
### TypeScript Patterns
[Bullet #xyz, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions
```

**Next time:**
```typescript
// Amp now writes:
import { auth } from './auth.js';  // ✓ Correct!
```

## Files You Get

```
your-project/
├── agents/
│   ├── Generator.ts   # Captures failures
│   ├── Reflector.ts   # Finds patterns  
│   └── Curator.ts     # Updates knowledge
├── mcp/
│   ├── types.ts
│   └── beads-client.ts
├── scripts/
│   └── ace-learn-cycle.ts  # The magic ✨
├── logs/
│   ├── execution_traces.jsonl  # What went wrong
│   └── insights.jsonl          # Patterns found
└── AGENTS.md  # What Amp reads ← THE IMPORTANT ONE
```

## Three Ways to Use

### 1. Manual (Simplest)

```bash
# After working
npm run ace-learn
```

### 2. Automatic (Recommended)

Close tasks with BeadsClient:
```typescript
import { BeadsClient } from './mcp/beads-client.js';
await new BeadsClient().closeIssue('task-id', 'Done');
// ↑ Auto-triggers learning
```

### 3. Git Hook (Advanced)

```bash
# Auto-learn on every commit
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
npm run ace-learn &
EOF
chmod +x .git/hooks/post-commit
```

## Expected Results

After 10-20 tasks, you should see:
- ✅ AGENTS.md grows with 10-30 patterns
- ✅ Amp stops making repeated mistakes
- ✅ Build/test failures decrease
- ✅ ~10% improvement in coding quality (from ACE paper)

## Full Docs

- 📦 [Easy Install Guide](EASY_INSTALL.md) - Detailed installation
- 📖 [Integration Guide](INTEGRATION_GUIDE.md) - Complete usage
- 🏗️ [Original Setup](SETUP_COMPLETE.md) - Complex version reference

## FAQ

**Q: Do I need Beads?**  
A: No, but recommended. You can use it without task tracking.

**Q: Do I need MCP servers?**  
A: No. The simple version doesn't need MCP.

**Q: Can I use this with Python/Go/other languages?**  
A: Yes! Adjust the error patterns in Reflector.ts for your language.

**Q: How big does AGENTS.md get?**  
A: Typically 50-200 lines. One pattern per mistake learned.

**Q: Does this slow down my workflow?**  
A: No. Learning runs in background, takes ~1 second.

**Q: What if I don't like a pattern?**  
A: Just delete the bullet from AGENTS.md.

## Support

Issues? Check:
1. `npm run build` works?
2. `logs/execution_traces.jsonl` has content?
3. `AGENTS.md` has section headers?

Still stuck? Open an issue.

## Ready?

```bash
# Install
./scripts/create-ace-starter.sh ~/my-project

# Use
cd ~/my-project
amp "Build something amazing"
npm run ace-learn

# Win
cat AGENTS.md  # See what you learned!
```

Happy learning! 🚀
