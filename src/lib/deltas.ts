import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { z } from 'zod';

export const DeltaOpSchema = z.enum(['add', 'amend', 'deprecate']);

export const DeltaMetadataSchema = z.object({
  source: z.object({
    beadsId: z.string(),
    commit: z.string().optional(),
    files: z.array(z.string()).optional(),
    runId: z.string().optional(),
  }),
  confidence: z.number().min(0).max(1),
  helpful: z.number().int().min(0).default(0),
  harmful: z.number().int().min(0).default(0),
  tags: z.array(z.string()),
  scope: z.array(z.string()).optional(),
  evidence: z.string().min(8),
  createdAt: z.string().datetime(),
});

export const AceDeltaSchema = z.object({
  id: z.string().uuid(),
  section: z.string().regex(/^[a-z0-9._/-]+$/),
  op: DeltaOpSchema,
  content: z.string().min(8),
  metadata: DeltaMetadataSchema,
});

export type AceDelta = z.infer<typeof AceDeltaSchema>;
export type DeltaOp = z.infer<typeof DeltaOpSchema>;
export type DeltaMetadata = z.infer<typeof DeltaMetadataSchema>;

/**
 * Normalize content for deduplication
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Lowercase for comparison
 */
export function normalizeContent(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Generate deterministic hash for deduplication
 * Format: ${section}::${normalizedContent}
 */
export function generateDeltaHash(section: string, content: string): string {
  const normalized = normalizeContent(content);
  return `${section}::${normalized}`;
}

/**
 * Generate SHA-256 hash for content integrity
 */
export function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Validate delta against schema
 */
export function validateDelta(delta: unknown): AceDelta {
  return AceDeltaSchema.parse(delta);
}

/**
 * Validate array of deltas
 */
export function validateDeltas(deltas: unknown[]): AceDelta[] {
  return deltas.map(validateDelta);
}

/**
 * Delta queue operations
 */
export class DeltaQueue {
  constructor(private queuePath: string) {}

  async read(): Promise<AceDelta[]> {
    try {
      const content = await readFile(this.queuePath, 'utf-8');
      const data = JSON.parse(content);
      return validateDeltas(Array.isArray(data) ? data : []);
    } catch {
      return [];
    }
  }

  async write(deltas: AceDelta[]): Promise<void> {
    const validated = validateDeltas(deltas);
    // Sort for determinism: section asc, createdAt asc
    validated.sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.metadata.createdAt.localeCompare(b.metadata.createdAt);
    });
    await writeFile(this.queuePath, JSON.stringify(validated, null, 2), 'utf-8');
  }

  async enqueue(deltas: AceDelta[]): Promise<void> {
    const existing = await this.read();
    const combined = [...existing, ...deltas];
    await this.write(combined);
  }

  async dequeue(ids: string[]): Promise<void> {
    const existing = await this.read();
    const filtered = existing.filter((d) => !ids.includes(d.id));
    await this.write(filtered);
  }

  async clear(): Promise<void> {
    await this.write([]);
  }
}

/**
 * Rejected delta with reason
 */
export interface RejectedDelta {
  id: string;
  reason: 'duplicate' | 'low-evidence' | 'low-confidence' | 'invalid' | 'harmful';
  details?: string;
}

/**
 * Delta statistics
 */
export interface DeltaStats {
  total: number;
  accepted: number;
  rejected: number;
  bySection: Record<string, number>;
  avgConfidence: number;
}

export function computeDeltaStats(
  accepted: AceDelta[],
  rejected: RejectedDelta[]
): DeltaStats {
  const total = accepted.length + rejected.length;
  const bySection: Record<string, number> = {};
  
  for (const delta of accepted) {
    bySection[delta.section] = (bySection[delta.section] || 0) + 1;
  }

  const avgConfidence = accepted.length > 0
    ? accepted.reduce((sum, d) => sum + d.metadata.confidence, 0) / accepted.length
    : 0;

  return {
    total,
    accepted: accepted.length,
    rejected: rejected.length,
    bySection,
    avgConfidence,
  };
}
