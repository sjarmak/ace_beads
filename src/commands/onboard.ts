import { existsSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { loadConfig } from '../lib/config.js';
import { initCommand } from './init.js';
import { ensureBeadsInstalled } from '../lib/beads-installer.js';
import { ensureGeneratorRunning } from '../lib/amp-generator.js';

const ONBOARD_AGENTS_MD = `# ACE Framework - Agent Onboarding Guide

## What is ACE?

ACE (Agentic Context Engineering) is a **self-improving coding agent framework**. It learns from your execution feedback to continuously improve performance over time.

### Core Concept

When you complete work, ACE:
1. **Captures** execution traces (build/test/lint results, errors, discovered issues)
2. **Analyzes** patterns across those traces (what went wrong, what contexts would have prevented issues)
3. **Updates** this AGENTS.md file with learned patterns as actionable bullets
4. **Applies** these bullets in future work to avoid repeating mistakes

## How to Use ACE as an Agent

### 1. During Task Execution

When working on a task, **automatically capture execution feedback**:

\`\`\`bash
# After running build/test/lint and encountering errors
ace capture --bead <task-id> --exec <execution-json-file> --outcome failure
\`\`\`

The execution JSON should contain:
\`\`\`json
[{
  "runner": "tsc",
  "command": "npm run build",
  "status": "fail",
  "errors": [{
    "tool": "tsc",
    "severity": "error",
    "message": "Cannot find module './auth.js'",
    "file": "src/index.ts",
    "line": 5
  }]
}]
\`\`\`

### 2. After Completing Work

When you finish a task, **trigger learning**:

\`\`\`bash
ace learn --beads <task-id> --min-confidence 0.8
\`\`\`

This analyzes your traces and updates AGENTS.md with new patterns.

### 3. Before Starting New Work

**Consult learned patterns** to avoid past mistakes:

\`\`\`bash
ace get bullets --sections "TypeScript Patterns" --sort-by helpful --limit 10
\`\`\`

The patterns below are automatically managed - they accumulate over time based on real execution feedback.

## Integration with Beads (bd)

ACE works seamlessly with Beads for issue tracking:

1. **Create issues**: \`bd create "Fix auth bug" -t bug -p 1\`
2. **Work on task**: \`bd update bd-42 --status in_progress\`
3. **Capture traces**: \`ace capture --bead bd-42 --exec errors.json\`
4. **Complete task**: \`bd close bd-42 --reason "Fixed"\`
5. **Learn from work**: \`ace learn --beads bd-42\`

### Auto-Learning Hook (Optional)

Install a post-close hook to automatically learn when closing beads:

\`\`\`bash
ace beads hook install
\`\`\`

Now when you \`bd close <id>\`, ACE automatically runs learning on that task.

## Example Workflow

\`\`\`bash
# 1. Start work
bd ready
bd update bd-123 --status in_progress

# 2. Work on the task, run builds/tests
npm run build  # fails with TypeScript error

# 3. Capture the failure
cat > exec.json << 'EOF'
[{
  "runner": "tsc",
  "command": "npm run build",
  "status": "fail",
  "errors": [{
    "tool": "tsc",
    "severity": "error",
    "message": "Cannot find module './utils.js'",
    "file": "src/main.ts",
    "line": 3
  }]
}]
EOF

ace capture --bead bd-123 --exec exec.json --outcome failure

# 4. Fix the issue (e.g., add .js extension to import)
# 5. Verify fix
npm run build  # passes

# 6. Complete task
bd close bd-123 --reason "Fixed import extensions"

# 7. Learn from this work
ace learn --beads bd-123
\`\`\`

After this, AGENTS.md will have a new bullet like:
> [Bullet #abc123, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements when using ESM module resolution

## Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->
<!-- Bullets accumulate over time and are never compressed -->

### Build & Test Patterns
<!-- Curator adds build/test insights here -->

### TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

### Dependency Patterns
<!-- Curator adds patterns about Beads dependency chains here -->

### Architecture Patterns
<!-- Curator adds high-level design insights here -->

## Available Commands

- \`ace init\` - Initialize ACE in a project
- \`ace capture\` - Record execution trace
- \`ace analyze\` - Extract patterns from traces
- \`ace update\` - Apply insights to AGENTS.md
- \`ace learn\` - Convenience: analyze → update
- \`ace get insights\` - Query insights
- \`ace get bullets\` - Query learned patterns
- \`ace beads hook install\` - Auto-learn on bead close

## Key Principles for Agents

1. **Always capture failures** - Don't let execution errors go unrecorded
2. **Learn after completing work** - Run \`ace learn\` when finishing tasks
3. **Consult patterns before work** - Check \`ace get bullets\` for relevant guidance
4. **Link discovered issues** - When you find new work, capture it with \`--discovered\`
5. **Trust the feedback loop** - The more you use ACE, the better it gets

## Files and Directories

- \`AGENTS.md\` - This file, contains learned patterns
- \`logs/execution_traces.jsonl\` - Raw execution traces
- \`logs/insights.jsonl\` - Extracted insights from Reflector
- \`.ace.json\` - Optional project configuration

## Configuration

Create \`.ace.json\` to customize paths:

\`\`\`json
{
  "agentsPath": "AGENTS.md",
  "logsDir": "logs",
  "maxDeltas": 3,
  "defaultConfidence": 0.8
}
\`\`\`

---

**Ready to start?** Run \`bd ready\` to see available work, or \`bd create "Task name"\` to create a new task.
`;

const SAMPLE_TASK_MD = `# Sample Task: Fix TypeScript Import Error

This is a sample task to demonstrate the ACE workflow.

## Setup

1. The file \`src/broken.ts\` has an intentional import error
2. Running \`npm run build\` will fail
3. You should capture this failure with ACE

## Steps

1. Try building: \`npm run build\`
2. Capture the error: \`ace capture --bead sample-1 --exec error.json\`
3. Fix the import in \`src/broken.ts\` (add \`.js\` extension)
4. Verify: \`npm run build\`
5. Learn: \`ace learn --beads sample-1\`
6. Check what was learned: \`ace get bullets --sections "TypeScript Patterns"\`

## Expected Outcome

After completing this, AGENTS.md should have a bullet about TypeScript imports requiring .js extensions.
`;

export async function onboardCommand(options: { json?: boolean }): Promise<void> {
  await ensureBeadsInstalled();
  await ensureGeneratorRunning();
  
  console.error('🚀 ACE Onboarding - Setting up self-improving agent framework...\n');
  
  const steps: string[] = [];
  
  // 1. Run ace init
  console.error('📁 Initializing ACE structure...');
  const initResult = await initCommand({ json: false });
  steps.push('ACE initialized (logs/, AGENTS.md, trace files)');
  
  // 2. Replace AGENTS.md with onboarding version
  const config = loadConfig();
  writeFileSync(config.agentsPath, ONBOARD_AGENTS_MD, 'utf-8');
  steps.push('AGENTS.md updated with agent onboarding guide');
  
  // 3. Beads is already ensured by ensureBeadsInstalled() call above
  // initCommand() will have already run bd init if needed
  
  // 4. Create sample project structure if it doesn't exist
  if (!existsSync('src')) {
    console.error('📝 Creating sample project files...');
    const { mkdirSync } = await import('fs');
    mkdirSync('src', { recursive: true });
    
    // Sample broken TypeScript file
    writeFileSync('src/broken.ts', `import { helper } from './helper';

export function main() {
  return helper();
}
`, 'utf-8');
    
    // Sample helper file
    writeFileSync('src/helper.ts', `export function helper() {
  return 'Hello from ACE!';
}
`, 'utf-8');
    
    // Sample package.json if it doesn't exist
    if (!existsSync('package.json')) {
      writeFileSync('package.json', JSON.stringify({
        name: 'ace-test-project',
        version: '1.0.0',
        type: 'module',
        scripts: {
          build: 'tsc'
        },
        devDependencies: {
          typescript: '^5.3.0'
        }
      }, null, 2), 'utf-8');
    }
    
    // Sample tsconfig.json
    if (!existsSync('tsconfig.json')) {
      writeFileSync('tsconfig.json', JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'node',
          outDir: './dist',
          strict: true,
          esModuleInterop: true
        },
        include: ['src/**/*']
      }, null, 2), 'utf-8');
    }
    
    // Sample task file
    writeFileSync('SAMPLE_TASK.md', SAMPLE_TASK_MD, 'utf-8');
    
    steps.push('Sample TypeScript project created (src/, package.json, tsconfig.json)');
    steps.push('Sample task created (SAMPLE_TASK.md)');
  }
  
  // Output summary
  if (options.json) {
    console.log(JSON.stringify({
      success: true,
      steps,
      nextSteps: [
        'Read AGENTS.md for agent instructions',
        'Read SAMPLE_TASK.md for a demo workflow',
        'Run: npm install',
        'Run: bd ready (to see available work)',
        'Run: ace get bullets (to see learned patterns)'
      ]
    }, null, 2));
  } else {
    console.error('\n✅ ACE Onboarding Complete!\n');
    console.error('What was set up:');
    steps.forEach(step => console.error(`  ✓ ${step}`));
    
    console.error('\n📖 Next Steps:\n');
    console.error('  1. Read AGENTS.md - Complete guide for agents');
    console.error('  2. Read SAMPLE_TASK.md - Demo the ACE workflow');
    console.error('  3. Run: npm install (if using sample project)');
    console.error('  4. Run: bd ready (to see available work)');
    console.error('  5. Run: ace get bullets (to see learned patterns)\n');
    
    console.error('💡 Tip: Open AGENTS.md to understand how ACE works as an agent\n');
  }
}
