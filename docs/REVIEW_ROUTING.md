# Review Routing Configuration

ACE's Review Routing system allows you to configure where reviews and insights are sent based on different event types.

## Overview

The review routing system supports four destinations:
- **bd-comment**: Post reviews as comments on beads (via `bd comment`)
- **new-bead**: Create new beads for review items
- **file**: Write reviews to a log file (default: `logs/reviews.jsonl`)
- **none**: Disable reviews for this event type

## Event Types

Reviews can be configured for the following events:

| Event Type | Description | Default Destination |
|------------|-------------|---------------------|
| `onBeadCreated` | When a new bead is created | `none` |
| `onBeadUpdated` | When a bead status changes | `none` |
| `onBeadClosed` | When a bead is closed (execution trace analysis) | `file` |
| `onFileChanged` | When tracked files change | `none` |
| `onKnowledgeReview` | Knowledge base reviews (duplicates, archival) | `file` |

## Configuration

### Setup

Create `.ace/review-config.json` in your project root:

```json
{
  "onBeadCreated": "none",
  "onBeadUpdated": "none",
  "onBeadClosed": "file",
  "onFileChanged": "none",
  "onKnowledgeReview": "file",
  "reviewFilePath": "logs/reviews.jsonl",
  "reviewBeadPrefix": "[Review]"
}
```

### Initialize Default Config

```bash
node -e "import('./dist/src/review-config-loader.js').then(m => new m.ReviewConfigLoader().init())"
```

### Custom Configuration Examples

**Route execution reviews to bd comments:**
```json
{
  "onBeadClosed": "bd-comment"
}
```

**Create review beads for knowledge issues:**
```json
{
  "onKnowledgeReview": "new-bead",
  "reviewBeadPrefix": "[ACE Review]"
}
```

**Disable all reviews:**
```json
{
  "onBeadCreated": "none",
  "onBeadUpdated": "none",
  "onBeadClosed": "none",
  "onFileChanged": "none",
  "onKnowledgeReview": "none"
}
```

**Custom review file location:**
```json
{
  "onBeadClosed": "file",
  "reviewFilePath": ".ace/reviews/execution-traces.jsonl"
}
```

## Review File Format

When using `file` destination, reviews are written as JSONL:

```jsonl
{"type":"bead_closed","timestamp":"2025-11-01T16:00:00.000Z","data":{"issue":{...},"insights":[...]}}
{"type":"bead_created","timestamp":"2025-11-01T16:01:00.000Z","data":{"issue":{...}}}
```

Each line contains:
- `type`: Review event type (`bead_closed`, `bead_created`, `bead_updated`)
- `timestamp`: ISO 8601 timestamp
- `data`: Event-specific data (bead info, insights, etc.)

## Implementation Status

| Destination | Status |
|-------------|--------|
| `file` | ✅ Implemented |
| `bd-comment` | ⚠️ Planned |
| `new-bead` | ⚠️ Planned |
| `none` | ✅ Implemented |

## Programmatic Usage

```typescript
import { ReviewRouter } from './src/review-routing.js';
import { ReviewConfigLoader } from './src/review-config-loader.js';

// Load config from file
const loader = new ReviewConfigLoader();
const config = await loader.load();

// Create router
const router = new ReviewRouter(config);

// Check destination for event
const dest = router.getDestination('onBeadClosed');

// Update config dynamically
router.updateConfig({ onBeadClosed: 'new-bead' });

// Save config
await loader.save(router.getConfig());
```

## Integration

The review routing system is automatically integrated into:

- **BeadsEventBridge**: Routes reviews for bead lifecycle events
- **Curator**: Can be extended to route knowledge reviews
- **Reflector**: Insights from execution trace analysis

## Future Enhancements

- [ ] Implement bd-comment destination
- [ ] Implement new-bead destination with customizable templates
- [ ] Add webhook destination for external integrations
- [ ] Support multiple destinations per event (e.g., both file + bd-comment)
- [ ] Add filtering rules (only route high-confidence insights, etc.)
- [ ] Add review templates and formatting options
