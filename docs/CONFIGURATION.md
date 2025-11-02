# ACE Configuration

ACE supports flexible configuration through multiple sources with a clear precedence order.

## Configuration Precedence

Configuration is loaded in the following order (later sources override earlier ones):

1. **Defaults** - Built-in defaults
2. **User config** - `~/.config/ace/config.json` (global settings)
3. **Project config** - `.ace.json` in project root (project-specific)
4. **Environment variables** - `ACE_*` prefixed variables
5. **CLI flags** - Command-line arguments (highest priority)

## Configuration Options

```json
{
  "agentsPath": "AGENTS.md",
  "logsDir": "logs",
  "insightsPath": "logs/insights.jsonl",
  "tracesPath": "logs/execution_traces.jsonl",
  "maxDeltas": 3,
  "defaultConfidence": 0.8
}
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentsPath` | string | `"AGENTS.md"` | Path to AGENTS.md knowledge file |
| `logsDir` | string | `"logs"` | Directory for ACE logs |
| `insightsPath` | string | `"logs/insights.jsonl"` | Path to insights JSONL |
| `tracesPath` | string | `"logs/execution_traces.jsonl"` | Path to execution traces JSONL |
| `maxDeltas` | number | `3` | Max knowledge updates per session |
| `defaultConfidence` | number | `0.8` | Default confidence threshold (0-1) |

## Usage Examples

### Project-Specific Config

Create `.ace.json` in your project root:

```json
{
  "maxDeltas": 5,
  "defaultConfidence": 0.9,
  "agentsPath": "docs/AGENT_GUIDE.md"
}
```

**Note**: `.ace.json` is git-ignored by default. Use `.ace.json.example` to share template configurations.

### Global User Config

Create `~/.config/ace/config.json`:

```json
{
  "defaultConfidence": 0.85,
  "maxDeltas": 4
}
```

This applies to all ACE projects unless overridden.

### Environment Variables

```bash
export ACE_AGENTS_PATH="docs/AGENTS.md"
export ACE_MAX_DELTAS=5
export ACE_CONFIDENCE=0.9
```

### CLI Flags

```bash
ace init --agents custom-agents.md --logs-dir my-logs
ace update --max-deltas 5 --min-confidence 0.9
```

## Complete Precedence Example

Given:
- Default `maxDeltas`: 3
- User config (`~/.config/ace/config.json`): `maxDeltas: 4`
- Project config (`.ace.json`): `maxDeltas: 5`
- Environment: `ACE_MAX_DELTAS=6`
- CLI flag: `--max-deltas 7`

Result: `maxDeltas = 7` (CLI flag wins)

## Validation

ACE validates configuration on load:

- `maxDeltas` must be ≥ 1
- `defaultConfidence` must be between 0 and 1

Invalid configs will show warnings but use the closest valid value.

## Tips

1. **Project config** (`.ace.json`) - Use for team-specific settings
2. **User config** (`~/.config/ace/config.json`) - Use for personal preferences
3. **Environment variables** - Use for CI/CD or temporary overrides
4. **CLI flags** - Use for one-off command customization

## Example Workflows

### Stricter Learning in Production

`.ace.json`:
```json
{
  "defaultConfidence": 0.95,
  "maxDeltas": 1
}
```

### Relaxed Learning in Development

```bash
ace learn --min-confidence 0.7 --max-deltas 10
```

### Custom Knowledge Location

```json
{
  "agentsPath": "knowledge/AGENTS.md",
  "logsDir": ".ace-logs"
}
```
