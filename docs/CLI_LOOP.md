# Pure-CLI ACE Loop

This document describes the pure-CLI implementation of the ACE (Agentic Context Engineering) learning loop, integrated with Beads for task tracking and Amp SDK for subagent execution.

## Architecture

### Components

1. **Generator** (Main Amp agent)
   - Executes coding tasks
   - Creates/updates Beads issues on failures
   - Labels issues with `ace` and `reflect`
   - Permissions: bash, edit, beads.read, beads.write

2. **Reflector** (Amp subagent, read-only)
   - Analyzes execution traces from failed beads
   - Extracts patterns and insights
   - Outputs JSON deltas (max 3 per session)
   - Permissions: read-only

3. **Curator** (Amp subagent, write-scoped)
   - Validates and deduplicates deltas
   - Merges deltas into knowledge base (AGENTS.md)
   - Updates playbook.yaml with new sections
   - Permissions: write to `knowledge/**` and `prompts/**` only

### Data Flow

```
Beads (bd) → Reflector → Delta Queue → Curator → AGENTS.md
                ↑                          ↓
         Execution Traces            Playbook.yaml
```

## Commands

### Core Workflow

#### 1. Initialize ACE
```bash
ace init
```
Creates workspace structure:
- `.ace/config.json` - Configuration
- `.ace/delta-queue.json` - Pending deltas
- `knowledge/AGENTS.md` - Knowledge base
- `knowledge/playbook.yaml` - Section weights
- `prompts/` - Role-specific prompts
- `logs/` - Traces and insights

#### 2. Check Status
```bash
ace status [--json]
```
Shows:
- Number of queued deltas
- Beads statistics (total, labeled, ready)
- Current config (confidence threshold, max deltas)

#### 3. Run Learning Cycle
```bash
ace learn [--beads bd-123,bd-456] [--min-confidence 0.8] [--max-deltas 3] [--json]
```
Runs full pipeline:
1. Syncs with Beads
2. Filters issues by labels (ace, reflect)
3. Launches Reflector subagent to analyze traces
4. Validates and queues deltas
5. Launches Curator subagent to merge deltas
6. Updates AGENTS.md and playbook.yaml
7. Creates git commit on `ace/curations` branch

#### 4. Review Deltas
```bash
ace review [--beads bd-123] [--json]
```
Dry-run mode: shows what would be applied without making changes.

#### 5. Apply Deltas
```bash
ace apply [--id <delta-id>...] [--dry-run] [--no-branch] [--json]
```
Applies deltas from queue to knowledge base.

Options:
- `--id`: Apply specific deltas only
- `--dry-run`: Preview without applying
- `--no-branch`: Skip git branch/commit

#### 6. Sweep Historical Beads
```bash
ace sweep [--range bd-100..bd-200] [--labels ace,reflect] [--json]
```
Offline learning: runs Reflector over closed beads in bulk.

### Delta Management

#### List Deltas
```bash
ace delta ls [--json]
```

#### Show Delta Details
```bash
ace delta show <id> [--json]
```

#### Remove Deltas
```bash
ace delta rm <id1> <id2> ... [--json]
```

### Diagnostics

```bash
ace doctor [--json]
```
Checks:
- ACE config validity
- Beads CLI availability
- Knowledge directory structure
- AGENTS.md presence
- Delta queue status
- Git availability

## Configuration

### .ace/config.json

```json
{
  "roles": {
    "generator": {
      "agent": "amp",
      "permissions": ["bash", "edit", "beads.read", "beads.write"]
    },
    "reflector": {
      "agent": "amp-subagent",
      "name": "ace-reflector",
      "permissions": ["read"]
    },
    "curator": {
      "agent": "amp-subagent",
      "name": "ace-curator",
      "permissions": ["read", "write:knowledge", "write:prompts"]
    }
  },
  "beads": {
    "bin": "bd",
    "db": ".beads",
    "labels": ["ace", "reflect"],
    "autoLink": true
  },
  "learning": {
    "confidenceMin": 0.80,
    "maxDeltasPerSession": 3,
    "offline": {
      "epochs": 3,
      "reviewThreshold": 0.65
    }
  },
  "deltaQueue": ".ace/delta-queue.json"
}
```

## Delta Schema

Deltas are strictly validated against this schema:

```typescript
{
  id: string (uuid),
  section: string (lowercase, /-separated),
  op: "add" | "amend" | "deprecate",
  content: string (min 8 chars),
  metadata: {
    source: {
      beadsId: string,
      commit?: string,
      files?: string[],
      runId?: string
    },
    confidence: number (0-1),
    helpful: number (default 0),
    harmful: number (default 0),
    tags: string[],
    scope?: string[],
    evidence: string (min 8 chars),
    createdAt: string (ISO datetime)
  }
}
```

## Deterministic Merge Rules

The Curator enforces these rules for byte-identical outputs:

1. **Normalization**: Trim whitespace, collapse spaces, lowercase
2. **Hash Key**: `${section}::${normalizedContent}`
3. **Deduplication**: Reject if hash exists (unless op=amend)
4. **Deprecation**: Remove when `harmful > helpful` OR op=deprecate
5. **Sorting**: section asc → helpful desc → content asc
6. **Provenance**: Hidden HTML comments with delta metadata

### AGENTS.md Bullet Format

```markdown
## section/name

[Bullet #uuid, helpful:N, harmful:M] Content of the guidance
<!-- deltaId=uuid, beadsId=bd-123, createdAt=2025-01-15T10:30:00Z, hash=section::normalized -->
```

## Write Scope Enforcement

The Curator can ONLY write to:
- `knowledge/**`
- `prompts/**`

Any attempt to write outside these paths is rejected with an error.

## Integration with Beads

### Preferred: JSON Outputs

```bash
bd ready --json
bd list --json
bd show <id> --json
bd create "Title" --labels ace,reflect --json
bd close <id> --reason "Fixed" --json
```

### Fallback: issues.jsonl

If `--json` is unavailable, ACE parses `.beads/issues.jsonl` directly.

### Auto-Learning Hook

Install post-close hook:
```bash
ace beads hook install
```

Now when you `bd close <id>`, ACE automatically runs learning on that task.

## Example Workflow

```bash
# 1. Work on a task, encounter failure
npm run build  # fails with TypeScript error

# 2. Create bead
bd create "Fix TypeScript import error" --labels ace,reflect

# 3. Capture trace (manual or automatic)
ace capture --bead bd-123 --exec errors.json --outcome failure

# 4. Fix the issue
# ... make code changes ...
npm run build  # passes

# 5. Close bead
bd close bd-123 --reason "Fixed import extensions"

# 6. Run learning cycle
ace learn --beads bd-123

# 7. Review what was learned
ace status
ace delta ls

# 8. Apply to knowledge base
ace apply
```

## Testing

Run E2E tests:
```bash
npm test tests/e2e-cli-loop.test.ts
```

## Troubleshooting

### Beads CLI Not Found
```bash
# Install beads
curl -fsSL https://github.com/steveyegge/beads/install.sh | bash

# Or add to PATH
export PATH="$HOME/.beads/bin:$PATH"
```

### Delta Queue Corruption
```bash
# Clear queue
echo "[]" > .ace/delta-queue.json

# Or remove specific deltas
ace delta rm <id1> <id2>
```

### Git Commit Failures
```bash
# Skip git operations
ace apply --no-branch

# Or check git status
git status
git branch
```

### Permission Errors
The Curator will log explicit errors if it attempts to write outside `knowledge/` or `prompts/`.

Check `.ace/config.json` roles.curator.permissions.

## References

- [ACE Framework](../README.md)
- [Beads CLI](https://github.com/steveyegge/beads)
- [Amp SDK](https://ampcode.com/manual)
- [Delta Schema](./DELTA_SCHEMA.md)
