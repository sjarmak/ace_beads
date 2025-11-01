# ace_update_knowledge Tool Implementation

## Overview
Implemented the `ace_update_knowledge` MCP tool that wraps the Curator agent logic for updating AGENTS.md with learned patterns.

## Files Created
- `mcp/tools/update-knowledge.ts` - Main implementation
- `tests/mcp/update-knowledge.test.ts` - Test suite

## Implementation Details

### Function Signature
```typescript
async function updateKnowledge(
  params: UpdateKnowledgeParams
): Promise<UpdateKnowledgeResponse | UpdateKnowledgeError>
```

### Parameters (UpdateKnowledgeParams)
- `minConfidence?: number` - Minimum confidence threshold (default: 0.8, range: 0-1)
- `maxDeltas?: number` - Max updates per session (default: 3, min: 1)
- `dryRun?: boolean` - Preview changes without writing (default: false)
- `forceInsightIds?: string[]` - Force process specific insights (not fully implemented)

### Response Structure (UpdateKnowledgeResponse)
```typescript
{
  deltas: Array<{
    bulletId: string;      // 8-character hex ID
    section: string;       // Target section in AGENTS.md
    content: string;       // Full bullet text
    confidence: number;    // Insight confidence
    applied: boolean;      // Whether written (false in dryRun)
  }>;
  duplicatesSkipped: number;    // Count of duplicate patterns
  lowConfidenceSkipped: number; // Count below threshold
  updated: boolean;             // Whether AGENTS.md was modified
}
```

### Error Handling
Returns structured errors with codes:
- `INVALID_PARAMS` - Invalid parameter values (confidence out of range, maxDeltas < 1)
- `FILE_NOT_FOUND` - AGENTS.md missing
- `SECTION_NOT_FOUND` - Target section missing in AGENTS.md
- `WRITE_ERROR` - Failed to write to file (permission issues)

## Key Features

1. **Parameter Validation**
   - Validates minConfidence is between 0 and 1
   - Validates maxDeltas is at least 1
   - Provides helpful error messages

2. **Curator Integration**
   - Initializes Curator with correct paths:
     - Insights: `/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl`
     - Knowledge: `/Users/sjarmak/ACE_Beads_Amp/AGENTS.md`
   - Calls `processInsights(minConfidence)` to generate and apply deltas
   - Respects maxDeltas limit

3. **Dry Run Mode**
   - Generates deltas without writing to AGENTS.md
   - Returns `applied: false` for all deltas
   - Returns `updated: false`
   - Useful for previewing changes

4. **Statistics Calculation**
   - Counts low-confidence insights that were skipped
   - Estimates duplicate patterns that were deduplicated
   - Provides visibility into what was and wasn't applied

5. **Section Routing**
   - Curator determines section based on insight metaTags:
     - TypeScript/type errors → "TypeScript Patterns"
     - Build/test errors → "Build & Test Patterns"
     - Discovery chains → "Dependency Patterns"
     - High-level patterns → "Architecture Patterns"

## Usage Example

```typescript
// Normal mode - apply deltas
const result = await updateKnowledge({
  minConfidence: 0.8,
  maxDeltas: 3
});

// Dry run - preview changes
const preview = await updateKnowledge({
  minConfidence: 0.7,
  maxDeltas: 5,
  dryRun: true
});

// Handle errors
if ('error' in result) {
  console.error(`Error: ${result.error.code} - ${result.error.message}`);
} else {
  console.log(`Applied ${result.deltas.length} deltas`);
  console.log(`Skipped ${result.lowConfidenceSkipped} low-confidence insights`);
}
```

## Testing
Created comprehensive test suite covering:
- Parameter validation (minConfidence, maxDeltas)
- Error scenarios (missing files)
- Dry run mode behavior
- Default parameter handling
- Delta limiting

## Alignment with Design
Fully implements the specification from `mcp/ACE_MCP_DESIGN.md`:
- ✅ Correct parameter types and defaults
- ✅ Correct response structure
- ✅ All specified error codes
- ✅ Dry run mode support
- ✅ Curator integration with processInsights()
- ✅ Section routing via Curator logic
- ✅ Proper TypeScript typing

## Next Steps for MCP Integration
When integrating into the MCP server:
1. Import the `updateKnowledge` function
2. Register as MCP tool handler for `ace_update_knowledge`
3. Map MCP parameters to UpdateKnowledgeParams
4. Return UpdateKnowledgeResponse or UpdateKnowledgeError
5. Add to server tool list in package.json entry point

## Notes
- The `forceInsightIds` parameter is accepted but not fully utilized (Curator doesn't support forcing specific insights yet)
- Duplicate calculation is heuristic-based (pattern similarity matching)
- All file paths are absolute as specified in design
- TypeScript compilation verified successfully
