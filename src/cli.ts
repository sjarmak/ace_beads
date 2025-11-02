#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initCommand } from './commands/init.js';
import { onboardCommand } from './commands/onboard.js';
import { captureCommand } from './commands/capture.js';
import { analyzeCommand } from './commands/analyze.js';
import { updateCommand } from './commands/update.js';
import { learnCommand } from './commands/learn.js';
import { getCommand } from './commands/get.js';
import { traceListCommand, traceShowCommand } from './commands/trace.js';
import { threadReportCommand } from './commands/thread.js';
import { beadsHookInstallCommand } from './commands/beads-hook.js';
import { ampConfigCommand } from './commands/amp-config.js';
import { statusCommand } from './commands/status.js';
import { applyCommand } from './commands/apply.js';
import { sweepCommand } from './commands/sweep.js';
import { deltaListCommand, deltaShowCommand, deltaRmCommand } from './commands/delta.js';
import { doctorCommand } from './commands/doctor.js';
import type { InitOptions } from './lib/mcp-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('ace')
  .description('ACE (Agentic Context Engineering) CLI - Self-improving coding agent framework')
  .version(packageJson.version);

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
  .option('--thread-refs <refs>', 'Comma-separated Amp thread IDs or URLs')
  .option('--thread-summary <summary>', 'Brief summary of thread context')
  .option('--thread-citations <json>', 'JSON array of thread citations')
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
  .command('review')
  .description('Review proposed updates without applying (dry-run mode)')
  .option('--beads <ids>', 'Comma-separated bead IDs')
  .option('--min-confidence <n>', 'Minimum confidence threshold', parseFloat, 0.8)
  .option('--max-deltas <n>', 'Max updates to show', parseInt, 3)
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await learnCommand({ ...options, dryRun: true });
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
.option('--threads <ids>', 'Filter by thread IDs (comma-separated)')
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

const traceCmd = program
  .command('trace')
  .description('Inspect execution traces');

traceCmd
.command('list')
.description('List recent execution traces')
.option('--limit <n>', 'Max number of traces to show', parseInt, 20)
.option('--beads <ids>', 'Filter by bead IDs (comma-separated)')
.option('--threads <ids>', 'Filter by thread IDs (comma-separated)')
.option('--json', 'Output in JSON format')
.action(async (options) => {
try {
const beads = options.beads
? options.beads.split(',').map((s: string) => s.trim()).filter(Boolean)
  : undefined;
  const threads = options.threads
        ? options.threads.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;
      await traceListCommand({ ...options, beads, threads });
    } catch (error) {
      const code = (error as any)?.code;
      const exitCode = code === 'INVALID_ARGUMENT' ? 2
        : code === 'TRACE_NOT_FOUND' || code === 'TRACES_FILE_NOT_FOUND' ? 4
        : code === 'PARSE_ERROR' ? 7
        : 3;
      
      if (options.json) {
        console.error(JSON.stringify({
          error: {
            code: code || 'TRACE_LIST_ERROR',
            message: error instanceof Error ? error.message : String(error)
          }
        }, null, 2));
      } else {
        console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      }
      process.exit(exitCode);
    }
  });

traceCmd
  .command('show <trace_id>')
  .description('Show full details of a specific trace')
  .option('--json', 'Output in JSON format')
  .action(async (traceId, options) => {
    try {
      await traceShowCommand(traceId, options);
    } catch (error) {
      const code = (error as any)?.code;
      const exitCode = code === 'INVALID_ARGUMENT' ? 2
        : code === 'TRACE_NOT_FOUND' || code === 'TRACES_FILE_NOT_FOUND' ? 4
        : code === 'PARSE_ERROR' ? 7
        : 3;
      
      if (options.json) {
        console.error(JSON.stringify({
          error: {
            code: code || 'TRACE_SHOW_ERROR',
            message: error instanceof Error ? error.message : String(error)
          }
        }, null, 2));
      } else {
        console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      }
      process.exit(exitCode);
    }
  });

const threadCmd = program
  .command('thread')
  .description('Thread-based aggregation and reporting');

threadCmd
  .command('report')
  .description('Generate thread-based aggregation report')
  .option('--json', 'Output in JSON format')
  .option('--limit <n>', 'Max threads to show', parseInt, 10)
  .action(async (options) => {
    try {
      await threadReportCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

const beadsCmd = program
  .command('beads')
  .description('Beads integration commands');

beadsCmd
  .command('hook')
  .description('Manage Beads hooks')
  .command('install')
  .description('Install ACE hooks for Beads')
  .option('--json', 'Output in JSON format')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      await beadsHookInstallCommand(options);
    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({
          error: {
            code: 'HOOK_INSTALL_ERROR',
            message: error instanceof Error ? error.message : String(error)
          }
        }, null, 2));
      } else {
        console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      }
      process.exit(1);
    }
  });

program
  .command('amp-config')
  .description('Manage Amp configuration with directory-level overrides')
  .option('--apply', 'Apply project config to client configuration')
  .option('--list', 'List current configuration')
  .option('--restore', 'Restore global default configuration from backup')
  .option('--json', 'Output in JSON format')
  .option('--verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      ampConfigCommand(options);
    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({
          error: {
            code: 'MCP_CONFIG_ERROR',
            message: error instanceof Error ? error.message : String(error)
          }
        }, null, 2));
      } else {
        console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      }
      process.exit(3);
    }
  });

program
  .command('status')
  .description('Show ACE system status')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await statusCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program
  .command('apply')
  .description('Apply deltas from queue to knowledge base')
  .option('--id <ids...>', 'Apply specific delta IDs')
  .option('--dry-run', 'Preview without applying')
  .option('--no-branch', 'Skip git branch/commit')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await applyCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program
  .command('sweep')
  .description('Offline learning from historical beads')
  .option('--range <range>', 'Bead ID range (e.g., bd-100..bd-200)')
  .option('--labels <labels>', 'Filter by labels (comma-separated)', 'ace,reflect')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await sweepCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

const deltaCmd = program
  .command('delta')
  .description('Manage delta queue');

deltaCmd
  .command('ls')
  .description('List deltas in queue')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await deltaListCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

deltaCmd
  .command('show <id>')
  .description('Show delta details')
  .option('--json', 'Output in JSON format')
  .action(async (id, options) => {
    try {
      await deltaShowCommand(id, options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

deltaCmd
  .command('rm <ids...>')
  .description('Remove deltas from queue')
  .option('--json', 'Output in JSON format')
  .action(async (ids, options) => {
    try {
      await deltaRmCommand(ids, options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program
  .command('doctor')
  .description('Run ACE diagnostics')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      await doctorCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(3);
    }
  });

program.parse(process.argv);
