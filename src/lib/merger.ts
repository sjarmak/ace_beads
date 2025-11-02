import {
  AceDelta,
  normalizeContent,
  generateDeltaHash,
  RejectedDelta,
} from './deltas.js';

export interface KnowledgeBullet {
  id: string;
  section: string;
  content: string;
  helpful: number;
  harmful: number;
  hash: string;
  provenance: {
    deltaId: string;
    beadsId: string;
    createdAt: string;
  };
}

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

  /**
   * Merge deltas into existing knowledge bullets
   */
  merge(
    existing: KnowledgeBullet[],
    incoming: AceDelta[]
  ): MergeResult {
    const accepted: string[] = [];
    const rejected: RejectedDelta[] = [];
    
    // Build hash map of existing bullets
    const bulletMap = new Map<string, KnowledgeBullet>();
    for (const bullet of existing) {
      bulletMap.set(bullet.hash, bullet);
    }

    // Process incoming deltas
    for (const delta of incoming) {
      // Validate confidence
      if (delta.metadata.confidence < this.confidenceThreshold) {
        rejected.push({
          id: delta.id,
          reason: 'low-confidence',
          details: `confidence ${delta.metadata.confidence} < ${this.confidenceThreshold}`,
        });
        continue;
      }

      // Validate evidence
      if (delta.metadata.evidence.length < 8) {
        rejected.push({
          id: delta.id,
          reason: 'low-evidence',
          details: 'evidence too short',
        });
        continue;
      }

      const hash = generateDeltaHash(delta.section, delta.content);
      const existingBullet = bulletMap.get(hash);

      // Handle different operations
      if (delta.op === 'deprecate') {
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
        continue;
      }

      if (delta.op === 'amend') {
        if (!existingBullet) {
          rejected.push({
            id: delta.id,
            reason: 'invalid',
            details: 'amend target not found',
          });
          continue;
        }

        // Replace content, increment counters
        existingBullet.content = delta.content;
        existingBullet.helpful += delta.metadata.helpful;
        existingBullet.harmful += delta.metadata.harmful;
        existingBullet.provenance = {
          deltaId: delta.id,
          beadsId: delta.metadata.source.beadsId,
          createdAt: delta.metadata.createdAt,
        };

        accepted.push(delta.id);
        continue;
      }

      // op === 'add'
      if (existingBullet) {
        rejected.push({
          id: delta.id,
          reason: 'duplicate',
          details: `hash collision with bullet ${existingBullet.id}`,
        });
        continue;
      }

      // Add new bullet
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

    // Filter deprecated bullets (harmful > helpful)
    const bullets = Array.from(bulletMap.values()).filter(
      (b) => b.harmful <= b.helpful
    );

    // Sort deterministically
    bullets.sort((a, b) => {
      // Section ascending
      if (a.section !== b.section) {
        return a.section.localeCompare(b.section);
      }
      // Helpful descending
      if (a.helpful !== b.helpful) {
        return b.helpful - a.helpful;
      }
      // Content ascending (for determinism)
      return a.content.localeCompare(b.content);
    });

    return { bullets, accepted, rejected };
  }

  /**
   * Parse existing AGENTS.md bullets
   * Expected format:
   * [Bullet #id, helpful:N, harmful:M] Content
   * <!-- deltaId=..., beadsId=..., createdAt=..., hash=... -->
   */
  parseBullets(markdown: string): KnowledgeBullet[] {
    const bullets: KnowledgeBullet[] = [];
    const lines = markdown.split('\n');
    let currentSection = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect section headers
      if (line.startsWith('## ')) {
        currentSection = line.slice(3).trim().toLowerCase().replace(/\s+/g, '/');
        continue;
      }

      // Parse bullet line
      const bulletMatch = line.match(/^\[Bullet #([^,]+), helpful:(\d+), harmful:(\d+)\] (.+)$/);
      if (!bulletMatch) continue;

      const [, id, helpfulStr, harmfulStr, content] = bulletMatch;
      const helpful = parseInt(helpfulStr, 10);
      const harmful = parseInt(harmfulStr, 10);

      // Try to parse provenance from next line (HTML comment)
      let provenance = {
        deltaId: id,
        beadsId: 'unknown',
        createdAt: new Date().toISOString(),
      };

      if (i + 1 < lines.length && lines[i + 1].startsWith('<!--')) {
        const comment = lines[i + 1];
        const deltaIdMatch = comment.match(/deltaId=([^,]+)/);
        const beadsIdMatch = comment.match(/beadsId=([^,]+)/);
        const createdAtMatch = comment.match(/createdAt=([^,]+)/);

        if (deltaIdMatch) provenance.deltaId = deltaIdMatch[1].trim();
        if (beadsIdMatch) provenance.beadsId = beadsIdMatch[1].trim();
        if (createdAtMatch) provenance.createdAt = createdAtMatch[1].trim();
      }

      const hash = generateDeltaHash(currentSection, content);

      bullets.push({
        id,
        section: currentSection,
        content,
        helpful,
        harmful,
        hash,
        provenance,
      });
    }

    return bullets;
  }

  /**
   * Serialize bullets to AGENTS.md format
   */
  serializeBullets(bullets: KnowledgeBullet[]): string {
    // Group by section
    const sections = new Map<string, KnowledgeBullet[]>();
    for (const bullet of bullets) {
      if (!sections.has(bullet.section)) {
        sections.set(bullet.section, []);
      }
      sections.get(bullet.section)!.push(bullet);
    }

    // Sort sections alphabetically
    const sortedSections = Array.from(sections.keys()).sort();

    const lines: string[] = [];

    for (const section of sortedSections) {
      const sectionBullets = sections.get(section)!;
      
      // Section header
      lines.push(`## ${section.replace(/\//g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`);
      lines.push('');

      // Bullets
      for (const bullet of sectionBullets) {
        lines.push(
          `[Bullet #${bullet.id}, helpful:${bullet.helpful}, harmful:${bullet.harmful}] ${bullet.content}`
        );
        lines.push(
          `<!-- deltaId=${bullet.provenance.deltaId}, beadsId=${bullet.provenance.beadsId}, createdAt=${bullet.provenance.createdAt}, hash=${bullet.hash} -->`
        );
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
