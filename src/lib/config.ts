import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import type { ACEConfig } from './mcp-types.js';

const DEFAULT_CONFIG: ACEConfig = {
  agentsPath: 'AGENTS.md',
  logsDir: 'logs',
  insightsPath: 'logs/insights.jsonl',
  tracesPath: 'logs/execution_traces.jsonl',
  maxDeltas: 3,
  defaultConfidence: 0.8
};

export function loadConfig(flags: Partial<ACEConfig> = {}, cwd?: string): ACEConfig {
  const workingDir = cwd || process.cwd();
  
  // Start with defaults
  let config = { ...DEFAULT_CONFIG };
  
  // Load user config (~/.config/ace/config.json)
  const userConfigPath = join(homedir(), '.config', 'ace', 'config.json');
  if (existsSync(userConfigPath)) {
    try {
      const userConfig = JSON.parse(readFileSync(userConfigPath, 'utf-8'));
      config = { ...config, ...userConfig };
    } catch (error) {
      console.error(`Warning: Failed to parse user config at ${userConfigPath}`);
    }
  }
  
  // Load project config (.ace.json)
  const projectConfigPath = join(workingDir, '.ace.json');
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      config = { ...config, ...projectConfig };
    } catch (error) {
      console.error(`Warning: Failed to parse project config at ${projectConfigPath}`);
    }
  }
  
  // Apply environment variables
  if (process.env.ACE_AGENTS_PATH) {
    config.agentsPath = process.env.ACE_AGENTS_PATH;
  }
  if (process.env.ACE_LOGS_DIR) {
    config.logsDir = process.env.ACE_LOGS_DIR;
  }
  if (process.env.ACE_INSIGHTS_PATH) {
    config.insightsPath = process.env.ACE_INSIGHTS_PATH;
  }
  if (process.env.ACE_TRACES_PATH) {
    config.tracesPath = process.env.ACE_TRACES_PATH;
  }
  if (process.env.ACE_MAX_DELTAS) {
    config.maxDeltas = parseInt(process.env.ACE_MAX_DELTAS, 10);
  }
  if (process.env.ACE_CONFIDENCE) {
    config.defaultConfidence = parseFloat(process.env.ACE_CONFIDENCE);
  }
  
  // Apply flags (highest priority) - only override defined values
  Object.keys(flags).forEach(key => {
    const value = flags[key as keyof ACEConfig];
    if (value !== undefined) {
      (config as any)[key] = value;
    }
  });
  
  // Resolve relative paths to absolute
  config.agentsPath = resolve(workingDir, config.agentsPath);
  config.logsDir = resolve(workingDir, config.logsDir);
  config.insightsPath = resolve(workingDir, config.insightsPath);
  config.tracesPath = resolve(workingDir, config.tracesPath);
  
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
