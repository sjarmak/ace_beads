import { appendFileSync, existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { createInterface } from 'readline';
import { loadConfig } from '../lib/config.js';
import type { Insight } from '../lib/types.js';

interface InsightAddOptions {
  pattern: string;
  evidence?: string;
  confidence?: number;
  section?: string;
  bead?: string;
  thread?: string;
  interactive?: boolean;
  json?: boolean;
}

interface PostmortemOptions {
  bead: string;
  minConfidence?: number;
  dryRun?: boolean;
  json?: boolean;
}

function promptUser(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === '');
    });
  });
}

function autoDetectBead(): string | undefined {
  const envBead = process.env.ACE_BEAD_ID || process.env.CURRENT_BEAD_ID;
  if (envBead) return envBead;
  
  try {
    const gitBranch = require('child_process')
      .execSync('git branch --show-current', { encoding: 'utf-8' })
      .trim();
    
    const beadMatch = gitBranch.match(/(?:ACE_Beads_Amp-|bd-)(\d+)/);
    if (beadMatch) {
      return gitBranch.includes('ACE_Beads_Amp-') 
        ? `ACE_Beads_Amp-${beadMatch[1]}`
        : `bd-${beadMatch[1]}`;
    }
  } catch {
    // Ignore git errors
  }
  
  return undefined;
}

function autoDetectThread(): string | undefined {
  return process.env.AMP_THREAD_ID;
}

export async function insightAddCommand(options: InsightAddOptions): Promise<void> {
  const config = loadConfig();
  
  if (!options.pattern) {
    throw new Error('--pattern is required');
  }
  
  const beadId = options.bead || autoDetectBead();
  const threadId = options.thread || autoDetectThread();
  const confidence = options.confidence ?? 0.9;
  const section = options.section || 'Manual Insights';
  
  if (confidence < 0 || confidence > 1) {
    throw new Error('--confidence must be between 0 and 1');
  }
  
  const evidenceArray = options.evidence 
    ? options.evidence.split(',').map(e => e.trim()).filter(Boolean)
    : [];
  
  const insight: Insight = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    taskId: beadId || 'manual-insight',
    source: {
      runner: 'manual',
      beadIds: beadId ? [beadId] : []
    },
    signal: {
      pattern: options.pattern,
      evidence: evidenceArray
    },
    recommendation: options.pattern,
    scope: {
      files: [],
      glob: '**/*'
    },
    confidence,
    onlineEligible: true,
    delta: {
      section,
      operation: 'add',
      content: options.pattern
    },
    metaTags: ['manual'],
    thread_refs: threadId ? [threadId] : undefined
  };
  
  if (options.interactive) {
    console.log('\n📝 Insight Preview:');
    console.log(`   Pattern: ${insight.signal.pattern}`);
    console.log(`   Section: ${section}`);
    console.log(`   Confidence: ${confidence}`);
    if (beadId) console.log(`   Bead: ${beadId}`);
    if (threadId) console.log(`   Thread: ${threadId}`);
    if (evidenceArray.length > 0) {
      console.log(`   Evidence:`);
      evidenceArray.forEach(e => console.log(`     - ${e}`));
    }
    
    const proceed = await promptUser('\nSave this insight? [Y/n]: ');
    if (!proceed) {
      console.log('❌ Cancelled');
      return;
    }
  }
  
  appendFileSync(config.insightsPath, JSON.stringify(insight) + '\n', 'utf-8');
  
  if (options.json) {
    console.log(JSON.stringify({ insight, saved: true }, null, 2));
  } else {
    console.log(`✅ Insight saved to ${config.insightsPath}`);
    console.log(`   ID: ${insight.id}`);
  }
}

export async function postmortemCommand(options: PostmortemOptions): Promise<void> {
  const config = loadConfig();
  
  if (!options.bead) {
    throw new Error('--bead <bead-id> is required');
  }
  
  const metadataPath = '.beads/amp_metadata.jsonl';
  
  if (!existsSync(metadataPath)) {
    throw new Error(
      `Thread metadata not found: ${metadataPath}\n` +
      'This feature requires the thread indexer (bead 270) to be implemented.'
    );
  }
  
  const metadataContent = readFileSync(metadataPath, 'utf-8');
  const allMetadata = metadataContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  const beadMetadata = allMetadata.filter(m => m.bead_id === options.bead);
  
  if (beadMetadata.length === 0) {
    throw new Error(`No threads found for bead ${options.bead}`);
  }
  
  const threadIds = [...new Set(beadMetadata.map(m => m.thread_id))];
  
  if (options.json) {
    console.log(JSON.stringify({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Postmortem analysis requires LLM integration (pending implementation)',
        discoveredThreads: threadIds,
        beadId: options.bead
      }
    }, null, 2));
  } else {
    console.log(`⚠️  Postmortem analysis not yet implemented`);
    console.log(`   Discovered ${threadIds.length} thread(s) for bead ${options.bead}:`);
    threadIds.forEach(tid => console.log(`     - ${tid}`));
    console.log(`\n   This feature requires:`);
    console.log(`     1. Thread content fetching (read_thread tool or API)`);
    console.log(`     2. LLM analysis to extract insights from thread history`);
    console.log(`     3. Integration with insights.jsonl schema`);
  }
}
