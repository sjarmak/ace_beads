# ACE Onboarding - Quick Setup for Agents

## TL;DR for Agents

ACE is a **self-improving coding agent framework**. It learns from your execution feedback to get better over time.

### One-Command Setup

\`\`\`bash
cd ~/test-ace  # or any project directory
/path/to/ace onboard
\`\`\`

This creates:
- ✅ AGENTS.md with complete agent instructions
- ✅ Logs directory for traces and insights
- ✅ Beads (bd) initialization for issue tracking
- ✅ Sample TypeScript project to demonstrate workflow
- ✅ SAMPLE_TASK.md with step-by-step demo

**Read AGENTS.md first** - it contains everything you need to know.

## What ACE Does

1. **Captures** - Records build/test/lint failures as you work
2. **Analyzes** - Finds patterns across those failures
3. **Updates** - Adds learned patterns to AGENTS.md
4. **Applies** - Uses those patterns to avoid repeating mistakes

## For Testing/Development

A complete test project is available at:

\`\`\`bash
cd ~/test-ace
cat AGENTS.md        # Read the full guide
cat SAMPLE_TASK.md   # See demo workflow
npm install          # Set up sample project
npm run build        # Try it (will fail intentionally)
\`\`\`

## Commands Overview

- \`ace onboard\` - Full setup with agent guide
- \`ace init\` - Basic ACE initialization
- \`ace capture\` - Record execution trace
- \`ace learn\` - Analyze and update knowledge
- \`ace get bullets\` - Query learned patterns

## Integration with Beads

If you use [Beads](https://github.com/steveyegge/beads) for issue tracking:

\`\`\`bash
bd create "Fix bug" -t bug -p 1
bd update bd-1 --status in_progress
# ... work on it, capture errors with ace ...
bd close bd-1 --reason "Fixed"
ace learn --beads bd-1  # Learn from this work
\`\`\`

## Files Created by Onboarding

\`\`\`
your-project/
├── AGENTS.md                    # ⭐ Agent onboarding guide (READ THIS)
├── SAMPLE_TASK.md               # Demo workflow
├── .beads/                      # Beads database (if bd available)
├── logs/
│   ├── execution_traces.jsonl  # Raw execution data
│   └── insights.jsonl           # Extracted patterns
├── src/                         # Sample TypeScript project
│   ├── broken.ts               # Intentional error for demo
│   └── helper.ts
├── package.json
└── tsconfig.json
\`\`\`

## Key Principle

**ACE learns from doing**. The more you use it to capture failures and run learning cycles, the better it gets at preventing future issues.

---

**Ready?** Run \`ace onboard\` in any directory and read the generated AGENTS.md.
