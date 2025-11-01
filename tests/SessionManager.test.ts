import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../mcp/SessionManager.js';
import { existsSync } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { readFile } from 'fs/promises';

describe('SessionManager', () => {
  const testBaseDir = resolve(process.cwd(), 'test-temp-sessions');
  let sessionManager: SessionManager;

  beforeEach(async () => {
    await mkdir(testBaseDir, { recursive: true });
    sessionManager = new SessionManager(testBaseDir);
  });

  afterEach(async () => {
    if (existsSync(testBaseDir)) {
      await rm(testBaseDir, { recursive: true, force: true });
    }
  });

  it('should generate a unique session ID', () => {
    const manager1 = new SessionManager(testBaseDir);
    const manager2 = new SessionManager(testBaseDir);
    
    expect(manager1.getSessionId()).toBeTruthy();
    expect(manager2.getSessionId()).toBeTruthy();
    expect(manager1.getSessionId()).not.toBe(manager2.getSessionId());
  });

  it('should create session directory structure on initialize', async () => {
    await sessionManager.initialize();
    
    expect(existsSync(sessionManager.getSessionDir())).toBe(true);
    expect(existsSync(join(sessionManager.getSessionDir(), 'session-metadata.json'))).toBe(true);
  });

  it('should write and read artifacts', async () => {
    await sessionManager.initialize();
    
    const artifact = {
      type: 'log' as const,
      filename: 'test.log',
      content: 'Test log content',
    };

    const filepath = await sessionManager.writeArtifact(artifact);
    expect(existsSync(filepath)).toBe(true);

    const content = await sessionManager.readArtifact('test.log');
    expect(content).toBe('Test log content');
  });

  it('should write trace artifacts with proper structure', async () => {
    await sessionManager.initialize();
    
    const result = {
      status: 'pass',
      exitCode: 0,
      stdout: 'Build successful',
    };

    const filepath = await sessionManager.writeTrace('task-123', 'npm run build', result);
    expect(existsSync(filepath)).toBe(true);

    const content = await readFile(filepath, 'utf-8');
    const trace = JSON.parse(content);
    
    expect(trace.taskId).toBe('task-123');
    expect(trace.command).toBe('npm run build');
    expect(trace.status).toBe('pass');
    expect(trace.sessionId).toBe(sessionManager.getSessionId());
  });

  it('should write insight artifacts', async () => {
    await sessionManager.initialize();
    
    const insight = {
      id: 'insight-1',
      pattern: 'Test pattern',
      recommendation: 'Test recommendation',
    };

    const filepath = await sessionManager.writeInsight(insight);
    expect(existsSync(filepath)).toBe(true);

    const content = await readFile(filepath, 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(parsed.id).toBe('insight-1');
    expect(parsed.pattern).toBe('Test pattern');
  });

  it('should list all artifacts in session', async () => {
    await sessionManager.initialize();
    
    await sessionManager.writeLog('test1', 'content1');
    await sessionManager.writeLog('test2', 'content2');
    await sessionManager.writeInsight({ id: '1' });

    const artifacts = await sessionManager.listArtifacts();
    
    expect(artifacts.length).toBeGreaterThanOrEqual(4); // 2 logs + 1 insight + metadata
    expect(artifacts).toContain('session-metadata.json');
  });

  it('should update metadata', async () => {
    await sessionManager.initialize({ taskId: 'task-1' });
    
    let metadata = await sessionManager.getMetadata();
    expect(metadata.taskId).toBe('task-1');

    await sessionManager.updateMetadata({ beadId: 'bead-123', agent: 'generator' });
    
    metadata = await sessionManager.getMetadata();
    expect(metadata.taskId).toBe('task-1');
    expect(metadata.beadId).toBe('bead-123');
    expect(metadata.agent).toBe('generator');
  });

  it('should list all sessions', async () => {
    const manager1 = new SessionManager(testBaseDir);
    const manager2 = new SessionManager(testBaseDir);
    
    await manager1.initialize();
    await manager2.initialize();

    const sessions = await SessionManager.listSessions(testBaseDir);
    
    expect(sessions).toContain(manager1.getSessionId());
    expect(sessions).toContain(manager2.getSessionId());
    expect(sessions.length).toBe(2);
  });

  it('should load existing session', async () => {
    await sessionManager.initialize({ taskId: 'task-original', agent: 'curator' });
    await sessionManager.writeLog('original', 'original content');

    const loaded = await SessionManager.loadSession(sessionManager.getSessionId(), testBaseDir);
    
    expect(loaded.getSessionId()).toBe(sessionManager.getSessionId());
    
    const metadata = await loaded.getMetadata();
    expect(metadata.taskId).toBe('task-original');
    expect(metadata.agent).toBe('curator');

    const artifacts = await loaded.listArtifacts();
    expect(artifacts.some(a => a.includes('original'))).toBe(true);
  });

  it('should handle custom session ID', () => {
    const customId = 'custom-session-123';
    const manager = new SessionManager(testBaseDir, customId);
    
    expect(manager.getSessionId()).toBe(customId);
    expect(manager.getSessionDir()).toBe(join(testBaseDir, customId));
  });

  it('should handle JSON object artifacts', async () => {
    await sessionManager.initialize();
    
    const data = {
      type: 'custom' as const,
      filename: 'config.json',
      content: {
        key: 'value',
        nested: { array: [1, 2, 3] },
      },
    };

    await sessionManager.writeArtifact(data);
    const content = await sessionManager.readArtifact('config.json');
    const parsed = JSON.parse(content);
    
    expect(parsed.key).toBe('value');
    expect(parsed.nested.array).toEqual([1, 2, 3]);
  });
});
