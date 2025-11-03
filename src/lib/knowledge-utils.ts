import type { KnowledgeBullet } from './types.js';
import { generateDeltaHash } from './deltas.js';

export interface ParsedBullet {
  id: string;
  helpfulCount: number;
  harmfulCount: number;
  text: string;
  lineNumber: number;
  aggregatedFrom?: number;
  section?: string;
}

/**
 * Comprehensive regex pattern for parsing knowledge bullets
 * Supports both simple and aggregated formats:
 * - [Bullet #id, helpful:N, harmful:M] Content
 * - [Bullet #id, helpful:N, harmful:M, Aggregated from X instances] Content
 */
export const BULLET_PATTERN = new RegExp(
  /^\s*\[Bullet #([a-zA-Z0-9-]+), helpful:(\d+), harmful:(\d+)/.source +
  /(?:, Aggregated from (\d+) instances)?\] (.+)$/.source
);

/**
 * Flexible bullet pattern for parsing with optional metadata
 * Matches additional metadata like aggregation info
 */
export const FLEXIBLE_BULLET_PATTERN =
  /\[Bullet #(\S+), helpful:(\d+), harmful:(\d+)(?:, [^\]]+)?\] (.+)/;

/**
 * Parse knowledge bullets from markdown content
 * Returns array of parsed bullets with line numbers and section info
 */
export function parseKnowledgeBullets(
  markdown: string,
  options?: { trackSections?: boolean }
): ParsedBullet[] {
  const bullets: ParsedBullet[] = [];
  const lines = markdown.split('\n');
  let currentSection = '';

  lines.forEach((line, index) => {
    // Track section headers if requested
    if (options?.trackSections && (line.startsWith('## ') || line.startsWith('### '))) {
      currentSection = line.trim().replace(/^##+ /, '');
      return;
    }

    const match = line.match(BULLET_PATTERN);
    if (match) {
      const [, id, helpful, harmful, aggregated, text] = match;
      bullets.push({
        id,
        helpfulCount: parseInt(helpful, 10),
        harmfulCount: parseInt(harmful, 10),
        text: text.trim(),
        lineNumber: index + 1,
        aggregatedFrom: aggregated ? parseInt(aggregated, 10) : undefined,
        section: options?.trackSections ? currentSection : undefined,
      });
    }
  });

  return bullets;
}

/**
 * Parse bullets into full KnowledgeBullet objects with provenance
 * Expected format:
 * [Bullet #id, helpful:N, harmful:M] Content
 * <!-- deltaId=..., beadsId=..., createdAt=..., hash=... -->
 */
export function parseKnowledgeBulletsWithProvenance(markdown: string): KnowledgeBullet[] {
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
 * Update bullet counters in markdown content
 * Takes a map of bullet IDs to delta values and updates the counters
 */
export function updateBulletCountersInMarkdown(
  markdown: string,
  deltas: Map<string, { helpful: number; harmful: number }>
): string {
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(BULLET_PATTERN);
    if (match) {
      const [, id, helpful, harmful, aggregated, text] = match;
      const delta = deltas.get(id);
      
      if (delta) {
        const newHelpful = parseInt(helpful, 10) + delta.helpful;
        const newHarmful = parseInt(harmful, 10) + delta.harmful;
        const aggregationInfo = aggregated ?
          `, Aggregated from ${aggregated} instances` : '';
        
        lines[i] =
          `[Bullet #${id}, helpful:${newHelpful}, harmful:${newHarmful}` +
          `${aggregationInfo}] ${text}`;
      }
    }
  }

  return lines.join('\n');
}

/**
 * Find the index of a section header in markdown lines
 * Returns -1 if section not found
 */
export function findSectionIndex(lines: string[], section: string): number {
  const normalizedSection = section.toLowerCase();
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      const headerText = lines[i].slice(3).trim().toLowerCase();
      const normalizedHeader = headerText.replace(/\s+/g, '/');
      if (headerText === normalizedSection || normalizedHeader === normalizedSection) {
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * Find the position to insert a new bullet within a section
 * Returns the line index where the bullet should be inserted
 */
export function findInsertPosition(lines: string[], sectionIdx: number): number {
  // Start searching after the section header
  let i = sectionIdx + 1;
  
  // Skip empty lines and section description
  while (i < lines.length && (lines[i].trim() === '' || lines[i].startsWith('<!--'))) {
    i++;
  }
  
  // Find the last bullet in this section
  let lastBulletIdx = i;
  while (i < lines.length) {
    // Stop if we hit another section
    if (lines[i].startsWith('## ') || lines[i].startsWith('### ')) {
      break;
    }
    
    // Track bullet positions
    if (lines[i].match(BULLET_PATTERN) || lines[i].match(FLEXIBLE_BULLET_PATTERN)) {
      lastBulletIdx = i;
      // Skip potential comment line
      if (i + 1 < lines.length && lines[i + 1].startsWith('<!--')) {
        i++;
        lastBulletIdx = i;
      }
    }
    
    i++;
  }
  
  // Insert after the last bullet (or after section header if no bullets)
  return lastBulletIdx === sectionIdx + 1 ? sectionIdx + 1 : lastBulletIdx + 1;
}

/**
 * Count total bullets in markdown content
 */
export function countBullets(markdown: string): number {
  const matches = markdown.match(new RegExp(BULLET_PATTERN.source, 'gm'));
  return matches ? matches.length : 0;
}

/**
 * Extract bullet by ID from markdown
 */
export function extractBulletById(markdown: string, bulletId: string): ParsedBullet | null {
  const bullets = parseKnowledgeBullets(markdown);
  return bullets.find(b => b.id === bulletId) || null;
}

/**
 * Remove a bullet by ID from markdown
 */
export function removeBulletById(markdown: string, bulletId: string): string {
  const lines = markdown.split('\n');
  const newLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(BULLET_PATTERN);
    
    if (match && match[1] === bulletId) {
      // Skip this bullet line
      // Also skip the next line if it's a comment
      if (i + 1 < lines.length && lines[i + 1].startsWith('<!--')) {
        i++;
      }
      continue;
    }
    
    newLines.push(lines[i]);
  }
  
  return newLines.join('\n');
}

/**
 * Serialize bullets to AGENTS.md format
 */
export function serializeBullets(bullets: KnowledgeBullet[]): string {
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
        `[Bullet #${bullet.id}, helpful:${bullet.helpful}, ` +
        `harmful:${bullet.harmful}] ${bullet.content}`
      );
      if (bullet.provenance && bullet.hash) {
        const provenance =
          `<!-- deltaId=${bullet.provenance.deltaId}, ` +
          `beadsId=${bullet.provenance.beadsId}, ` +
          `createdAt=${bullet.provenance.createdAt}, hash=${bullet.hash} -->`;
        lines.push(provenance);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
