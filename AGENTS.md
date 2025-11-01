# ACE_Beads_Amp Project

This project implements the ACE (Agentic Context Engineering) framework using Amp subagents and Beads for task tracking.

## Project Goal

Create a self-improving coding agent system that learns from execution feedback to continuously improve its performance over time.

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**
```bash
bd ready --json
```

**Create new issues:**
```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**
```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**
```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:
- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

## ACE Framework Architecture

This project implements three specialized subagents:

### 1. ACE Generator (Main Coding Agent)
- **Role**: Execute coding tasks from the Beads work queue
- **Permissions**: Full read/write access to codebase, can run build/test/lint
- **Responsibilities**:
  - Pick ready work from `bd ready`
  - Implement features, fix bugs
  - Run tests and builds
  - File discovered issues with `discovered-from` links
  - Track which AGENT.md bullets were helpful/harmful

### 2. ACE Reflector (Insight Extraction)
- **Role**: Analyze execution outcomes and extract patterns
- **Permissions**: Read-only access, can append to insights.jsonl
- **Responsibilities**:
  - Analyze build/test/lint execution traces
  - Examine Beads `discovered-from` chains for patterns
  - Identify what context would have prevented issues
  - Extract actionable insights without speculation
  - Output structured insights with evidence

### 3. ACE Curator (Knowledge Manager)
- **Role**: Integrate insights into AGENT.md playbook
- **Permissions**: Can only write to knowledge/AGENT.md
- **Responsibilities**:
  - Apply incremental delta updates to AGENT.md
  - Never rewrite entire file (prevents context collapse)
  - Deduplicate similar insights
  - Maintain bullet structure with helpfulness counters
  - Organize knowledge with section anchors

## ACE Learning Workflow

### Online Adaptation (During Work Sessions)
After completing each issue:
1. Generator reports execution feedback
2. Reflector analyzes outcomes
3. Curator applies high-confidence deltas (confidence ≥ 0.8)
4. Limit: Max 3 deltas per session to prevent churn

### Offline Adaptation (Weekly Batch Learning)
Multi-epoch learning across all completed work:
1. Cluster insights by pattern signature
2. Extract meta-patterns (patterns of patterns)
3. Propose consolidated deltas
4. Human review for lower-confidence insights
5. Update AGENT.md with "Epoch N Summary" deltas

## Technology Stack

- **Language**: TypeScript
- **Build**: tsc (TypeScript compiler)
- **Test**: Vitest
- **Lint**: ESLint with TypeScript plugin
- **Package Manager**: npm

## Build Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

## Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->
<!-- Bullets accumulate over time and are never compressed -->

### Build & Test Patterns
<!-- Curator adds build/test insights here -->

[Bullet #88f22305, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #8efa09af, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #dba868d9, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #1b053876, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #013e4f93, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #806ffa28, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #9dee6272, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #9026db05, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #e8805e9b, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #5d35cd76, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #b8f32df6, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #5af78522, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #dc57b44a, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #ad7fdd59, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #3d3cf3fb, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #45fec16a, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #dc3dcb36, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #261b3db0, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #bcee9c08, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #f80da345, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #8daa172a, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #c1375286, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #dff8a895, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #21033da2, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #a5d94bb8, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
[Bullet #041e4d58, helpful:0, harmful:0] Always validate user input before processing - Implement input validation at API boundaries to prevent malformed data from entering the system
### TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

[Bullet #c080e220, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #00db9748, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #0b74959e, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #0cdb5a08, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #dd6e0978, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #c01cb80a, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #99619f8c, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #d3753dd3, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #0ad99481, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #0c41f816, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #ed1d31c3, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #9c81bcc4, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #fc449f3e, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #9563e6ce, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #28407243, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #ccdb19ea, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #cc609a2f, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #9c013453, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #ea49074c, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #3835998d, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #6d36ca09, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #4825df70, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #ab4772df, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #1928b22b, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #6ea196dc, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #2e4d6222, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #ccaa0991, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #cea69bd8, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #244baf05, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #02afd7e1, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #0237399d, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #6f5b22a4, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #46fc39e5, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #82b1868b, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #ec875319, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #77850469, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #fac790c0, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #58713f64, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #60e84032, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #3e0cbce3, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #b1588e28, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #d3d18c13, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #7dfdfcf0, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #5fabb26b, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #bfe8ba42, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #f0c47345, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #a971aa75, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #7c767484, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #e0c6d72a, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #91286414, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #e15bf2ff, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #81398da0, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #ffcf180e, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #49163bd6, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #6a3ee98c, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #1ec5a40e, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #91b963ba, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
### Dependency Patterns
<!-- Curator adds patterns about Beads dependency chains here -->

### Architecture Patterns
<!-- Curator adds high-level design insights here -->

[Bullet #91ca8f2b, helpful:1, harmful:1] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
