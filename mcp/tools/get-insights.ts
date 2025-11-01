import { readFile } from 'fs/promises';
import { Insight } from '../types.js';

export interface GetInsightsParams {
  source: 'insights' | 'bullets' | 'both';
  filters?: {
    minConfidence?: number;
    tags?: string[];
    sections?: string[];
    beadIds?: string[];
    after?: string;
    before?: string;
  };
  limit?: number;
  sortBy?: 'confidence' | 'timestamp' | 'helpful';
}

export interface BulletResult {
  id: string;
  content: string;
  helpful: number;
  harmful: number;
  section: string;
  score: number;
}

export interface InsightResult {
  id: string;
  timestamp: string;
  taskId: string;
  recommendation: string;
  confidence: number;
  onlineEligible: boolean;
  metaTags: string[];
}

export interface GetInsightsResponse {
  insights?: InsightResult[];
  bullets?: BulletResult[];
  totalMatched: number;
  filtered: boolean;
}

export interface GetInsightsError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export async function getInsights(
  params: GetInsightsParams
): Promise<GetInsightsResponse | GetInsightsError> {
  try {
    // Validate parameters
    if (!params.source) {
      return {
        error: {
          code: 'INVALID_PARAMS',
          message: 'source is required and must be "insights", "bullets", or "both"',
        },
      };
    }

    const limit = params.limit ?? 50;
    const filtered = !!(params.filters && Object.keys(params.filters).length > 0);
    
    const response: GetInsightsResponse = {
      totalMatched: 0,
      filtered,
    };

    // Query insights if requested
    if (params.source === 'insights' || params.source === 'both') {
      try {
        const insights = await queryInsights(params.filters, params.sortBy, limit);
        response.insights = insights.results;
        response.totalMatched += insights.total;
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('ENOENT')) {
          return {
            error: {
              code: 'FILE_NOT_FOUND',
              message: 'insights.jsonl not found at /Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
              details: err,
            },
          };
        }
        throw error;
      }
    }

    // Query bullets if requested
    if (params.source === 'bullets' || params.source === 'both') {
      try {
        const bullets = await queryBullets(params.filters, params.sortBy, limit);
        response.bullets = bullets.results;
        response.totalMatched += bullets.total;
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('ENOENT')) {
          return {
            error: {
              code: 'FILE_NOT_FOUND',
              message: 'AGENTS.md not found at /Users/sjarmak/ACE_Beads_Amp/AGENTS.md',
              details: err,
            },
          };
        }
        throw error;
      }
    }

    return response;
  } catch (error) {
    const err = error as Error;

    if (err.message.includes('not found') || err.message.includes('ENOENT')) {
      return {
        error: {
          code: 'FILE_NOT_FOUND',
          message: err.message,
          details: err,
        },
      };
    }

    if (err.message.includes('parse') || err.message.includes('JSON')) {
      return {
        error: {
          code: 'PARSE_ERROR',
          message: err.message,
          details: err,
        },
      };
    }

    return {
      error: {
        code: 'INVALID_PARAMS',
        message: err.message,
        details: err,
      },
    };
  }
}

async function queryInsights(
  filters?: GetInsightsParams['filters'],
  sortBy?: 'confidence' | 'timestamp' | 'helpful',
  limit?: number
): Promise<{ results: InsightResult[]; total: number }> {
  const insightsPath = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl';
  const content = await readFile(insightsPath, 'utf-8');
  
  const lines = content.trim().split('\n').filter(line => line.length > 0);
  let insights: Insight[] = [];

  for (const line of lines) {
    try {
      const insight = JSON.parse(line) as Insight;
      insights.push(insight);
    } catch (error) {
      console.warn(`[get-insights] Failed to parse insight line: ${line.substring(0, 50)}...`);
    }
  }

  // Apply filters
  let filtered = insights;

  // Time range filters
  if (filters?.after) {
    const afterDate = new Date(filters.after);
    filtered = filtered.filter(i => new Date(i.timestamp) > afterDate);
  }

  if (filters?.before) {
    const beforeDate = new Date(filters.before);
    filtered = filtered.filter(i => new Date(i.timestamp) < beforeDate);
  }

  // Confidence filter
  if (filters?.minConfidence !== undefined) {
    filtered = filtered.filter(i => i.confidence >= filters.minConfidence!);
  }

  // Tags filter (OR logic)
  if (filters?.tags && filters.tags.length > 0) {
    filtered = filtered.filter(i => 
      i.metaTags.some(tag => filters.tags!.includes(tag))
    );
  }

  // BeadIds filter
  if (filters?.beadIds && filters.beadIds.length > 0) {
    filtered = filtered.filter(i => {
      const relatedBeads = [i.taskId, ...(i.source.beadIds || [])];
      return filters.beadIds!.some(beadId => relatedBeads.includes(beadId));
    });
  }

  const total = filtered.length;

  // Sort
  if (sortBy === 'confidence') {
    filtered.sort((a, b) => b.confidence - a.confidence);
  } else if (sortBy === 'timestamp') {
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  // Note: 'helpful' sort not applicable to insights

  // Apply limit
  if (limit !== undefined) {
    filtered = filtered.slice(0, limit);
  }

  // Convert to result format
  const results: InsightResult[] = filtered.map(i => ({
    id: i.id,
    timestamp: i.timestamp,
    taskId: i.taskId,
    recommendation: i.recommendation,
    confidence: i.confidence,
    onlineEligible: i.onlineEligible,
    metaTags: i.metaTags,
  }));

  return { results, total };
}

async function queryBullets(
  filters?: GetInsightsParams['filters'],
  sortBy?: 'confidence' | 'timestamp' | 'helpful',
  limit?: number
): Promise<{ results: BulletResult[]; total: number }> {
  const agentsPath = '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md';
  const content = await readFile(agentsPath, 'utf-8');
  
  // Parse bullets using the same regex as Generator.loadKnowledgeBullets()
  const bulletRegex = /\[Bullet #(\S+), helpful:(\d+), harmful:(\d+)\] (.+)/g;
  const bullets: BulletResult[] = [];

  // Extract section information
  const sectionRegex = /^###\s+(.+)$/gm;
  const sections: { name: string; startIndex: number }[] = [];
  let match;

  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push({
      name: match[1],
      startIndex: match.index,
    });
  }

  // Parse bullets with section context
  bulletRegex.lastIndex = 0;
  while ((match = bulletRegex.exec(content)) !== null) {
    const bulletIndex = match.index;
    
    // Find which section this bullet belongs to
    let section = 'Unknown';
    for (let i = sections.length - 1; i >= 0; i--) {
      if (sections[i].startIndex < bulletIndex) {
        section = sections[i].name;
        break;
      }
    }

    const helpful = parseInt(match[2]);
    const harmful = parseInt(match[3]);

    bullets.push({
      id: match[1],
      helpful,
      harmful,
      content: match[4],
      section,
      score: helpful - harmful,
    });
  }

  // Apply filters
  let filtered = bullets;

  // Note: Time range filters not applicable to bullets
  // Note: Confidence filter not applicable to bullets

  // Sections filter (OR logic)
  if (filters?.sections && filters.sections.length > 0) {
    filtered = filtered.filter(b => 
      filters.sections!.includes(b.section)
    );
  }

  // Note: Tags filter not applicable to bullets
  // Note: BeadIds filter not applicable to bullets

  const total = filtered.length;

  // Sort
  if (sortBy === 'helpful') {
    filtered.sort((a, b) => b.score - a.score);
  }
  // Note: 'confidence' and 'timestamp' sort not applicable to bullets

  // Apply limit
  if (limit !== undefined) {
    filtered = filtered.slice(0, limit);
  }

  return { results: filtered, total };
}
