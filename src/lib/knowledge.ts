import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import { KnowledgeBullet } from './merger.js';

export interface PlaybookSection {
  id: string;
  weight: number;
}

export interface Playbook {
  version: string;
  sections: PlaybookSection[];
}

/**
 * Knowledge manager for AGENTS.md and playbook.yaml
 * Enforces write-scope restrictions and deterministic serialization
 */
export class KnowledgeManager {
  constructor(
    private knowledgeDir: string,
    private agentsMdPath: string,
    private playbookPath: string
  ) {}

  /**
   * Ensure write path is within allowed scope
   */
  private validateWriteScope(path: string): void {
    const normalized = path.replace(/\\/g, '/');
    if (
      !normalized.includes('/knowledge/') &&
      !normalized.includes('/prompts/')
    ) {
      throw new Error(
        `Write scope violation: ${path} is outside knowledge/ and prompts/`
      );
    }
  }

  /**
   * Load AGENTS.md
   */
  async loadAgentsMd(): Promise<string> {
    try {
      return await readFile(this.agentsMdPath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Write AGENTS.md (with scope check)
   */
  async writeAgentsMd(content: string): Promise<void> {
    this.validateWriteScope(this.agentsMdPath);
    await mkdir(dirname(this.agentsMdPath), { recursive: true });
    await writeFile(this.agentsMdPath, content, 'utf-8');
  }

  /**
   * Load playbook.yaml
   */
  async loadPlaybook(): Promise<Playbook> {
    try {
      const content = await readFile(this.playbookPath, 'utf-8');
      const data = loadYaml(content) as any;
      return {
        version: data.version || '0.3',
        sections: data.sections || [],
      };
    } catch {
      return {
        version: '0.3',
        sections: [],
      };
    }
  }

  /**
   * Write playbook.yaml (with scope check)
   */
  async writePlaybook(playbook: Playbook): Promise<void> {
    this.validateWriteScope(this.playbookPath);
    
    // Sort sections by id for determinism
    playbook.sections.sort((a, b) => a.id.localeCompare(b.id));

    const content = dumpYaml(playbook, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: true,
    });

    await mkdir(dirname(this.playbookPath), { recursive: true });
    await writeFile(this.playbookPath, content, 'utf-8');
  }

  /**
   * Update playbook with new sections from bullets
   */
  async updatePlaybook(bullets: KnowledgeBullet[]): Promise<void> {
    const playbook = await this.loadPlaybook();
    const existingSections = new Set(playbook.sections.map((s) => s.id));

    // Extract unique sections from bullets
    const bulletSections = new Set(bullets.map((b) => b.section));

    for (const sectionId of bulletSections) {
      if (!existingSections.has(sectionId)) {
        playbook.sections.push({
          id: sectionId,
          weight: 0.5, // Default weight
        });
      }
    }

    await this.writePlaybook(playbook);
  }

  /**
   * Generate AGENTS.md with YAML front-matter and bullets
   */
  async generateAgentsMd(bullets: KnowledgeBullet[], content: string): Promise<string> {
    const playbook = await this.loadPlaybook();
    
    const frontMatter = dumpYaml({
      version: playbook.version,
      sections: playbook.sections,
    }, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: true,
    });

    return `---\n${frontMatter}---\n\n${content}`;
  }

  /**
   * Strip YAML front-matter from AGENTS.md
   */
  stripFrontMatter(markdown: string): string {
    const frontMatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n\n/);
    if (frontMatterMatch) {
      return markdown.slice(frontMatterMatch[0].length);
    }
    return markdown;
  }
}
