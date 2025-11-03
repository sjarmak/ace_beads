import {
  AceDelta,
  normalizeContent,
  generateDeltaHash,
  RejectedDelta,
} from './deltas.js';
import type { KnowledgeBullet } from './types.js';
import {
  parseKnowledgeBulletsWithProvenance,
  serializeBullets as serializeBulletsUtil,
} from './knowledge-utils.js';

export type { KnowledgeBullet };

export interface MergeResult {
  bullets: KnowledgeBullet[];
  accepted: string[];
  rejected: RejectedDelta[];
}

/**
 * Deterministic delta merger
 * 
 * Rules:
 * 1. Normalize content and compute hash (section::normalized)
 * 2. Deduplicate by hash
 * 3. If op=amend, replace existing; if op=add, skip duplicate
 * 4. Increment helpful/harmful counters from metadata
 * 5. Deprecate when harmful > helpful OR op=deprecate
 * 6. Sort: section asc → helpful desc → content asc
 */
export class DeltaMerger {
  private confidenceThreshold: number;

  constructor(confidenceThreshold: number = 0.80) {
    this.confidenceThreshold = confidenceThreshold;
  }

  merge(
    existing: KnowledgeBullet[],
    incoming: AceDelta[]
  ): MergeResult {
    const accepted: string[] = [];
    const rejected: RejectedDelta[] = [];
    const bulletMap = this.buildBulletMap(existing);

    for (const delta of incoming) {
      const validationError = this.validateDelta(delta);
      if (validationError) {
        rejected.push(validationError);
        continue;
      }

      const hash = generateDeltaHash(delta.section, delta.content);
      const existingBullet = bulletMap.get(hash);

      if (delta.op === 'deprecate') {
        this.processDeprecate(delta, existingBullet, bulletMap, accepted, rejected);
      } else if (delta.op === 'amend') {
        this.processAmend(delta, existingBullet, accepted, rejected);
      } else {
        this.processAdd(delta, hash, existingBullet, bulletMap, accepted, rejected);
      }
    }

    const bullets = this.filterAndSort(bulletMap);
    return { bullets, accepted, rejected };
  }

  private buildBulletMap(existing: KnowledgeBullet[]): Map<string, KnowledgeBullet> {
    const bulletMap = new Map<string, KnowledgeBullet>();
    for (const bullet of existing) {
      bulletMap.set(bullet.hash ?? generateDeltaHash(bullet.section, bullet.content), bullet);
    }
    return bulletMap;
  }

  private validateDelta(delta: AceDelta): RejectedDelta | null {
    if (delta.metadata.confidence < this.confidenceThreshold) {
      return {
        id: delta.id,
        reason: 'low-confidence',
        details: `confidence ${delta.metadata.confidence} < ${this.confidenceThreshold}`,
      };
    }

    if (delta.metadata.evidence.length < 8) {
      return {
        id: delta.id,
        reason: 'low-evidence',
        details: 'evidence too short',
      };
    }

    return null;
  }

  private processDeprecate(
    delta: AceDelta,
    existingBullet: KnowledgeBullet | undefined,
    bulletMap: Map<string, KnowledgeBullet>,
    accepted: string[],
    rejected: RejectedDelta[]
  ): void {
    const hash = generateDeltaHash(delta.section, delta.content);
    if (existingBullet) {
      bulletMap.delete(hash);
      accepted.push(delta.id);
    } else {
      rejected.push({
        id: delta.id,
        reason: 'invalid',
        details: 'deprecate target not found',
      });
    }
  }

  private processAmend(
    delta: AceDelta,
    existingBullet: KnowledgeBullet | undefined,
    accepted: string[],
    rejected: RejectedDelta[]
  ): void {
    if (!existingBullet) {
      rejected.push({
        id: delta.id,
        reason: 'invalid',
        details: 'amend target not found',
      });
      return;
    }

    existingBullet.content = delta.content;
    existingBullet.helpful += delta.metadata.helpful;
    existingBullet.harmful += delta.metadata.harmful;
    existingBullet.provenance = {
      deltaId: delta.id,
      beadsId: delta.metadata.source.beadsId,
      createdAt: delta.metadata.createdAt,
    };

    accepted.push(delta.id);
  }

  private processAdd(
    delta: AceDelta,
    hash: string,
    existingBullet: KnowledgeBullet | undefined,
    bulletMap: Map<string, KnowledgeBullet>,
    accepted: string[],
    rejected: RejectedDelta[]
  ): void {
    if (existingBullet) {
      rejected.push({
        id: delta.id,
        reason: 'duplicate',
        details: `hash collision with bullet ${existingBullet.id}`,
      });
      return;
    }

    const newBullet: KnowledgeBullet = {
      id: delta.id,
      section: delta.section,
      content: delta.content,
      helpful: delta.metadata.helpful,
      harmful: delta.metadata.harmful,
      hash,
      provenance: {
        deltaId: delta.id,
        beadsId: delta.metadata.source.beadsId,
        createdAt: delta.metadata.createdAt,
      },
    };

    bulletMap.set(hash, newBullet);
    accepted.push(delta.id);
  }

  private filterAndSort(bulletMap: Map<string, KnowledgeBullet>): KnowledgeBullet[] {
    const bullets = Array.from(bulletMap.values()).filter(
      (b) => b.harmful <= b.helpful
    );

    bullets.sort((a, b) => {
      if (a.section !== b.section) {
        return a.section.localeCompare(b.section);
      }
      if (a.helpful !== b.helpful) {
        return b.helpful - a.helpful;
      }
      return a.content.localeCompare(b.content);
    });

    return bullets;
  }

  /**
   * Parse existing AGENTS.md bullets
   * Expected format:
   * [Bullet #id, helpful:N, harmful:M] Content
   * <!-- deltaId=..., beadsId=..., createdAt=..., hash=... -->
   */
  parseBullets(markdown: string): KnowledgeBullet[] {
    return parseKnowledgeBulletsWithProvenance(markdown);
  }

  /**
   * Serialize bullets to AGENTS.md format
   */
  serializeBullets(bullets: KnowledgeBullet[]): string {
    return serializeBulletsUtil(bullets);
  }
}
