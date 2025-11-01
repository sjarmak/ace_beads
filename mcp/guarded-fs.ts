import { readFile, writeFile, access, constants } from 'fs/promises';
import { join, resolve } from 'path';
import type { Role, FilePermission } from './types.js';

export class GuardedFileSystem {
  private permissions: FilePermission[] = [];
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = resolve(projectRoot);
    this.initializePermissions();
  }

  private initializePermissions() {
    // Generator: full access except knowledge files
    this.permissions.push(
      { role: 'generator', operation: 'read', pathPattern: '**/*', allowed: true },
      { role: 'generator', operation: 'write', pathPattern: '**/*', allowed: true },
      { role: 'generator', operation: 'write', pathPattern: '**/knowledge/AGENT.md', allowed: false },
      { role: 'generator', operation: 'write', pathPattern: '**/knowledge/insights.jsonl', allowed: false }
    );

    // Reflector: read-only, can only append to insights.jsonl
    this.permissions.push(
      { role: 'reflector', operation: 'read', pathPattern: '**/*', allowed: true },
      { role: 'reflector', operation: 'write', pathPattern: '**/*', allowed: false },
      { role: 'reflector', operation: 'write', pathPattern: '**/knowledge/insights.jsonl', allowed: true }
    );

    // Curator: read all, write only to knowledge/AGENT.md
    this.permissions.push(
      { role: 'curator', operation: 'read', pathPattern: '**/*', allowed: true },
      { role: 'curator', operation: 'write', pathPattern: '**/*', allowed: false },
      { role: 'curator', operation: 'write', pathPattern: '**/knowledge/AGENT.md', allowed: true }
    );
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    // Escape regex special chars in the original pattern first (including *)
    let pat = pattern.replace(/[.+^${}()|[\]\\*]/g, '\\$&');

    // Transform glob tokens - ORDER MATTERS!
    // '**/' -> optional directories (no leading slash required)
    // After escaping, **/ becomes \*\*/ (note: / is NOT escaped)
    pat = pat.replace(/\\\*\\\*\//g, '(?:.*/)?');
    // Standalone '**' at end (like **) -> any chars including slashes  
    pat = pat.replace(/\\\*\\\*$/g, '.*');
    // Single '*' -> any chars except slash
    pat = pat.replace(/\\\*/g, '[^/]*');

    const regex = new RegExp(`^${pat}$`);
    return regex.test(normalized);
  }

  private checkPermission(role: Role, operation: 'read' | 'write', filePath: string): boolean {
    const relativePath = filePath.startsWith(this.projectRoot)
      ? filePath.substring(this.projectRoot.length + 1)
      : filePath;

    // Find all matching permissions (most specific last)
    const matchingPerms = this.permissions.filter(
      (p) =>
        p.role === role &&
        p.operation === operation &&
        this.matchesPattern(relativePath, p.pathPattern)
    );

    if (matchingPerms.length === 0) {
      return false;
    }

    // Return the last matching permission (most specific)
    return matchingPerms[matchingPerms.length - 1].allowed;
  }

  async read(role: Role, filePath: string): Promise<string> {
    const fullPath = resolve(this.projectRoot, filePath);

    if (!this.checkPermission(role, 'read', fullPath)) {
      throw new Error(`Permission denied: ${role} cannot read ${filePath}`);
    }

    try {
      await access(fullPath, constants.R_OK);
      return await readFile(fullPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read ${filePath}: ${error}`);
    }
  }

  async write(role: Role, filePath: string, content: string): Promise<void> {
    const fullPath = resolve(this.projectRoot, filePath);

    if (!this.checkPermission(role, 'write', fullPath)) {
      throw new Error(`Permission denied: ${role} cannot write to ${filePath}`);
    }

    try {
      await writeFile(fullPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write ${filePath}: ${error}`);
    }
  }

  async append(role: Role, filePath: string, content: string): Promise<void> {
    const fullPath = resolve(this.projectRoot, filePath);

    if (!this.checkPermission(role, 'write', fullPath)) {
      throw new Error(`Permission denied: ${role} cannot append to ${filePath}`);
    }

    try {
      const existing = await readFile(fullPath, 'utf-8').catch(() => '');
      const newContent = existing + (existing && !existing.endsWith('\n') ? '\n' : '') + content;
      await writeFile(fullPath, newContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to append to ${filePath}: ${error}`);
    }
  }
}
