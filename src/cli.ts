#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { onboardCommand } from './commands/onboard.js';
import { captureCommand } from './commands/capture.js';
import { analyzeCommand } from './commands/analyze.js';
import { updateCommand } from './commands/update.js';
import { learnCommand } from './commands/learn.js';
import { getCommand } from './commands/get.js';
import type { InitOptions } from './lib/types.js';

const program = new Command();

program
  .name('ace')
  .description('ACE (Agentic Context Engineering) CLI - Self-improving coding agent framework')
  .version('1.0.0');

program
  .command('onboard')
  .description('Set up ACE with comprehensive agent instructions and sample project')
  .option('--json', 'Output in JSON format')
  .action(async (options: { json?: boolean }) => {
    try {
      await onboardCommand(options);
    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({
          error: {
            code: 'ONBOARD_ERROR',
            message: error instanceof Error ? error.message : String(error)
          }
        }, null, 2));
      } else {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      process.exit(3);
    }
  });

program
  .command('init')
  .description('Initialize ACE files and directories (idempotent)')
  .option('--agents <path>', 'Path to AGENTS.md file')
  .option('--logs-dir <dir>', 'Path to logs directory')
  .option('--yes', 'Skip confirmation prompts')
  .option('--json', 'Output in JSON format')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress info logs')
  .action(async (options: InitOptions) => {
    try {
      const result = await initCommand(options);
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('✅ ACE initialized successfully\n');
        
        if (result.created.length > 0) {
          console.log('Created:');
          result.created.forEach(path => console.log(`  - ${path}`));
        }
        
        if (result.skipped.length > 0) {
          console.log('\nAlready exists:');
          result.skipped.forEach(path => console.log(`  - ${path}`));
        }
        
        console.log('\nPaths:');
        console.log(`  AGENTS.md: ${result.agentsPath}`);
        console.log(`  Logs: ${result.logsDir}`);
        console.log(`  Traces: ${result.tracesPath}`);
        console.log(`  Insights: ${result.insightsPath}`);
      }
    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({
          error: {
            code: 'INIT_ERROR',
            message: error instanceof Error ? error.message : String(error)
          }
        }, null, 2));
      } else {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      process.exit(3);
    }
  });

program
  .command('capture')
  .description('Record execution trace')
  .requiredOption('--bead <id>', 'Bead/task identifier')
  .option('--desc <text>', 'Task description')
  .option('--exec <path>', 'Path to execution JSON file (or "-" for stdin)')
  .option('--discovered <ids>', 'Comma-separated discovered issue IDs')
  .option('--outcome <outcome>', 'Overall outcome: success|failure|partial', 'success')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await captureCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program
  .command('analyze <mode>')
  .description('Generate insights from traces (mode: single|batch)')
  .option('--trace <id>', 'Trace ID for single mode')
  .option('--beads <ids>', 'Comma-separated bead IDs for batch mode')
  .option('--min-confidence <n>', 'Minimum confidence threshold', parseFloat, 0.7)
  .option('--min-frequency <n>', 'Minimum error frequency for batch mode', parseInt)
  .option('--dry-run', 'Preview without writing')
  .option('--json', 'Output in JSON format')
  .action(async (mode, options) => {
    try {
      await analyzeCommand({ mode, ...options });
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program
  .command('update')
  .description('Apply insights to AGENTS.md')
  .option('--min-confidence <n>', 'Minimum confidence threshold', parseFloat, 0.8)
  .option('--max-deltas <n>', 'Max updates per session', parseInt, 3)
  .option('--dry-run', 'Preview without writing')
  .option('--force-insight-ids <ids>', 'Force specific insights')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await updateCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program
  .command('learn')
  .description('Convenience pipeline: analyze → update')
  .option('--beads <ids>', 'Comma-separated bead IDs')
  .option('--min-confidence <n>', 'Minimum confidence threshold', parseFloat, 0.8)
  .option('--max-deltas <n>', 'Max updates per session', parseInt, 3)
  .option('--dry-run', 'Preview without writing')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await learnCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program
  .command('get <source>')
  .description('Query insights or bullets (source: insights|bullets|both)')
  .option('--min-confidence <n>', 'Filter by confidence', parseFloat)
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('--sections <sections>', 'Filter bullets by section (comma-separated)')
  .option('--beads <ids>', 'Filter by bead IDs (comma-separated)')
  .option('--after <iso>', 'Filter insights after timestamp')
  .option('--before <iso>', 'Filter insights before timestamp')
  .option('--limit <n>', 'Max results', parseInt, 50)
  .option('--sort-by <field>', 'Sort by: confidence|timestamp|helpful', 'confidence')
  .option('--json', 'Output in JSON format')
  .action(async (source, options) => {
    try {
      await getCommand({ source, ...options });
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program.parse(process.argv);
