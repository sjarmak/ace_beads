# Insight Commands Documentation

## Overview

The ACE framework provides two commands for manual insight capture and analysis:

1. `ace insight add` - Manually add insights to the knowledge base
2. `ace insight postmortem` - Extract insights from thread history (requires thread indexer)

## ace insight add

Manually capture lessons learned, patterns discovered, or important observations directly into the insights system.

### Basic Usage

```bash
# Simplest form - just the pattern
ace insight add --pattern "Always validate user input before processing"

# With evidence
ace insight add \
  --pattern "TypeScript module imports require .js extension" \
  --evidence "src/commands/insight.ts:70,docs/TESTING.md"

# With custom confidence and section
ace insight add \
  --pattern "Run tsc before tests to catch type errors early" \
  --confidence 0.95 \
  --section "Build & Test Patterns"

# With bead and thread IDs
ace insight add \
  --pattern "Always use interactive mode for destructive operations" \
  --bead ACE_Beads_Amp-269 \
  --thread T-abc123
```

### Interactive Mode

Use `--interactive` to preview the insight before saving:

```bash
ace insight add \
  --pattern "Critical lesson learned from debugging" \
  --evidence "error.log:45,src/main.ts:123" \
  --section "Architecture Patterns" \
  --interactive
```

This will show:
```
📝 Insight Preview:
   Pattern: Critical lesson learned from debugging
   Section: Architecture Patterns
   Confidence: 0.9
   Evidence:
     - error.log:45
     - src/main.ts:123

Save this insight? [Y/n]:
```

### Auto-Detection

The command auto-detects context when available:

**Bead ID Detection:**
- Reads `ACE_BEAD_ID` or `CURRENT_BEAD_ID` environment variables
- Parses git branch name for patterns like `ACE_Beads_Amp-269` or `bd-42`

**Thread ID Detection:**
- Reads `AMP_THREAD_ID` environment variable

```bash
# In a git branch named "ACE_Beads_Amp-269-insight-commands"
# with AMP_THREAD_ID set
ace insight add --pattern "Some pattern"
# Auto-detects: bead=ACE_Beads_Amp-269, thread=current-thread-id
```

### JSON Output

```bash
ace insight add \
  --pattern "Test pattern" \
  --json
```

Output:
```json
{
  "insight": {
    "id": "775de3cd-d03e-4dbd-90f9-31b49c476b33",
    "timestamp": "2025-11-03T13:48:00.307Z",
    "taskId": "ACE_Beads_Amp-269",
    "source": {
      "runner": "manual",
      "beadIds": ["ACE_Beads_Amp-269"]
    },
    "signal": {
      "pattern": "Test pattern",
      "evidence": []
    },
    "recommendation": "Test pattern",
    "confidence": 0.9,
    "delta": {
      "section": "Manual Insights",
      "operation": "add",
      "content": "Test pattern"
    },
    "metaTags": ["manual"]
  },
  "saved": true
}
```

### Options Reference

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `--pattern <text>` | Pattern or lesson learned | - | ✅ |
| `--evidence <items>` | Comma-separated evidence (file:line, URLs, etc.) | - | ❌ |
| `--confidence <n>` | Confidence level (0.0-1.0) | 0.9 | ❌ |
| `--section <name>` | AGENTS.md section for the insight | "Manual Insights" | ❌ |
| `--bead <id>` | Bead ID (auto-detects if not provided) | auto-detect | ❌ |
| `--thread <id>` | Thread ID (auto-detects from env) | auto-detect | ❌ |
| `--interactive` | Show preview and prompt for approval | false | ❌ |
| `--json` | Output in JSON format | false | ❌ |

### Validation

- `--pattern` is required
- `--confidence` must be between 0.0 and 1.0
- Evidence is split by commas and trimmed
- Invalid confidence values will throw an error:
  ```
  ❌ --confidence must be between 0 and 1
  ```

## ace insight postmortem

Extract insights from thread history for a specific bead. This command discovers all Amp threads associated with a bead and uses LLM analysis to extract patterns and lessons.

### Status

⚠️ **Not yet fully implemented** - requires thread indexer (bead 270)

### Basic Usage

```bash
# Analyze all threads for a bead
ace insight postmortem --bead ACE_Beads_Amp-269

# With custom confidence threshold
ace insight postmortem \
  --bead ACE_Beads_Amp-269 \
  --min-confidence 0.85

# Dry run (preview without saving)
ace insight postmortem \
  --bead ACE_Beads_Amp-269 \
  --dry-run
```

### Current Behavior

Since the thread indexer is not yet implemented, the command will error:

```bash
$ ace insight postmortem --bead ACE_Beads_Amp-269
❌ Thread metadata not found: .beads/amp_metadata.jsonl
This feature requires the thread indexer (bead 270) to be implemented.
```

### Future Implementation

Once implemented, the command will:

1. **Discover threads** - Read `.beads/amp_metadata.jsonl` to find all threads for the bead
2. **Fetch thread content** - Use `read_thread` tool or API to get conversation history
3. **LLM analysis** - Extract patterns, errors, solutions using Gemini/Claude
4. **Save insights** - Write to `insights.jsonl` with proper thread refs and evidence

Expected output:
```
✅ Postmortem complete
   Discovered 3 thread(s) for bead ACE_Beads_Amp-269
   Extracted 7 insights
   Saved to: /Users/user/project/logs/insights.jsonl

📊 Top insights:
   • TypeScript imports need .js extension (confidence: 0.92)
   • Always run build before tests (confidence: 0.88)
   • Interactive mode prevents mistakes (confidence: 0.85)
```

### Options Reference

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `--bead <id>` | Bead ID to analyze | - | ✅ |
| `--min-confidence <n>` | Minimum confidence threshold | 0.8 | ❌ |
| `--dry-run` | Preview without saving | false | ❌ |
| `--json` | Output in JSON format | false | ❌ |

## Integration with ACE Workflow

### Manual Insight Capture During Work

```bash
# 1. Start working on a bead
bd update ACE_Beads_Amp-269 --status in_progress

# 2. While working, capture insights as you discover them
ace insight add \
  --pattern "Discovered that build must run before tests" \
  --evidence "error.log:123" \
  --section "Build & Test Patterns" \
  --interactive

# 3. After completing work
bd close ACE_Beads_Amp-269
# ↑ This auto-runs ace learn, which processes your manual insights
```

### Querying Manual Insights

```bash
# Get all manual insights
ace get insights --tags manual --limit 10

# Get manual insights for a specific bead
ace get insights --tags manual --beads ACE_Beads_Amp-269

# Get manual insights sorted by confidence
ace get insights --tags manual --sort-by confidence
```

### Promoting Insights to Knowledge Base

Manual insights flow through the standard ACE pipeline:

1. **Capture** - `ace insight add` writes to `insights.jsonl`
2. **Review** - `ace learn` processes insights with confidence >= threshold
3. **Apply** - High-confidence insights become bullets in `AGENTS.md`
4. **Feedback** - Bullets get helpful/harmful votes over time

## Examples

### Example 1: Document a Build Issue

```bash
ace insight add \
  --pattern "TypeScript build errors require running tsc before tests" \
  --evidence "logs/build.log:45,TESTING.md" \
  --confidence 0.95 \
  --section "Build & Test Patterns" \
  --bead ACE_Beads_Amp-269 \
  --interactive
```

### Example 2: Capture Architecture Decision

```bash
ace insight add \
  --pattern "Use commander.js for CLI argument parsing to maintain consistency" \
  --evidence "src/cli.ts:1-50,docs/ARCHITECTURE.md" \
  --confidence 0.9 \
  --section "Architecture Patterns"
```

### Example 3: Record Test Discovery

```bash
ace insight add \
  --pattern "Always use --run flag with vitest to avoid watch mode hangs" \
  --evidence "vitest-001 bullet,tests/*.test.ts" \
  --confidence 1.0 \
  --section "Build & Test Patterns"
```

### Example 4: Quick Pattern Note

```bash
# Minimal form - just the important pattern
ace insight add --pattern "Validate all user input at API boundaries"
```

## Best Practices

1. **Be specific** - Patterns should be actionable and concrete
2. **Include evidence** - Link to files, line numbers, or documentation
3. **Use appropriate confidence** - Reserve 1.0 for proven patterns, use 0.7-0.9 for hypotheses
4. **Choose the right section** - Match existing AGENTS.md sections for consistency
5. **Use interactive mode** - For important insights, preview before saving
6. **Tag consistently** - Manual insights are auto-tagged with "manual"

## Troubleshooting

### "Pattern is required" error

```bash
❌ Error: --pattern is required
```
**Solution:** Always provide the `--pattern` flag

### "Confidence must be between 0 and 1" error

```bash
❌ --confidence must be between 0 and 1
```
**Solution:** Use values like 0.8, 0.9, 0.95, not 80 or 1.5

### Postmortem command fails

```bash
❌ Thread metadata not found: .beads/amp_metadata.jsonl
```
**Solution:** This feature requires bead 270 (thread indexer) to be implemented first

## See Also

- [QUICKSTART_CLI.md](../QUICKSTART_CLI.md) - ACE CLI overview
- [TESTING.md](../TESTING.md) - Testing guidelines
- [AGENTS.md](../AGENTS.md) - Knowledge base format
