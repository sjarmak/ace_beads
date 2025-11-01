import { mkdir, writeFile, readFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';

export interface SessionArtifact {
  type: 'trace' | 'log' | 'insight' | 'metadata' | 'custom';
  filename: string;
  content: string | object;
}

export interface SessionMetadata {
  sessionId: string;
  createdAt: string;
  taskId?: string;
  beadId?: string;
  agent?: 'generator' | 'reflector' | 'curator';
  tags?: string[];
}

export class SessionManager {
  private baseDir: string;
  private sessionId: string;
  private sessionDir: string;
  private metadata: SessionMetadata;

  constructor(
    baseDir: string = resolve(process.cwd(), '.ace/sessions'),
    sessionId?: string
  ) {
    this.baseDir = baseDir;
    this.sessionId = sessionId || this.generateSessionId();
    this.sessionDir = join(this.baseDir, this.sessionId);
    this.metadata = {
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
    };
  }

  private generateSessionId(): string {
    return randomUUID();
  }

  async initialize(metadata?: Partial<SessionMetadata>): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await mkdir(this.sessionDir, { recursive: true });

    if (metadata) {
      this.metadata = { ...this.metadata, ...metadata };
    }

    await this.writeMetadata();
  }

  async writeArtifact(artifact: SessionArtifact): Promise<string> {
    const filepath = join(this.sessionDir, artifact.filename);
    const content =
      typeof artifact.content === 'string'
        ? artifact.content
        : JSON.stringify(artifact.content, null, 2);

    await writeFile(filepath, content, 'utf-8');
    return filepath;
  }

  async writeTrace(
    taskId: string,
    command: string,
    result: object
  ): Promise<string> {
    const filename = `trace-${taskId}-${Date.now()}.json`;
    return this.writeArtifact({
      type: 'trace',
      filename,
      content: {
        taskId,
        command,
        ...result,
        sessionId: this.sessionId,
      },
    });
  }

  async writeLog(logname: string, content: string): Promise<string> {
    const filename = `${logname}-${Date.now()}.log`;
    return this.writeArtifact({
      type: 'log',
      filename,
      content,
    });
  }

  async writeInsight(insight: object): Promise<string> {
    const filename = `insight-${Date.now()}.json`;
    return this.writeArtifact({
      type: 'insight',
      filename,
      content: insight,
    });
  }

  async readArtifact(filename: string): Promise<string> {
    const filepath = join(this.sessionDir, filename);
    return readFile(filepath, 'utf-8');
  }

  async listArtifacts(): Promise<string[]> {
    if (!existsSync(this.sessionDir)) {
      return [];
    }
    return readdir(this.sessionDir);
  }

  async getMetadata(): Promise<SessionMetadata> {
    return this.metadata;
  }

  async updateMetadata(updates: Partial<SessionMetadata>): Promise<void> {
    this.metadata = { ...this.metadata, ...updates };
    await this.writeMetadata();
  }

  private async writeMetadata(): Promise<void> {
    const filepath = join(this.sessionDir, 'session-metadata.json');
    await writeFile(filepath, JSON.stringify(this.metadata, null, 2), 'utf-8');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getSessionDir(): string {
    return this.sessionDir;
  }

  static async listSessions(
    baseDir: string = resolve(process.cwd(), '.ace/sessions')
  ): Promise<string[]> {
    if (!existsSync(baseDir)) {
      return [];
    }

    const entries = await readdir(baseDir);
    const sessions: string[] = [];

    for (const entry of entries) {
      const entryPath = join(baseDir, entry);
      const stats = await stat(entryPath);
      if (stats.isDirectory()) {
        sessions.push(entry);
      }
    }

    return sessions;
  }

  static async loadSession(
    sessionId: string,
    baseDir: string = resolve(process.cwd(), '.ace/sessions')
  ): Promise<SessionManager> {
    const manager = new SessionManager(baseDir, sessionId);
    const metadataPath = join(manager.sessionDir, 'session-metadata.json');

    if (existsSync(metadataPath)) {
      const content = await readFile(metadataPath, 'utf-8');
      manager.metadata = JSON.parse(content);
    }

    return manager;
  }
}
