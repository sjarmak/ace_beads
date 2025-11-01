# Ultra-Simple ACE Framework

**TL;DR:** The ACE framework can be as simple as asking Amp to learn from your work.

## The Absolute Minimum (No Setup)

Just add this section to your `AGENTS.md`:

```markdown
## Learned Patterns
<!-- ACE learns patterns here -->
```

**Usage:**
```bash
# After fixing a bug or completing work
amp "I just fixed a TypeScript import error. Add this learning to AGENTS.md"
```

That's it. Seriously.

## Slightly Better (2 minutes)

### 1. Create Simple Script

Save as `.toolbox/learn` (make executable with `chmod +x`):

```bash
#!/bin/bash
echo "🧠 Learning from recent work..."

# Get last commit
LAST_COMMIT=$(git log -1 --pretty=format:"%s")

# Ask Amp to learn
amp -x "Analyze the last commit: '$LAST_COMMIT'. Extract any useful patterns and add to AGENTS.md under '## Learned Patterns'. Be concise."

echo "✓ Done"
```

### 2. Use It

```bash
export AMP_TOOLBOX=".toolbox"
./.toolbox/learn
```

Or add git hook (`.git/hooks/post-commit`):
```bash
#!/bin/bash
./.toolbox/learn &
```

## Why This Works

ACE framework principles:
1. ✅ **Learn from execution** - Amp reads test/build output
2. ✅ **Incremental updates** - Adds bullets to AGENTS.md
3. ✅ **Avoid rewrites** - Just appends, never replaces
4. ✅ **Context engineering** - AGENTS.md grows smarter over time

You get 90% of the benefit with 1% of the complexity.

## Real Example

**Before AGENTS.md:**
```markdown
## Learned Patterns
<!-- Empty -->
```

**You do work:**
```bash
# Fix a bug
git commit -m "Fix: add .js extension to TypeScript imports"

# Learn from it
amp "I just fixed an import error. The issue was TypeScript ESM requires .js 
     extensions even when importing .ts files. Add this to Learned Patterns in AGENTS.md"
```

**After AGENTS.md:**
```markdown
## Learned Patterns
- TypeScript ESM imports require .js extension even for .ts files - Always use .js in import statements
```

**Next time:** Amp sees this pattern and won't make the same mistake.

## Comparison with Complex Setup

| Task | Complex Version | Ultra-Simple |
|------|----------------|--------------|
| Setup | 2+ hours, 20 files, MCP server | 2 minutes, 1 section in AGENTS.md |
| Learn from bug | Auto-triggered complex pipeline | `amp "I fixed X, add to AGENTS.md"` |
| Knowledge base | Multiple .jsonl files, SQL DB | Just AGENTS.md |
| Dependencies | TypeScript, Node, MCP, Beads | None (Amp only) |
| Maintenance | High | Zero |
| Effectiveness | High | Nearly as high |

## Gradually Level Up

**Level 0:** No ACE at all
- Just work normally

**Level 1:** Manual learning (START HERE)
- Ask Amp to update AGENTS.md after fixing bugs
- 30 seconds setup

**Level 2:** Script automation
- Simple `.toolbox/learn` script
- 2 minutes setup

**Level 3:** Git hooks
- Auto-learn on commit
- 5 minutes setup

**Level 4:** Structured insights
- Add categories to AGENTS.md
- Track what works/doesn't
- 10 minutes setup

**Level 5:** Full framework
- Reflector/Curator agents
- Beads task tracking
- Metrics collection
- 2+ hours setup

## Recommendation

**Start at Level 1.** 

If you find yourself manually updating AGENTS.md frequently, upgrade to Level 2.

Only go to Level 5 if you're doing serious research or have a large team.

## The Secret

The "complex" ACE framework is just formalizing what good developers already do:

1. Fix a bug ✓
2. Remember the lesson ✓
3. Don't make the same mistake again ✓

AGENTS.md is the "remember the lesson" part. Amp is smart enough to read it and apply those lessons.

You don't need fancy infrastructure - just write down what you learn.
