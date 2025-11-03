import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import type { ACEConfig } from './mcp-types.js';

const DEFAULT_CONFIG: ACEConfig = {
  agentsPath: 'knowledge/AGENTS.md',
  logsDir: 'logs',
  insightsPath: 'logs/insights.jsonl',
  tracesPath: 'logs/execution_traces.jsonl',
  maxDeltas: 3,
  defaultConfidence: 0.8,
  deltaQueue: '.ace/delta-queue.json',
  learning: {
    confidenceMin: 0.80,
    maxDeltasPerSession: 3,
    offline: {
      epochs: 3,
      reviewThreshold: 0.65,
    },
  },
  traceRetention: {
    maxTracesPerBead: 10,
    maxAgeInDays: 30,
    archivePath: 'logs/archive/execution_traces.archive.jsonl',
  },
};

function loadUserConfig(): Partial<ACEConfig> | null {
  const userConfigPath = join(homedir(), '.config', 'ace', 'config.json');
  if (!existsSync(userConfigPath)) return null;
  
  try {
    return JSON.parse(readFileSync(userConfigPath, 'utf-8'));
  } catch (error) {
    console.error(`Warning: Failed to parse user config at ${userConfigPath}`);
    return null;
  }
}

function loadProjectConfig(workingDir: string): Partial<ACEConfig> | null {
  const projectConfigPath = join(workingDir, '.ace.json');
  if (!existsSync(projectConfigPath)) return null;
  
  try {
    return JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
  } catch (error) {
    console.error(`Warning: Failed to parse project config at ${projectConfigPath}`);
    return null;
  }
}

function applyEnvVars(config: ACEConfig): ACEConfig {
  const updated = { ...config };
  
  if (process.env.ACE_AGENTS_PATH) updated.agentsPath = process.env.ACE_AGENTS_PATH;
  if (process.env.ACE_LOGS_DIR) updated.logsDir = process.env.ACE_LOGS_DIR;
  if (process.env.ACE_INSIGHTS_PATH) updated.insightsPath = process.env.ACE_INSIGHTS_PATH;
  if (process.env.ACE_TRACES_PATH) updated.tracesPath = process.env.ACE_TRACES_PATH;
  if (process.env.ACE_MAX_DELTAS) updated.maxDeltas = parseInt(process.env.ACE_MAX_DELTAS, 10);
  if (process.env.ACE_CONFIDENCE) updated.defaultConfidence = parseFloat(process.env.ACE_CONFIDENCE);
  
  return updated;
}

function applyFlags(config: ACEConfig, flags: Partial<ACEConfig>): ACEConfig {
  const updated = { ...config };
  Object.keys(flags).forEach(key => {
    const value = flags[key as keyof ACEConfig];
    if (value !== undefined) {
      (updated as any)[key] = value;
    }
  });
  return updated;
}

function resolvePaths(config: ACEConfig, workingDir: string): ACEConfig {
  return {
    ...config,
    agentsPath: resolve(workingDir, config.agentsPath),
    logsDir: resolve(workingDir, config.logsDir),
    insightsPath: resolve(workingDir, config.insightsPath),
    tracesPath: resolve(workingDir, config.tracesPath),
  };
}

export function loadConfig(flags: Partial<ACEConfig> = {}, cwd?: string): ACEConfig {
  const workingDir = cwd || process.cwd();
  
  let config: ACEConfig = { ...DEFAULT_CONFIG };
  
  const userConfig = loadUserConfig();
  if (userConfig) config = { ...config, ...userConfig };
  
  const projectConfig = loadProjectConfig(workingDir);
  if (projectConfig) config = { ...config, ...projectConfig };
  
  config = applyEnvVars(config);
  config = applyFlags(config, flags);
  config = resolvePaths(config, workingDir);
  
  return config;
}

export function validateConfig(config: ACEConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxDeltas < 1) {
    errors.push('maxDeltas must be at least 1');
  }

  if (config.defaultConfidence < 0 || config.defaultConfidence > 1) {
    errors.push('defaultConfidence must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
