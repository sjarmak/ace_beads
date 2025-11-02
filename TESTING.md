# Testing Strategy for Pure-CLI ACE

## Overview

Three levels of testing:
1. **Unit Tests** - Individual modules (deltas, merger, beads, knowledge)
2. **Integration Tests** - CLI commands end-to-end
3. **Manual Tests** - Real-world workflow validation

## Quick Test

```bash
# Run all tests
npm test

# Run specific test suites
npm test tests/deltas.test.ts
npm test tests/merger.test.ts
npm test tests/cli-integration.test.ts

# Build and verify
npm run build
npm run typecheck
```

## 1. Unit Tests

### Delta Module (`tests/deltas.test.ts`)

Tests for schema validation, normalization, and queue operations:

```bash
npm test tests/deltas.test.ts
```

**Validates:**
- Delta schema validation (Zod)
- Content normalization (trim, lowercase, collapse spaces)
- Hash generation (section::normalized)
- Queue operations (read, write, enqueue, dequeue)
- Deterministic sorting

### Merger Module (`tests/merger.test.ts`)

Tests for deterministic delta merging:

```bash
npm test tests/merger.test.ts
```

**Validates:**
- Deduplication by hash
- Op handling (add, amend, deprecate)
- Helpful/harmful counters
- Sorting rules (section → helpful → content)
- Bullet parsing from AGENTS.md
- Serialization with provenance

### Beads Client (`tests/beads-client.test.ts`)

Tests for Beads CLI integration:

```bash
npm test tests/beads-client.test.ts
```

**Validates:**
- JSON output preference
- Fallback to issues.jsonl
- Command execution (create, show, list, close)
- Error handling

### Knowledge Manager (`tests/knowledge.test.ts`)

Tests for AGENTS.md and playbook I/O:

```bash
npm test tests/knowledge.test.ts
```

**Validates:**
- Write-scope enforcement
- YAML front-matter handling
- Playbook updates
- Section management

## 2. Integration Tests

### CLI Commands (`tests/cli-integration.test.ts`)

End-to-end tests for CLI commands:

```bash
npm test tests/cli-integration.test.ts
```

**Tests:**
- `ace init` - Creates workspace
- `ace status` - Shows queue and stats
- `ace delta ls/show/rm` - Queue management
- `ace apply` - Applies deltas deterministically
- `ace apply --dry-run` - Preview mode
- `ace doctor` - Diagnostics
- `ace sweep` - Offline learning

### Full Workflow (`tests/e2e-workflow.test.ts`)

Complete learn → apply cycle:

```bash
npm test tests/e2e-workflow.test.ts
```

**Scenario:**
1. Create temp project
2. Initialize ACE (`ace init`)
3. Create mock beads with failures
4. Run learning (`ace learn`)
5. Verify deltas queued
6. Apply deltas (`ace apply`)
7. Verify AGENTS.md updated
8. Re-run apply (should be no-op)
9. Verify determinism

## 3. Manual Testing

### Prerequisites

```bash
# Build the CLI
npm run build

# Optional: Link for global use
npm link

# Install Beads CLI (optional but recommended)
curl -fsSL https://github.com/steveyegge/beads/install.sh | bash
```

### Test Scenario 1: Basic Init and Status

```bash
# 1. Create test project
mkdir /tmp/ace-test
cd /tmp/ace-test

# 2. Initialize
ace init
# Expected: Creates .ace/, knowledge/, prompts/, logs/

# 3. Check status
ace status
# Expected: 0 deltas, 0 beads

# 4. Run diagnostics
ace doctor
# Expected: All checks pass (except maybe Beads CLI)
```

### Test Scenario 2: Delta Queue Management

```bash
cd /tmp/ace-test

# 1. Manually create a delta (for testing)
cat > .ace/delta-queue.json << 'EOF'
[{
  "id": "00000000-0000-0000-0000-000000000001",
  "section": "test/patterns",
  "op": "add",
  "content": "Test pattern for validation",
  "metadata": {
    "source": {
      "beadsId": "test-1"
    },
    "confidence": 0.85,
    "helpful": 0,
    "harmful": 0,
    "tags": ["test"],
    "evidence": "Manual test delta creation",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}]
EOF

# 2. List deltas
ace delta ls
# Expected: Shows 1 delta

# 3. Show details
ace delta show 00000000
# Expected: Shows full delta details

# 4. Preview apply
ace apply --dry-run
# Expected: Shows what would be added to AGENTS.md

# 5. Apply
ace apply
# Expected: Updates AGENTS.md, creates git commit

# 6. Verify determinism (no-op on rerun)
ace apply
# Expected: "No deltas to apply"

# 7. Check AGENTS.md
cat knowledge/AGENTS.md
# Expected: Contains the test pattern with provenance comment

# 8. Clean up
ace delta rm 00000000
# Expected: Removes from queue
```

### Test Scenario 3: Full Workflow with Beads

```bash
cd /tmp/ace-test

# 1. Initialize Beads
bd init

# 2. Create a failing task
bd create "Test TypeScript import bug" --labels ace,reflect
# Output: bd-1

# 3. Simulate capturing a failure
cat > /tmp/errors.json << 'EOF'
[{
  "runner": "tsc",
  "command": "npm run build",
  "status": "fail",
  "errors": [{
    "tool": "tsc",
    "severity": "error",
    "message": "Cannot find module './utils.js'",
    "file": "src/main.ts",
    "line": 5
  }]
}]
EOF

ace capture --bead bd-1 --exec /tmp/errors.json --outcome failure
# Expected: Trace saved to logs/execution_traces.jsonl

# 4. Close the bead
bd close bd-1 --reason "Fixed import extensions"

# 5. Run learning
ace learn --beads bd-1
# Expected: Analyzes trace, generates deltas, applies to AGENTS.md

# 6. Verify results
ace status
cat knowledge/AGENTS.md
# Expected: Contains learned pattern about .js extensions

# 7. Create another similar issue
bd create "Another import issue" --labels ace,reflect
# Work on it, close it...

# 8. Sweep historical beads
ace sweep --range bd-1..bd-2
# Expected: Batch analysis, queues insights
```

### Test Scenario 4: Determinism Validation

```bash
cd /tmp/ace-test

# 1. Create multiple deltas with same content
cat > .ace/delta-queue.json << 'EOF'
[{
  "id": "00000000-0000-0000-0000-000000000001",
  "section": "test/patterns",
  "op": "add",
  "content": "Always validate input",
  "metadata": {
    "source": {"beadsId": "test-1"},
    "confidence": 0.85,
    "helpful": 0,
    "harmful": 0,
    "tags": ["test"],
    "evidence": "Test 1",
    "createdAt": "2025-01-01T00:00:00Z"
  }
},{
  "id": "00000000-0000-0000-0000-000000000002",
  "section": "test/patterns",
  "op": "add",
  "content": "  always VALIDATE input  ",
  "metadata": {
    "source": {"beadsId": "test-2"},
    "confidence": 0.90,
    "helpful": 0,
    "harmful": 0,
    "tags": ["test"],
    "evidence": "Test 2 (duplicate, different spacing)",
    "createdAt": "2025-01-01T01:00:00Z"
  }
}]
EOF

# 2. Apply
ace apply --dry-run
# Expected: Shows rejection of second delta (duplicate)

ace apply
# Expected: Accepts first, rejects second

# 3. Verify only one bullet in AGENTS.md
grep -c "always validate input" knowledge/AGENTS.md
# Expected: 1 (case-insensitive, normalized)
```

### Test Scenario 5: Write-Scope Enforcement

This requires modifying the test to try writing outside allowed paths.

```bash
# The KnowledgeManager should reject writes outside knowledge/** and prompts/**
# This is tested in unit tests, but can be manually verified by:

# 1. Try to write to root (should fail in code)
# 2. Check logs for "Write scope violation" errors
```

## 4. Performance Testing

### Load Test: Large Queue

```bash
# Generate 100 deltas
node -e "
const deltas = [];
for (let i = 0; i < 100; i++) {
  deltas.push({
    id: '00000000-0000-0000-0000-' + String(i).padStart(12, '0'),
    section: 'test/patterns',
    op: 'add',
    content: 'Test pattern ' + i,
    metadata: {
      source: { beadsId: 'test-' + i },
      confidence: 0.85,
      helpful: 0,
      harmful: 0,
      tags: ['test'],
      evidence: 'Test ' + i,
      createdAt: new Date().toISOString()
    }
  });
}
console.log(JSON.stringify(deltas, null, 2));
" > .ace/delta-queue.json

# Time the operations
time ace delta ls
time ace apply --dry-run
time ace apply
```

## 5. Regression Testing

Before each release, run:

```bash
# 1. All unit tests
npm test

# 2. Build
npm run build

# 3. Type checking
npm run typecheck

# 4. Linting
npm run lint

# 5. Manual smoke tests
ace doctor
ace status
ace delta ls

# 6. E2E workflow
cd /tmp/ace-e2e-test
rm -rf /tmp/ace-e2e-test && mkdir -p /tmp/ace-e2e-test
cd /tmp/ace-e2e-test
ace init
ace status
ace doctor
```

## 6. CI/CD Testing

### GitHub Actions (`.github/workflows/test.yml`)

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run typecheck
      - run: npm run lint
      
      # CLI smoke tests
      - run: node dist/src/cli.js --version
      - run: node dist/src/cli.js doctor || true
```

## Test Coverage Goals

- **Unit Tests**: > 80% coverage for new modules
- **Integration Tests**: All CLI commands tested
- **E2E Tests**: Complete workflow validated
- **Manual Tests**: Real-world scenarios work

## Known Limitations

1. **Beads CLI**: Tests that require `bd` will skip if not installed
2. **Git**: Some tests require git to be configured
3. **File System**: Tests create temp directories in `/tmp`

## Debugging Failed Tests

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run specific test file
npm test tests/deltas.test.ts

# Run with coverage
npm test -- --coverage

# Debug a test
node --inspect-brk node_modules/.bin/vitest run tests/deltas.test.ts
```

## Test Data

Sample fixtures are in `tests/fixtures/`:
- `sample-beads.jsonl` - Mock Beads issues
- `sample-deltas.json` - Test delta queue
- `sample-agents.md` - Test knowledge base

## Continuous Improvement

After each release:
1. Review test failures
2. Add tests for reported bugs
3. Update fixtures with real-world examples
4. Improve test coverage
