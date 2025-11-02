import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { KnowledgeAnalyzer, ArchivalCandidate } from './knowledge-analyzer.js';
import { loadConfig } from './config.js';

export interface ArchivalResult {
  bulletsMoved: number;
  linesReduced: number;
  archivePath: string;
}

export class AgentsMdMaintainer {
  private maxLines: number;
  private agentsPath: string;
  private archivePath: string;

  constructor(maxLines: number = 500, agentsPath?: string, archivePath?: string) {
    const config = loadConfig();
    this.maxLines = maxLines;
    this.agentsPath = agentsPath ?? config.agentsPath;
    this.archivePath = archivePath ?? this.agentsPath.replace('AGENTS.md', 'knowledge/AGENTS.archive.md');
  }

  /**
   * Check if AGENTS.md exceeds the line limit and archive low-signal bullets if needed
   */
  async trimToLimit(): Promise<ArchivalResult> {
    const content = readFileSync(this.agentsPath, 'utf-8');
    const lines = content.split('\n');
    
    if (lines.length <= this.maxLines) {
      return { bulletsMoved: 0, linesReduced: 0, archivePath: this.archivePath };
    }

    console.log(`[Maintainer] AGENTS.md has ${lines.length} lines, exceeds limit of ${this.maxLines}`);
    
    // Use KnowledgeAnalyzer to identify archival candidates
    const analyzer = new KnowledgeAnalyzer();
    const bullets = await analyzer.parseAgentsMd(this.agentsPath);
    const candidates = await analyzer.identifyArchivalCandidates(bullets);
    
    if (candidates.length === 0) {
      console.log('[Maintainer] No archival candidates found');
      return { bulletsMoved: 0, linesReduced: 0, archivePath: this.archivePath };
    }

    // Sort candidates by priority (high-harmful > low-signal > zero-helpful)
    const sortedCandidates = candidates.sort((a, b) => {
      // Prioritize high-harmful bullets
      if (a.reason === 'high-harmful' && b.reason !== 'high-harmful') return -1;
      if (b.reason === 'high-harmful' && a.reason !== 'high-harmful') return 1;
      
      // Then low-signal bullets
      if (a.reason === 'low-signal' && b.reason === 'zero-helpful') return -1;
      if (b.reason === 'low-signal' && a.reason === 'zero-helpful') return 1;
      
      return 0;
    });

    // Archive bullets until we're under the limit
    const candidatesToArchive: ArchivalCandidate[] = [];
    let currentLines = lines.length;
    
    for (const candidate of sortedCandidates) {
      if (currentLines <= this.maxLines) break;
      candidatesToArchive.push(candidate);
      // Each bullet is roughly 1-2 lines
      currentLines -= 2;
    }

    if (candidatesToArchive.length === 0) {
      console.log('[Maintainer] Not enough low-signal bullets to archive');
      return { bulletsMoved: 0, linesReduced: 0, archivePath: this.archivePath };
    }

    // Archive the bullets
    await this.archiveBullets(candidatesToArchive);
    
    // Remove archived bullets from AGENTS.md
    const updatedContent = this.removeBullets(content, candidatesToArchive);
    writeFileSync(this.agentsPath, updatedContent, 'utf-8');
    
    const newLines = updatedContent.split('\n').length;
    const linesReduced = lines.length - newLines;

    console.log(`[Maintainer] Archived ${candidatesToArchive.length} bullets, reduced from ${lines.length} to ${newLines} lines`);
    
    return {
      bulletsMoved: candidatesToArchive.length,
      linesReduced,
      archivePath: this.archivePath
    };
  }

  private async archiveBullets(candidates: ArchivalCandidate[]): Promise<void> {
    const timestamp = new Date().toISOString();
    const header = `\n## Archived ${timestamp}\n\nReason: Archived to keep AGENTS.md under ${this.maxLines} lines\n\n`;
    
    if (!existsSync(this.archivePath)) {
      writeFileSync(this.archivePath, `# AGENTS.md Archive\n\nThis file contains bullets archived from AGENTS.md to maintain the ${this.maxLines}-line limit.\n${header}`, 'utf-8');
    } else {
      appendFileSync(this.archivePath, header, 'utf-8');
    }

    // Group by section (we'll need to extract section from content or default)
    const bySection = new Map<string, ArchivalCandidate[]>();
    for (const candidate of candidates) {
      const section = 'Archived Bullets'; // Simplified - could enhance to detect section
      if (!bySection.has(section)) {
        bySection.set(section, []);
      }
      bySection.get(section)!.push(candidate);
    }

    // Write to archive grouped by section
    for (const [section, sectionCandidates] of bySection) {
      appendFileSync(this.archivePath, `### ${section} (${sectionCandidates.length} bullets)\n\n`, 'utf-8');
      for (const candidate of sectionCandidates) {
        const bulletLine = `[Bullet #${candidate.bullet.id}, helpful:${candidate.bullet.helpfulCount}, harmful:${candidate.bullet.harmfulCount}] ${candidate.bullet.text}`;
        appendFileSync(this.archivePath, `${bulletLine} [Archived reason: ${candidate.reason}]\n`, 'utf-8');
      }
      appendFileSync(this.archivePath, '\n', 'utf-8');
    }

    console.log(`[Maintainer] Wrote ${candidates.length} bullets to ${this.archivePath}`);
  }

  private removeBullets(content: string, candidates: ArchivalCandidate[]): string {
    const bulletIds = new Set(candidates.map(c => c.bullet.id));
    const lines = content.split('\n');
    const filtered = lines.filter(line => {
      const match = line.match(/\[Bullet #([a-f0-9]+)/);
      if (match && bulletIds.has(match[1])) {
        return false;
      }
      return true;
    });
    
    return filtered.join('\n');
  }
}
