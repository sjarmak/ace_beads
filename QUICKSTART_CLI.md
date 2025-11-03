# ACE Pure-CLI Quick Start

Get started with the ACE learning loop in 5 minutes.

## Prerequisites

- Node.js ≥ 20
- Git installed
- Beads CLI (`bd`) on PATH (optional but recommended)

## Installation

```bash
# Clone the repo
git clone https://github.com/sjarmak/ace_beads.git
cd ace_beads

# Install dependencies
npm install

# Build
npm run build

# Link CLI globally (optional)
npm link
```

## First-Time Setup

```bash
# Initialize ACE workspace
ace init

# Verify installation
ace doctor
```

Expected output:
```
✅ ACE config: Configuration loaded successfully
✅ Beads DB: .beads directory exists
✅ Knowledge dir: knowledge/ exists
✅ AGENTS.md: Found
✅ playbook.yaml: Found
✅ Delta queue: 0 delta(s) queued
✅ Git: Git available
```

## Basic Workflow

### 1. Work on a Task

```bash
# Start a coding task
npm run build  # or whatever fails
```

### 2. Create a Bead (if using Beads CLI)

```bash
# Track the failure
bd create "Fix TypeScript import error" --labels ace,reflect

# Output: bd-123
```

### 3. Capture the Failure (Optional)

```bash
# If you have execution logs
cat > errors.json << 'EOF'
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

ace capture --bead bd-123 --exec errors.json --outcome failure
```

### 4. Fix the Issue

```bash
# Make code changes
# ... edit files ...

# Verify fix
npm run build  # passes
```

### 5. Close the Bead

```bash
bd close bd-123 --reason "Fixed import extensions"
```

### 6. Run Learning

```bash
# Analyze the bead and learn from it
ace learn --beads bd-123

# Or learn from all recent labeled beads
ace learn
```

### 7. Review What Was Learned

```bash
# Check status
ace status

# List pending deltas
ace delta ls

# Show delta details
ace delta show <id>
```

### 8. Apply to Knowledge Base

```bash
# Dry-run first (preview)
ace apply --dry-run

# Apply for real
ace apply
```

This creates a git commit on the `ace/curations` branch with updated AGENTS.md.

## Advanced Usage

### Offline Learning (Sweep)

Learn from historical beads in bulk:

```bash
# Sweep a range
ace learn --beads bd-100,bd-101,bd-102

# Sweep all closed beads with ace labels
ace learn --beads <bead-ids>
```

### Queue Management

```bash
# List all deltas
ace delta ls --json

# Remove unwanted deltas
ace delta rm <id1> <id2>

# Clear entire queue
echo "[]" > .ace/delta-queue.json
```

### Custom Confidence Threshold

```bash
# Only accept high-confidence insights
ace learn --min-confidence 0.9

# Allow lower confidence
ace learn --min-confidence 0.7
```

### Apply Specific Deltas

```bash
# Apply only certain deltas
ace apply --id delta-id-1 delta-id-2

# Skip git operations
ace apply --no-branch
```

## Configuration

Edit `.ace/config.json`:

```json
{
  "learning": {
    "confidenceMin": 0.80,
    "maxDeltasPerSession": 3
  },
  "beads": {
    "labels": ["ace", "reflect"]
  }
}
```

## Without Beads CLI

You can still use ACE without Beads:

```bash
# Capture traces manually
ace capture --bead task-123 --exec errors.json

# Analyze specific traces
ace analyze batch --beads task-123,task-456

# Apply insights
ace learn --min-confidence 0.8
```

## Troubleshooting

### "bd command not found"

Install Beads:
```bash
curl -fsSL https://github.com/steveyegge/beads/install.sh | bash
export PATH="$HOME/.beads/bin:$PATH"
```

Or work without Beads (see above).

### "No deltas to apply"

This means no insights met the confidence threshold. Try:
```bash
# Lower threshold
ace learn --min-confidence 0.7

# Check what insights exist
ace get insights --json

# Review rejected deltas
ace learn --dry-run --json | jq '.rejected'
```

### "Write scope violation"

The Curator tried to write outside `knowledge/` or `prompts/`. This is a bug. File an issue.

### "Delta queue corrupted"

```bash
# Clear queue and start fresh
echo "[]" > .ace/delta-queue.json
```

## Next Steps

- Read [CLI_LOOP.md](docs/CLI_LOOP.md) for detailed documentation
- Check [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for Amp integration
- Review [ACE_CLI_INTEGRATION.md](ACE_CLI_INTEGRATION.md) for architecture

## Examples

### Example 1: Simple Failure → Learning

```bash
# 1. Code fails
npm test
# Error: "import './auth' should be './auth.js'"

# 2. Create bead
bd create "Fix ESM import" --labels ace,reflect
# Output: bd-789

# 3. Fix it
sed -i "s/import '.\/auth'/import '.\/auth.js'/g" src/index.ts

# 4. Verify
npm test  # passes

# 5. Close and learn
bd close bd-789 --reason "Added .js extension"
ace learn --beads bd-789

# 6. Apply
ace apply
```

Result: AGENTS.md now has a bullet about ESM import extensions.

### Example 2: Batch Sweep

```bash
# Analyze last 50 closed beads
ace learn --beads <bead-ids> --range bd-200..bd-250

# Review insights
ace delta ls

# Apply top 3
ace apply --dry-run
ace apply
```

### Example 3: Review Mode

```bash
# See what would be learned without applying
ace review --beads bd-100,bd-101,bd-102

# Preview specific delta
ace delta show abc123

# Decide to skip
ace delta rm abc123

# Apply the rest
ace apply
```

## Tips

1. **Label consistently**: Always use `ace,reflect` labels on beads
2. **Review before applying**: Use `--dry-run` to preview changes
3. **Check status often**: `ace status` shows queue size
4. **Doctor regularly**: `ace doctor` catches config issues
5. **Commit carefully**: Review git diffs before pushing `ace/curations` branch

## Quick Reference

| What | Command |
|------|---------|
| Setup | `ace init` |
| Health check | `ace doctor` |
| System status | `ace status` |
| Learn from beads | `ace learn` |
| Preview learning | `ace review` |
| Apply deltas | `ace apply` |
| List queue | `ace delta ls` |
| Offline sweep | `ace learn --beads <bead-ids>` |

## Support

- GitHub: https://github.com/sjarmak/ace_beads/issues
- Docs: [docs/CLI_LOOP.md](docs/CLI_LOOP.md)

---

**Happy Learning!** 🎓
