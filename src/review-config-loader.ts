/**
 * Review Configuration Loader
 * 
 * Loads review routing configuration from .ace/review-config.json
 * Falls back to defaults if not present.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { ReviewRoutingConfig, DEFAULT_ROUTING_CONFIG } from './review-routing.js';

export class ReviewConfigLoader {
  private configPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.configPath = resolve(projectRoot, '.ace/review-config.json');
  }

  async load(): Promise<ReviewRoutingConfig> {
    if (!existsSync(this.configPath)) {
      console.log('[ReviewConfig] No config found, using defaults');
      return { ...DEFAULT_ROUTING_CONFIG };
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      const loaded = JSON.parse(content);
      
      // Merge with defaults to handle missing keys
      const config = { ...DEFAULT_ROUTING_CONFIG, ...loaded };
      
      console.log('[ReviewConfig] Loaded config from', this.configPath);
      return config;
    } catch (error) {
      console.error('[ReviewConfig] Failed to load config:', error);
      return { ...DEFAULT_ROUTING_CONFIG };
    }
  }

  async save(config: ReviewRoutingConfig): Promise<void> {
    const dir = dirname(this.configPath);
    
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(this.configPath, JSON.stringify(config, null, 2));
    console.log('[ReviewConfig] Saved config to', this.configPath);
  }

  async init(): Promise<void> {
    if (existsSync(this.configPath)) {
      console.log('[ReviewConfig] Config already exists at', this.configPath);
      return;
    }

    await this.save(DEFAULT_ROUTING_CONFIG);
    console.log('[ReviewConfig] Created default config');
  }
}
