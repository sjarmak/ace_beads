import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig, validateConfig } from '../src/lib/config.js';

describe('Config System', () => {
  const testDir = join(process.cwd(), 'test-temp-config');
  const aceJsonPath = join(testDir, '.ace.json');
  
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    if (existsSync(aceJsonPath)) {
      unlinkSync(aceJsonPath);
    }
  });
  
  it('should load default config', () => {
    const config = loadConfig({}, testDir);
    
    expect(config.maxDeltas).toBe(3);
    expect(config.defaultConfidence).toBe(0.8);
  });
  
  it('should load .ace.json from project directory', () => {
    writeFileSync(aceJsonPath, JSON.stringify({
      maxDeltas: 5,
      defaultConfidence: 0.9
    }), 'utf-8');
    
    const config = loadConfig({}, testDir);
    
    expect(config.maxDeltas).toBe(5);
    expect(config.defaultConfidence).toBe(0.9);
  });
  
  it('should override .ace.json with CLI flags', () => {
    writeFileSync(aceJsonPath, JSON.stringify({
      maxDeltas: 5,
      defaultConfidence: 0.9
    }), 'utf-8');
    
    const config = loadConfig({ maxDeltas: 10 }, testDir);
    
    expect(config.maxDeltas).toBe(10);
    expect(config.defaultConfidence).toBe(0.9);
  });
  
  it('should resolve relative paths to absolute', () => {
    const config = loadConfig({}, testDir);
    
    expect(config.agentsPath).toContain(testDir);
    expect(config.logsDir).toContain(testDir);
  });
  
  it('should validate config correctly', () => {
    const validConfig = loadConfig({}, testDir);
    const result = validateConfig(validConfig);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('should catch invalid maxDeltas', () => {
    const config = loadConfig({ maxDeltas: 0 }, testDir);
    const result = validateConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('maxDeltas must be at least 1');
  });
  
  it('should catch invalid confidence', () => {
    const config = loadConfig({ defaultConfidence: 1.5 }, testDir);
    const result = validateConfig(config);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('defaultConfidence must be between 0 and 1');
  });
});
