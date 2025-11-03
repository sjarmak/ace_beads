import { loadConfig } from '../lib/config.js';
import { DeltaQueue } from '../lib/deltas.js';
import { DeltaMerger } from '../lib/merger.js';
import { KnowledgeManager } from '../lib/knowledge.js';
import { spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(spawn);

export interface ApplyOptions {
  id?: string[];
  dryRun?: boolean;
  json?: boolean;
  noBranch?: boolean;
}

export interface ApplyResult {
  accepted: string[];
  rejected: Array<{ id: string; reason: string; details?: string }>;
  stats: {
    total: number;
    accepted: number;
    rejected: number;
  };
  dryRun: boolean;
}

export async function applyCommand(options: ApplyOptions): Promise<void> {
  const config = loadConfig();
  const queuePath = config.deltaQueue || '.ace/delta-queue.json';
  const queue = new DeltaQueue(queuePath);
  
  const knowledgeDir = 'knowledge';
  const agentsMdPath = config.agentsPath || 'knowledge/AGENTS.md';
  const playbookPath = 'knowledge/playbook.yaml';

  const km = new KnowledgeManager(knowledgeDir, agentsMdPath, playbookPath);
  const merger = new DeltaMerger(config.learning?.confidenceMin || 0.80);

  // Load deltas from queue
  let deltas = await queue.read();
  
  // Filter by IDs if specified
  if (options.id && options.id.length > 0) {
    deltas = deltas.filter((d) => options.id!.includes(d.id));
  }

  if (deltas.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ message: 'No deltas to apply' }, null, 2));
    } else {
      console.log('No deltas to apply');
    }
    return;
  }

  // Load existing AGENTS.md
  const agentsMd = await km.loadAgentsMd();
  const strippedContent = km.stripFrontMatter(agentsMd);
  const existingBullets = merger.parseBullets(strippedContent);

  // Merge deltas
  const mergeResult = merger.merge(existingBullets, deltas);

  const result: ApplyResult = {
    accepted: mergeResult.accepted,
    rejected: mergeResult.rejected,
    stats: {
      total: deltas.length,
      accepted: mergeResult.accepted.length,
      rejected: mergeResult.rejected.length,
    },
    dryRun: options.dryRun || false,
  };

  if (options.dryRun) {
    // Preview mode
    const serialized = merger.serializeBullets(mergeResult.bullets);
    
    if (options.json) {
      console.log(JSON.stringify({
        ...result,
        preview: serialized,
      }, null, 2));
    } else {
      console.log('Dry Run - Preview:\n');
      console.log(serialized);
      const summary =
        `\nWould accept ${result.accepted.length} deltas, ` +
        `reject ${result.rejected.length}`;
      console.log(summary);
      
      if (result.rejected.length > 0) {
        console.log('\nRejected:');
        for (const r of result.rejected) {
          console.log(`  ${r.id}: ${r.reason} - ${r.details || 'N/A'}`);
        }
      }
    }
    return;
  }

  // Apply changes
  const serialized = merger.serializeBullets(mergeResult.bullets);
  const fullContent = await km.generateAgentsMd(mergeResult.bullets, serialized);
  
  await km.writeAgentsMd(fullContent);
  await km.updatePlaybook(mergeResult.bullets);

  // Remove accepted deltas from queue
  await queue.dequeue(mergeResult.accepted);

  // Create git branch and commit if not disabled
  if (!options.noBranch) {
    try {
      await gitCommit(mergeResult.accepted.length);
    } catch (err) {
      console.warn('Warning: Could not create git commit:', err);
    }
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`✅ Applied ${result.accepted.length} deltas`);
    console.log(`❌ Rejected ${result.rejected.length} deltas`);
    
    if (result.rejected.length > 0) {
      console.log('\nRejected:');
      for (const r of result.rejected) {
        console.log(`  ${r.id}: ${r.reason} - ${r.details || 'N/A'}`);
      }
    }

    if (!options.noBranch) {
      console.log('\n📝 Committed on branch ace/curations');
    }
  }
}

async function gitCommit(count: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create branch
    const branchProc = spawn('git', ['checkout', '-b', 'ace/curations'], {
      shell: true,
      stdio: 'pipe',
    });

    branchProc.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        // Ignore if branch exists (code 1)
        reject(new Error(`git checkout failed: ${code}`));
        return;
      }

      // Add files
      const addProc = spawn('git', ['add', 'knowledge/', 'prompts/'], {
        shell: true,
        stdio: 'pipe',
      });

      addProc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`git add failed: ${code}`));
          return;
        }

        // Commit
        const commitProc = spawn('git', [
          'commit',
          '-m',
          `ACE: apply ${count} delta${count !== 1 ? 's' : ''}`,
        ], {
          shell: true,
          stdio: 'pipe',
        });

        commitProc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`git commit failed: ${code}`));
          }
        });

        commitProc.on('error', reject);
      });

      addProc.on('error', reject);
    });

    branchProc.on('error', reject);
  });
}
