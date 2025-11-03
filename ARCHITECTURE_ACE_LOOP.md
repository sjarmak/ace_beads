# ACE Loop Architecture - Canonical Implementation

This document describes the canonical ACE learning loop implementation following the pattern:

**Generator → Reflector → Curator → Evaluator → (P→P')**

## Overview

ACE (Agentic Context Engineering) is a self-improving coding agent framework that evolves its context playbook (P) through execution feedback loops.

### Invariant Goals

1. **Evolve contexts without collapse** - No brevity bias, preserve valuable patterns
2. **Accumulate narrow, auditable edits** - Track every change with metadata
3. **Keep roles modular** - Generator, Reflector, Curator, Evaluator are independent subagents
4. **Support online and offline modes** - Immediate learning or batch processing

## The Canonical Loop

```
P ← init_playbook()
for x in task_stream:
  y, t ← GENERATOR.run(x, P)           # Execute task, produce output y and trace t
  s, d ← REFLECTOR.analyze(t, x, y, P) # Extract insights s, draft deltas d
  P′ ← CURATOR.apply(P, d)              # Validate, dedupe, refine → P′
  if evaluate(P′) ≥ evaluate(P): P ← P′ # Accept only if improved
  persist({trace:t, insights:s, deltas:d, playbook:P})
```

### Step-by-Step

1. **Initialize playbook P** - Load AGENTS.md with bulleted strategies
2. **Generator executes task** - Uses P for guidance, produces trace t
3. **Reflector analyzes trace** - Extracts insights s and drafts deltas d
4. **Curator validates deltas** - Dedupes, refines, routes to sections → P′
5. **Evaluator compares P vs P′** - Accept if metrics improve, else revert
6. **Persist artifacts** - Save trace, insights, deltas, final playbook

## Subagents (Built with Amp SDK)

All components are **AI subagents** using `@sourcegraph/amp-sdk`:

### ace-generator

**Role**: Execute tasks using playbook context

**Responsibilities**:
- Run task with access to playbook bullets
- Consult relevant bullets before decisions
- Mark bullets helpful/harmful based on utility
- Record execution results (build/test/lint)
- Track discovered issues
- Output structured trace t

**Permissions**:
- Read, Grep, glob, finder (allow)
- Bash (allow)
- edit_file, create_file (ask)

### ace-reflector

**Role**: Analyze traces and extract insights

**Responsibilities**:
- Inspect trace t for patterns and errors
- Calculate confidence scores (0.0-1.0)
- Extract insights s with evidence
- Draft delta edits d as new bullets
- Identify harmful bullets to prune

**Confidence Scoring**:
- 0.9-1.0: High (5+ beads, clear evidence)
- 0.8-0.9: Strong (3-5 beads or critical single)
- 0.65-0.8: Moderate (2-3 beads)
- <0.65: Low (single occurrence)

**Online eligible**: confidence >= 0.8

**Permissions**:
- Read, Grep (allow)

### ace-curator

**Role**: Maintain playbook quality

**Responsibilities**:
- Validate drafted deltas d
- Deduplicate against existing bullets
- Refine wording for clarity
- Route to appropriate sections
- Prune low-performing bullets (net < -3)
- Compose minimal P→P′

**Deduplication**:
- Normalize patterns (lowercase, trim, abstract)
- Merge duplicates with aggregated counters
- Add "Aggregated from N instances" metadata

**Section Routing**:
- TypeScript Patterns: tsc, type errors, modules
- Build & Test Patterns: builds, tests, npm
- Dependency Patterns: discovered issues
- Architecture Patterns: meta-patterns, high-level

**Permissions**:
- Read, Grep (allow)

### ace-evaluator

**Role**: Compare playbook versions

**Responsibilities**:
- Calculate metrics for P and P′
- Determine if P′ is improvement
- Provide reasoning for accept/reject

**Metrics**:
- Total bullets
- Average helpful score
- Average harmful score
- Net score (helpful - harmful)
- Section distribution

**Improvement Criteria** (P′ > P if):
1. Net score increased
2. Net score same but avg helpful increased
3. More bullets without degrading avg helpful

**Permissions**:
- Read (allow)

## Modes

### Online Mode

**When**: Single or multiple beads, learning from existing traces

**Use case**: Immediate learning after task completion

```bash
# Single bead - learn from all traces
ace learn --beads bd-123 --mode online

# Multiple beads - process each
ace learn --beads bd-100,bd-101,bd-102 --mode online
```

**Flow**:
1. Load existing traces for bead(s)
2. For each trace: Reflector → Curator → Evaluator → P′
3. Accept P′ if improved, persist immediately
4. No generator execution (uses captured traces)

### Online Watch Mode (Continual Learning)

**When**: Continuous learning during task execution

**Use case**: Real-time learning as developer works

```bash
# Watch single bead for new traces
ace learn --beads bd-123 --mode online --watch
```

**Flow**:
1. Monitor trace file for new entries
2. On new trace for bead: Reflector → Curator → Evaluator → P′
3. Accept improvements immediately
4. Continue watching (Ctrl+C to stop)

### Offline Mode (Multi-Epoch)

**When**: Batch processing with multiple learning passes

**Use case**: Periodic knowledge consolidation and refinement

```bash
# 3 epochs over multiple beads (shuffled)
ace learn --beads bd-100,bd-101,bd-102 --mode offline --epochs 3
```

**Flow**:
1. For each epoch (1..N):
   - Shuffle bead order
   - Load all traces for each bead
   - Run Reflector → Curator → Evaluator for each trace
   - Prune bullets with net score < -3
   - Early stop if no updates accepted
2. Report multi-epoch summary

## Integration with Beads

### Auto-Learning Hook

`.beads/hooks/on-close`:
```bash
#!/bin/bash
BEAD_ID=$1

# Run final tests
npm test
TEST_EXIT=$?

# Capture results
ace capture --bead "$BEAD_ID" --outcome success/failure

# Run ACE loop in online mode
ace learn --beads "$BEAD_ID" --mode online

# Block close if tests fail
if [ $TEST_EXIT -ne 0 ]; then
  echo "❌ Tests failed! Cannot close bead."
  exit 1
fi
```

### Workflow

```bash
# 1. Create bead
bd create "Fix auth bug" -t bug -p 1

# 2. Start work
bd update bd-42 --status in_progress

# 3. Work on task (Generator consults playbook)
npm test  # Auto-captures to bead

# 4. Close bead (triggers ACE loop)
bd close bd-42 --reason "Fixed"
# → Runs tests
# → Captures results
# → ace learn --beads bd-42 --mode online
# → Updates playbook if P′ improved
```

## Artifacts

All artifacts are persisted for auditability:

### Execution Traces
`logs/execution_traces.jsonl`
```json
{
  "trace_id": "...",
  "bead_id": "bd-123",
  "task_description": "...",
  "bullets_consulted": [...],
  "execution_results": [...],
  "outcome": "success"
}
```

### Insights
`logs/insights.jsonl`
```json
{
  "id": "...",
  "pattern": "...",
  "evidence": [...],
  "recommendation": "...",
  "confidence": 0.85,
  "delta": "[Bullet #...] ..."
}
```

### Playbook Snapshots
`logs/artifacts/<timestamp>/playbook.md`

Snapshot of P′ after each accepted update.

## CLI Commands

### Learn (Canonical Loop)
```bash
# Online mode - learn from existing traces
ace learn --beads bd-123 --mode online

# Online watch - continual learning (Ctrl+C to stop)
ace learn --beads bd-123 --mode online --watch

# Offline multi-epoch (batch with refinement)
ace learn --beads bd-100,bd-101,bd-102 --mode offline --epochs 3

# Dry run (preview changes without applying)
ace learn --beads bd-123 --dry-run

# Custom thresholds
ace learn --beads bd-123 --min-confidence 0.9 --max-deltas 5

# Legacy mode (analyze + apply pipeline)
ace learn --beads bd-123 --use-legacy
```

### Status
```bash
ace status
# Shows:
# - Playbook metrics (bullets, avg scores)
# - Recent traces
# - Pending insights
```

### Get Insights
```bash
ace get insights --min-confidence 0.8
ace get bullets --section "TypeScript Patterns"
```

## Example Output

```
🔄 ACE Loop - online mode
Task: bd-123 - Fix TypeScript import errors

📝 Step 1: Generator executing task...
✓ Task completed (2 files changed, 3 bullets consulted)

🔍 Step 2: Reflector analyzing trace...
✓ Extracted 2 insights (confidence >= 0.8)

🎯 Step 3: Curator validating and applying deltas...
✓ Composed P′ with 2 new bullets, 0 duplicates removed

⚖️  Step 4: Evaluating P′ vs P...
Evaluation: ✅ ACCEPT
Reason: Net score improved from 42 to 44
Net score: 42 → 44 (+2)

✅ Playbook updated: P ← P′

📦 Artifacts saved to logs/artifacts/2025-11-02T...

📊 Result: ACCEPTED
   Iterations: 5
   Bullets added: 2
   Net score change: +2

✅ Learning complete!
```

## Key Principles

1. **Modular roles** - Each subagent is independent, testable
2. **Evidence-based** - All insights backed by execution traces
3. **Conservative evaluation** - Only accept clear improvements
4. **Auditable** - Every change tracked with metadata
5. **No collapse** - Preserve helpful patterns, prune harmful
6. **Transparent** - Clear reasoning for all decisions

## Files

- `src/lib/ace-subagents.ts` - Subagent definitions
- `src/lib/ACELoop.ts` - Loop orchestrator
- `src/lib/Evaluator.ts` - P vs P′ comparison
- `src/commands/learn.ts` - CLI command
- `src/commands/beads-hook.ts` - Beads integration
