# ACE Framework Integration Guide

Easy setup for adding the ACE (Agentic Context Engineering) learning framework to any project.

## What You Get

A self-improving system where:
1. **You work** (using Amp, coding normally)
2. **Reflector** analyzes what went wrong (errors, patterns)
3. **Curator** updates AGENTS.md with learnings
4. **Next time** Amp reads those learnings and does better

## Prerequisites

- Node.js installed
- Beads CLI (`bd`) installed - [install guide](https://github.com/steveyegge/beads)
- Amp installed

## Quick Setup (10 minutes)

### 1. Install Beads in your project

```bash
cd your-project
bd init
```

### 2. Copy ACE Framework Files

Copy these files from this repo to your project:

```bash
# Core framework
mkdir -p agents mcp logs scripts

# Copy the three core agents
cp agents/Generator.ts your-project/agents/
cp agents/Reflector.ts your-project/agents/
cp agents/Curator.ts your-project/agents/

# Copy supporting infrastructure
cp mcp/types.ts your-project/mcp/
cp mcp/beads-client.ts your-project/mcp/

# Copy the learning cycle script
cp scripts/ace-learn-cycle.ts your-project/scripts/
```

### 3. Install Dependencies

```bash
npm install --save-dev typescript @types/node
```

If you don't have TypeScript configured:

```bash
# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  },
  "include": ["agents/**/*", "mcp/**/*", "scripts/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Add to package.json
npm pkg set type="module"
npm pkg set scripts.build="tsc"
```

### 4. Create AGENTS.md Structure

Create `AGENTS.md` with ACE-managed sections:

```markdown
# Your Project

## Build Commands
\`\`\`bash
npm run build
npm test
npm run lint
\`\`\`

## Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->

### Build & Test Patterns
<!-- Curator adds build/test insights here -->

### TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

### Dependency Patterns
<!-- Curator adds dependency insights here -->

### Architecture Patterns
<!-- Curator adds high-level design insights here -->
```

### 5. Create Log Directories

```bash
mkdir -p logs
touch logs/execution_traces.jsonl
touch logs/insights.jsonl
```

### 6. Build the Framework

```bash
npm run build
```

### 7. Test It Works

```bash
# Create a test insight manually
cat >> logs/insights.jsonl << 'EOF'
{"id":"test-1","timestamp":"2025-10-27T12:00:00Z","taskId":"test","source":{"beadIds":["test"]},"signal":{"pattern":"Always test your setup","evidence":["Setup complete"]},"recommendation":"Verify ACE framework is working correctly","scope":{},"confidence":0.9,"onlineEligible":true,"metaTags":["test"]}
EOF

# Run the learning cycle
npx tsx scripts/ace-learn-cycle.ts
```

You should see AGENTS.md updated with the test pattern.

## Usage

### Option A: Manual Trigger (Simple)

After completing work:

```bash
# 1. Close your bead
bd close ACE_Beads_Amp-42 --reason "Completed feature"

# 2. Run learning cycle
npx tsx scripts/ace-learn-cycle.ts
```

### Option B: Automatic Trigger (Recommended)

The framework auto-triggers when you close beads using BeadsClient:

```javascript
import { BeadsClient } from './mcp/beads-client.js';

const client = new BeadsClient();
await client.closeIssue('ACE_Beads_Amp-42', 'Completed');
// ↑ This automatically triggers ace-learn-cycle.ts in background
```

### Option C: Git Hook (Advanced)

Auto-run after each commit:

```bash
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
# Auto-learn from commits
npx tsx scripts/ace-learn-cycle.ts &
EOF

chmod +x .git/hooks/post-commit
```

## How to Actually Use It

### 1. Create a Task

```bash
bd create "Add user authentication" -t feature -p 1
```

### 2. Work on It (Using Amp)

```bash
amp "Work on the highest priority bead. Implement the feature, run tests, 
     and if you find issues, create discovered beads with discovered-from links"
```

### 3. When Tests/Build Fail

The key is **capturing execution traces**. Amp should write to `logs/execution_traces.jsonl`:

```typescript
// Amp does this automatically via Generator.ts or you can do it manually
import { Generator } from './agents/Generator.js';

const gen = new Generator();
await gen.startTask('ACE_Beads_Amp-42', 'Add authentication');

// ... do work ...
// When build/test fails:
await gen.recordExecution({
  runner: 'tsc',
  command: 'npm run build',
  status: 'fail',
  errors: [{
    tool: 'tsc',
    severity: 'error',
    message: 'Cannot find module ./auth.js',
    file: 'src/index.ts',
    line: 5
  }]
});

await gen.completeTask('success');
```

### 4. Close the Task

```typescript
import { BeadsClient } from './mcp/beads-client.js';

const client = new BeadsClient();
await client.closeIssue('ACE_Beads_Amp-42', 'Completed');
// ↑ Automatically triggers Reflector → Curator
```

### 5. Check What Was Learned

```bash
# See new patterns in AGENTS.md
cat AGENTS.md

# Or see raw insights
cat logs/insights.jsonl | tail -5
```

## Real Example

Here's a complete workflow:

```bash
# 1. Create task
bd create "Fix TypeScript imports" -t bug -p 1

# 2. Use Amp to work on it
amp "Fix the import errors in src/index.ts"

# 3. Amp tries, tests fail, creates execution trace
# (This happens automatically if using Generator.ts)

# 4. Close the task
npx tsx -e "
import { BeadsClient } from './dist/mcp/beads-client.js';
const client = new BeadsClient();
await client.closeIssue('ACE_Beads_Amp-43', 'Fixed imports');
"

# 5. Check what was learned
tail -5 AGENTS.md
```

Output in AGENTS.md:
```markdown
### TypeScript Patterns
[Bullet #a1b2c3d4, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
```

## Minimal File Structure

After setup, you should have:

```
your-project/
├── agents/
│   ├── Generator.ts      # Tracks work, captures traces
│   ├── Reflector.ts      # Analyzes patterns
│   └── Curator.ts        # Updates knowledge
├── mcp/
│   ├── types.ts          # TypeScript interfaces
│   └── beads-client.ts   # Beads integration
├── scripts/
│   └── ace-learn-cycle.ts # Reflector → Curator pipeline
├── logs/
│   ├── execution_traces.jsonl  # Captured failures
│   └── insights.jsonl          # Extracted patterns
├── AGENTS.md             # Growing knowledge base
└── package.json
```

## What Gets Learned Automatically

The framework automatically extracts patterns from:

✅ **Build errors** - TypeScript, ESLint, compilation issues
✅ **Test failures** - Timeouts, assertion errors, async issues  
✅ **Discovered issues** - When one task reveals related problems
✅ **Recurring patterns** - Same error across multiple tasks

## Customization

### Add Your Own Pattern Categories

Edit AGENTS.md to add sections:

```markdown
### API Patterns
<!-- Curator adds API-specific insights here -->

### Database Patterns
<!-- Curator adds DB insights here -->
```

Update `Curator.ts` to route insights to new sections:

```typescript
private determineSection(insight: Insight): string {
  const tags = insight.metaTags || [];
  
  if (tags.includes('api') || tags.includes('endpoint')) {
    return 'API Patterns';
  }
  if (tags.includes('database') || tags.includes('sql')) {
    return 'Database Patterns';
  }
  // ... existing logic
}
```

### Adjust Learning Thresholds

In `ace-learn-cycle.ts`:

```typescript
// Change minimum confidence (default: 0.8)
const deltas = await curator.processInsights(0.9); // More strict

// Change max deltas per session (default: 3)
const curator = new Curator(insightsPath, agentsPath, 5); // Learn more per session
```

## Troubleshooting

### "No insights generated"

Make sure execution traces are being written. Check:
```bash
cat logs/execution_traces.jsonl
```

Should contain JSON objects with errors. If empty, the Generator isn't capturing failures.

### "Section not found in AGENTS.md"

Curator can't find where to insert patterns. Make sure AGENTS.md has:
```markdown
### Build & Test Patterns
### TypeScript Patterns
```

Exact section names matter!

### "Module not found" errors

Remember to use `.js` extensions in imports (even for `.ts` files):
```typescript
// ✅ Correct
import { Generator } from './agents/Generator.js';

// ❌ Wrong
import { Generator } from './agents/Generator';
```

## Next Steps

1. ✅ Complete this setup
2. Work on 3-5 real tasks using Amp
3. Check AGENTS.md - it should grow with patterns
4. After 10-20 tasks, Amp will start avoiding past mistakes automatically

## Advanced: Custom Reflector Logic

Add domain-specific pattern detection in `Reflector.ts`:

```typescript
private generateRecommendation(tool: string, pattern: string, errors: NormalizedError[]): string {
  // Add your custom patterns
  if (pattern.includes('database') && pattern.includes('connection')) {
    return 'Always use connection pooling for database access';
  }
  
  if (pattern.includes('API') && pattern.includes('rate limit')) {
    return 'Implement exponential backoff for API calls';
  }
  
  // ... existing logic
}
```

## Why This Works

The ACE framework creates a **learning loop**:

```
Work → Fail → Reflect → Learn → Work Better → Repeat
```

Each cycle adds specific, actionable patterns to AGENTS.md. Over time, Amp reads these patterns and avoids repeating mistakes.

**Target improvement:** 10.6% better performance on coding tasks (from ACE research paper).

## Support

Questions? Check:
- Original ACE paper: https://arxiv.org/html/2510.04618v1
- Beads docs: https://github.com/steveyegge/beads
- Amp manual: https://ampcode.com/manual
