import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const GENERATOR_LOCK_FILE = join(homedir(), '.ace', 'generator.lock');
const GENERATOR_LOG_FILE = join(homedir(), '.ace', 'generator.log');

interface GeneratorLock {
  pid: number;
  startTime: string;
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockFile(): GeneratorLock | null {
  if (!existsSync(GENERATOR_LOCK_FILE)) {
    return null;
  }
  
  try {
    const content = readFileSync(GENERATOR_LOCK_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeLockFile(pid: number): void {
  const lockDir = join(homedir(), '.ace');
  if (!existsSync(lockDir)) {
    mkdirSync(lockDir, { recursive: true });
  }
  
  const lock: GeneratorLock = {
    pid,
    startTime: new Date().toISOString()
  };
  
  writeFileSync(GENERATOR_LOCK_FILE, JSON.stringify(lock, null, 2), 'utf-8');
}

function startGenerator(): void {
  const lockDir = join(homedir(), '.ace');
  if (!existsSync(lockDir)) {
    mkdirSync(lockDir, { recursive: true });
  }
  
  const logStream = existsSync(GENERATOR_LOG_FILE) 
    ? undefined 
    : writeFileSync(GENERATOR_LOG_FILE, '', 'utf-8');
  
  const generatorProcess = spawn('node', [
    join(process.cwd(), 'agents', 'generator.js')
  ], {
    detached: true,
    stdio: 'ignore'
  });
  
  generatorProcess.unref();
  
  writeLockFile(generatorProcess.pid!);
}

export async function ensureGeneratorRunning(): Promise<void> {
  const lock = readLockFile();
  
  if (lock && isProcessRunning(lock.pid)) {
    return;
  }
  
  const generatorPath = join(process.cwd(), 'agents', 'generator.js');
  if (!existsSync(generatorPath)) {
    return;
  }
  
  startGenerator();
}
