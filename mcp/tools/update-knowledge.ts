import { Curator, CuratorDelta } from '../../agents/Curator.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export interface UpdateKnowledgeParams {
  minConfidence?: number;
  maxDeltas?: number;
  dryRun?: boolean;
  forceInsightIds?: string[];
}

export interface UpdateKnowledgeResponse {
  deltas: Array<{
    bulletId: string;
    section: string;
    content: string;
    confidence: number;
    applied: boolean;
  }>;
  duplicatesSkipped: number;
  lowConfidenceSkipped: number;
  updated: boolean;
}

export interface UpdateKnowledgeError {
  error: {
    code: 'FILE_NOT_FOUND' | 'SECTION_NOT_FOUND' | 'WRITE_ERROR' | 'INVALID_PARAMS';
    message: string;
    details?: any;
  };
}

/**
 * ACE Update Knowledge Tool
 * 
 * Processes insights from the Reflector and applies them as delta updates to AGENTS.md.
 * Handles deduplication, section routing, and bullet formatting with helpfulness counters.
 */
export async function updateKnowledge(
  params: UpdateKnowledgeParams
): Promise<UpdateKnowledgeResponse | UpdateKnowledgeError> {
  try {
    // Validate params
    const minConfidence = params.minConfidence ?? 0.8;
    const maxDeltas = params.maxDeltas ?? 3;
    const dryRun = params.dryRun ?? false;
    const forceInsightIds = params.forceInsightIds ?? [];

    if (minConfidence < 0 || minConfidence > 1) {
      return {
        error: {
          code: 'INVALID_PARAMS',
          message: 'minConfidence must be between 0.0 and 1.0',
          details: { minConfidence }
        }
      };
    }

    if (maxDeltas < 1) {
      return {
        error: {
          code: 'INVALID_PARAMS',
          message: 'maxDeltas must be at least 1',
          details: { maxDeltas }
        }
      };
    }

    // Check if required files exist
    const insightsPath = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl';
    const knowledgePath = '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md';

    if (!existsSync(knowledgePath)) {
      return {
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'AGENTS.md not found',
          details: { path: knowledgePath }
        }
      };
    }

    // Initialize Curator
    const curator = new Curator(insightsPath, knowledgePath, maxDeltas);

    // Load insights to calculate statistics
    const allInsights = await loadInsights(insightsPath);
    const lowConfidenceCount = allInsights.filter(
      i => i.confidence < minConfidence && !forceInsightIds.includes(i.id)
    ).length;

    // In dry run mode, we need to generate deltas without writing
    let deltas: CuratorDelta[];
    
    if (dryRun) {
      // Generate deltas without applying them
      deltas = await curator.processInsights(minConfidence);
      // Since we didn't actually write, mark as not applied
      const response: UpdateKnowledgeResponse = {
        deltas: deltas.map(delta => ({
          bulletId: delta.bullet_id,
          section: delta.section,
          content: delta.content,
          confidence: delta.confidence,
          applied: false
        })),
        duplicatesSkipped: calculateDuplicates(allInsights, deltas),
        lowConfidenceSkipped: lowConfidenceCount,
        updated: false
      };
      return response;
    }

    // Normal mode - process and apply deltas
    try {
      deltas = await curator.processInsights(minConfidence);
    } catch (error: any) {
      if (error.message?.includes('Section')) {
        return {
          error: {
            code: 'SECTION_NOT_FOUND',
            message: 'Required section not found in AGENTS.md',
            details: { error: error.message }
          }
        };
      }
      throw error;
    }

    const response: UpdateKnowledgeResponse = {
      deltas: deltas.map(delta => ({
        bulletId: delta.bullet_id,
        section: delta.section,
        content: delta.content,
        confidence: delta.confidence,
        applied: true
      })),
      duplicatesSkipped: calculateDuplicates(allInsights, deltas),
      lowConfidenceSkipped: lowConfidenceCount,
      updated: deltas.length > 0
    };

    return response;

  } catch (error: any) {
    // Handle write errors
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return {
        error: {
          code: 'WRITE_ERROR',
          message: 'Failed to write to AGENTS.md',
          details: { error: error.message }
        }
      };
    }

    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Load insights from JSONL file
 */
async function loadInsights(path: string): Promise<any[]> {
  try {
    const content = await readFile(path, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * Calculate number of duplicate patterns that were skipped
 */
function calculateDuplicates(allInsights: any[], deltas: CuratorDelta[]): number {
  const deltaPatterns = new Set(deltas.map(d => 
    d.content.toLowerCase().replace(/\s+/g, ' ').trim()
  ));
  
  const allPatterns = allInsights.map(i => 
    i.signal?.pattern?.toLowerCase().replace(/\s+/g, ' ').trim()
  ).filter(Boolean);
  
  // Count how many insights had patterns similar to what was included
  const duplicateCount = allPatterns.filter(pattern => {
    // Check if this pattern matches any delta pattern
    return Array.from(deltaPatterns).some(deltaPattern => 
      pattern.includes(deltaPattern.substring(0, 20)) || 
      deltaPattern.includes(pattern.substring(0, 20))
    );
  }).length - deltas.length; // Subtract the actual deltas applied
  
  return Math.max(0, duplicateCount);
}
