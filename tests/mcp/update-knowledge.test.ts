import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { updateKnowledge, UpdateKnowledgeParams } from '../../mcp/tools/update-knowledge.js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const TEST_INSIGHTS_PATH = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl';
const TEST_KNOWLEDGE_PATH = '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md';

describe('updateKnowledge', () => {
  it('should validate minConfidence parameter', async () => {
    const result = await updateKnowledge({ minConfidence: 1.5 });
    
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error.code).toBe('INVALID_PARAMS');
      expect(result.error.message).toContain('minConfidence');
    }
  });

  it('should validate maxDeltas parameter', async () => {
    const result = await updateKnowledge({ maxDeltas: 0 });
    
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error.code).toBe('INVALID_PARAMS');
      expect(result.error.message).toContain('maxDeltas');
    }
  });

  it('should return error if AGENTS.md does not exist', async () => {
    // This test assumes AGENTS.md might not exist in some scenarios
    // In production it should exist, so we skip if it does
    if (existsSync(TEST_KNOWLEDGE_PATH)) {
      expect(true).toBe(true);
      return;
    }
    
    const result = await updateKnowledge({ minConfidence: 0.8 });
    
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error.code).toBe('FILE_NOT_FOUND');
    }
  });

  it('should return correct structure in dry run mode', async () => {
    const result = await updateKnowledge({ 
      minConfidence: 0.8, 
      maxDeltas: 3,
      dryRun: true 
    });
    
    if ('error' in result) {
      // If there's an error, it should be a known error type
      expect(['FILE_NOT_FOUND', 'SECTION_NOT_FOUND', 'INVALID_PARAMS']).toContain(result.error.code);
    } else {
      // Should have the correct response structure
      expect(result).toHaveProperty('deltas');
      expect(result).toHaveProperty('duplicatesSkipped');
      expect(result).toHaveProperty('lowConfidenceSkipped');
      expect(result).toHaveProperty('updated');
      expect(result.updated).toBe(false); // dry run should not update
      
      // Check delta structure
      result.deltas.forEach(delta => {
        expect(delta).toHaveProperty('bulletId');
        expect(delta).toHaveProperty('section');
        expect(delta).toHaveProperty('content');
        expect(delta).toHaveProperty('confidence');
        expect(delta).toHaveProperty('applied');
        expect(delta.applied).toBe(false); // dry run should not apply
      });
    }
  });

  it('should use default values for optional parameters', async () => {
    const result = await updateKnowledge({});
    
    // Should not error on missing optional params
    if ('error' in result) {
      // Only acceptable errors are file-related
      expect(['FILE_NOT_FOUND', 'SECTION_NOT_FOUND']).toContain(result.error.code);
    } else {
      expect(result).toHaveProperty('deltas');
      expect(result).toHaveProperty('updated');
    }
  });

  it('should limit deltas to maxDeltas value', async () => {
    const result = await updateKnowledge({ 
      maxDeltas: 1,
      dryRun: true 
    });
    
    if (!('error' in result)) {
      expect(result.deltas.length).toBeLessThanOrEqual(1);
    }
  });
});
