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
5. **BEFORE closing**: Run full test suite
   - `npm run build && npm test`
   - If tests fail: Create discovered issues, DO NOT close parent
6. **Complete**: `bd close <id> --reason "Done"` (only when tests pass)

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

## Project-Specific Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->
<!-- General patterns belong in ~/AGENTS.md, only ACE_Beads_Amp-specific patterns here -->

### ACE Framework Patterns
<!-- Patterns specific to ACE implementation -->

### Beads Integration Patterns
<!-- Patterns about working with Beads issue tracker -->

### MCP Server Patterns
<!-- Patterns specific to MCP server implementation -->

### TypeScript Patterns
<!-- TypeScript-specific patterns for this project -->

[Bullet #f3dae788, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #7372075e, helpful:1, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #3fc9abac, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #1eb2f43d, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #f1b96134, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #f6e9b559, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #8b4b7af4, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #5a7ad4f9, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #b8e99fed, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #ea2fa11d, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #1f489aa6, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #7d50f8cf, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #d8e86a5e, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #0842d6b6, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #931cbd95, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #12353eb9, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #72e2e5f1, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #73f1de65, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #b058ff5a, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #2dd1c067, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #4dd0657b, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #6532c4c7, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #94500636, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #04bf257f, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #be6c1798, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #863a6dfa, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #4b37eb81, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #311983e7, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #23ac98d4, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #140b9370, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #efd08a29, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #6d8b6864, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #dd5d9804, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #eb82d1ab, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #de13e3b8, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #972e82ab, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #7993a9ed, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #102480fc, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #4789b3e7, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #f929b27b, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #608bac3c, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #dd219162, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #79d1b0e0, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #1312324a, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #2b5f4c00, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #6ed12ff5, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #3d0d73ee, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #35d9477b, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #37f17664, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #8c333320, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #4f904d6a, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #da5b94da, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #c8f74e7b, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #fbffbab3, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #2743dcae, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #bffd517b, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #391887e6, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #e2d34c91, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #a315bc66, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #1d26d3b8, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #095a7fc8, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #f7b95925, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #19d364a1, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #cb70bb6a, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #a169ed61, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #e96eb921, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #e3b53601, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #32385576, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #7edf069c, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #621b5241, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #d204cd37, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #77e8dbf8, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early
[Bullet #3b99a833, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #8edde21c, helpful:0, harmful:0] TypeScript module imports require .js extension even for .ts files - Always use .js extensions in import statements for TypeScript files when using ESM module resolution
[Bullet #9c0c70fc, helpful:0, harmful:0] TypeScript type errors from incorrect variable type assignment - Always ensure variable assignments match declared types - TypeScript will catch type mismatches at compile time
[Bullet #4d25d7ad, helpful:0, harmful:0] TypeScript build errors require running tsc before tests - Always run npm run build before npm test to catch type errors early