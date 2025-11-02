import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { loadConfig } from '../lib/config.js';
import type { InitOptions, InitResult } from '../lib/mcp-types.js';
import { ensureBeadsInstalled, initBeadsIfNeeded } from '../lib/beads-installer.js';
import { ensureGeneratorRunning } from '../lib/amp-generator.js';

const AGENTS_MD_TEMPLATE = `# ACE_Beads_Amp Project

This project implements the ACE (Agentic Context Engineering) framework using Amp subagents and Beads for task tracking.

## Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->
<!-- Bullets accumulate over time and are never compressed -->

### Build & Test Patterns
<!-- Curator adds build/test insights here -->

### TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

### Dependency Patterns
<!-- Curator adds patterns about Beads dependency chains here -->

### Architecture Patterns
<!-- Curator adds high-level design insights here -->
`;

export async function initCommand(options: InitOptions): Promise<InitResult> {
  await ensureBeadsInstalled();
  
  const config = loadConfig({
    agentsPath: options.agentsPath,
    logsDir: options.logsDir
  });
  
  const created: string[] = [];
  const skipped: string[] = [];
  
  // Create logs directory
  if (!existsSync(config.logsDir)) {
    mkdirSync(config.logsDir, { recursive: true });
    created.push(config.logsDir);
  } else {
    skipped.push(config.logsDir);
  }
  
  // Create execution_traces.jsonl
  if (!existsSync(config.tracesPath)) {
    const tracesDir = dirname(config.tracesPath);
    if (!existsSync(tracesDir)) {
      mkdirSync(tracesDir, { recursive: true });
    }
    writeFileSync(config.tracesPath, '', 'utf-8');
    created.push(config.tracesPath);
  } else {
    skipped.push(config.tracesPath);
  }
  
  // Create insights.jsonl
  if (!existsSync(config.insightsPath)) {
    const insightsDir = dirname(config.insightsPath);
    if (!existsSync(insightsDir)) {
      mkdirSync(insightsDir, { recursive: true });
    }
    writeFileSync(config.insightsPath, '', 'utf-8');
    created.push(config.insightsPath);
  } else {
    skipped.push(config.insightsPath);
  }
  
  // Create or update AGENTS.md
  if (!existsSync(config.agentsPath)) {
    writeFileSync(config.agentsPath, AGENTS_MD_TEMPLATE, 'utf-8');
    created.push(config.agentsPath);
  } else {
    // Verify it has required sections
    const content = readFileSync(config.agentsPath, 'utf-8');
    const hasLearnedPatterns = content.includes('## Learned Patterns');
    
    if (!hasLearnedPatterns) {
      // Append the learned patterns section
      writeFileSync(
        config.agentsPath,
        content + '\n\n' + AGENTS_MD_TEMPLATE.split('## Learned Patterns')[1],
        'utf-8'
      );
      created.push(`${config.agentsPath} (sections added)`);
    } else {
      skipped.push(config.agentsPath);
    }
  }
  
  initBeadsIfNeeded(options.quiet);
  
  await ensureGeneratorRunning();
  
  return {
    created,
    skipped,
    agentsPath: config.agentsPath,
    logsDir: config.logsDir,
    tracesPath: config.tracesPath,
    insightsPath: config.insightsPath
  };
}
