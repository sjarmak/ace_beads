import { aceSubagents } from './ace-subagents.js';
import { Evaluator } from './Evaluator.js';
import { readFile, writeFile, copyFile } from 'fs/promises';
import { loadConfig } from './config.js';
import { randomUUID } from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const customSubagentPath = pathToFileURL(resolve(__dirname, '../../../../custom-subagent/src/index.js')).href;

export interface ACELoopOptions {
  mode: 'online' | 'offline';
  minConfidence?: number;
  maxDeltas?: number;
  beadIds?: string[];
  dryRun?: boolean;
}

export interface ACELoopResult {
  accepted: boolean;
  iterations: number;
  finalPlaybook: string;
  metrics: {
    bulletsAdded: number;
    bulletsPruned: number;
    netScoreChange: number;
  };
  history: Array<{
    iteration: number;
    action: string;
    result: string;
  }>;
}

export class ACELoop {
  private config = loadConfig();
  private evaluator = new Evaluator();
  private playbookPath: string;
  private tracesPath: string;
  private insightsPath: string;
  private runSubagent: any;

  constructor() {
    this.playbookPath = this.config.agentsPath;
    this.tracesPath = this.config.tracesPath;
    this.insightsPath = this.config.insightsPath;
  }

  private async loadSubagentRunner(): Promise<void> {
    if (!this.runSubagent) {
      const module = await import(customSubagentPath);
      this.runSubagent = module.runSubagent;
    }
  }

  async run(
    taskId: string,
    taskDescription: string,
    options: ACELoopOptions
  ): Promise<ACELoopResult> {
    const { mode, minConfidence = 0.8, maxDeltas = 3, dryRun = false } = options;
    
    // Load the subagent runner
    await this.loadSubagentRunner();
    
    console.log(`\n🔄 ACE Loop - ${mode} mode`);
    console.log(`Task: ${taskId} - ${taskDescription}\n`);

    const history: ACELoopResult['history'] = [];
    let iterations = 0;
    let bulletsAdded = 0;
    let bulletsPruned = 0;
    let netScoreChange = 0;

    // Step 1: Load current playbook P
    const P = await this.loadPlaybook();
    const P_initial = P;
    
    history.push({
      iteration: ++iterations,
      action: 'init',
      result: `Loaded playbook with ${this.countBullets(P)} bullets`,
    });

    // Step 2: Generator runs task using P, produces output y and trace t
    console.log('📝 Step 1: Generator executing task...');
    const generatorContext = this.buildGeneratorContext(P, taskId, taskDescription);
    
    const generatorResult = await this.runSubagent(
      'ace-generator',
      `Execute task: ${taskDescription}`,
      aceSubagents,
      { context: generatorContext, timeout: 300000 }
    );

    history.push({
      iteration: ++iterations,
      action: 'generate',
      result: generatorResult.summary,
    });

    // Parse trace from generator output
    const trace = this.parseTrace(generatorResult);
    
    if (!trace) {
      console.log('⚠️  No trace produced by generator');
      return {
        accepted: false,
        iterations,
        finalPlaybook: P,
        metrics: { bulletsAdded: 0, bulletsPruned: 0, netScoreChange: 0 },
        history,
      };
    }

    // Save trace
    await this.saveTrace(trace);

    // Step 3: Reflector inspects t, extracts insights s and drafts deltas d
    console.log('\n🔍 Step 2: Reflector analyzing trace...');
    const reflectorContext = this.buildReflectorContext(trace, P);
    
    const reflectorResult = await this.runSubagent(
      'ace-reflector',
      `Analyze execution trace and extract insights with confidence >= ${minConfidence}`,
      aceSubagents,
      { context: reflectorContext, timeout: 180000 }
    );

    history.push({
      iteration: ++iterations,
      action: 'reflect',
      result: reflectorResult.summary,
    });

    const insights = this.parseInsights(reflectorResult);
    
    if (insights.length === 0) {
      console.log('ℹ️  No high-confidence insights extracted');
      return {
        accepted: false,
        iterations,
        finalPlaybook: P,
        metrics: { bulletsAdded: 0, bulletsPruned: 0, netScoreChange: 0 },
        history,
      };
    }

    // Save insights
    await this.saveInsights(insights);

    // Step 4: Curator validates d, dedupes, refines, produces P′
    console.log('\n🎯 Step 3: Curator validating and applying deltas...');
    const curatorContext = this.buildCuratorContext(insights, P, maxDeltas);
    
    const curatorPrompt =
      `Validate ${insights.length} insights, deduplicate, ` +
      `and compose P′ with max ${maxDeltas} deltas`;
    const curatorResult = await this.runSubagent(
      'ace-curator',
      curatorPrompt,
      aceSubagents,
      { context: curatorContext, timeout: 180000 }
    );

    history.push({
      iteration: ++iterations,
      action: 'curate',
      result: curatorResult.summary,
    });

    const P_prime = this.parseCuratedPlaybook(curatorResult);
    
    if (!P_prime || P_prime === P) {
      console.log('ℹ️  No changes proposed by curator');
      return {
        accepted: false,
        iterations,
        finalPlaybook: P,
        metrics: { bulletsAdded: 0, bulletsPruned: 0, netScoreChange: 0 },
        history,
      };
    }

    // Step 5: Evaluate P′ vs P - accept if metrics improve, else revert
    console.log('\n⚖️  Step 4: Evaluating P′ vs P...');
    const evaluation = await this.evaluator.evaluate(P, P_prime);

    history.push({
      iteration: ++iterations,
      action: 'evaluate',
      result: `${evaluation.improved ? 'ACCEPT' : 'REJECT'} - ${evaluation.reason}`,
    });

    console.log(`\nEvaluation: ${evaluation.improved ? '✅ ACCEPT' : '❌ REJECT'}`);
    console.log(`Reason: ${evaluation.reason}`);
    const sign = evaluation.delta.netScore >= 0 ? '+' : '';
    const netScoreMsg = `Net score: ${evaluation.currentMetrics.netScore} → ` +
      `${evaluation.candidateMetrics.netScore} (${sign}${evaluation.delta.netScore})`;
    console.log(netScoreMsg);

    if (evaluation.improved) {
      bulletsAdded = evaluation.delta.totalBullets > 0 ? evaluation.delta.totalBullets : 0;
      netScoreChange = evaluation.delta.netScore;

      if (!dryRun) {
        // Accept: P ← P′
        await this.savePlaybook(P_prime);
        console.log('✅ Playbook updated: P ← P′');
      } else {
        console.log('🔍 [DRY RUN] Would update playbook: P ← P′');
      }

      // Step 6: Persist artifacts
      await this.persistArtifacts(trace, insights, P_prime);

      return {
        accepted: true,
        iterations,
        finalPlaybook: P_prime,
        metrics: { bulletsAdded, bulletsPruned, netScoreChange },
        history,
      };
    } else {
      console.log('❌ Playbook unchanged (P′ rejected)');
      return {
        accepted: false,
        iterations,
        finalPlaybook: P,
        metrics: { bulletsAdded: 0, bulletsPruned: 0, netScoreChange: 0 },
        history,
      };
    }
  }

  async runOfflineBatch(
    beadIds: string[],
    options: Omit<ACELoopOptions, 'mode'>
  ): Promise<ACELoopResult[]> {
    console.log(`\n🔄 ACE Offline Batch Mode - ${beadIds.length} beads\n`);
    
    const results: ACELoopResult[] = [];
    
    for (const beadId of beadIds) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Processing bead: ${beadId}`);
      console.log('='.repeat(60));
      
      const result = await this.run(beadId, `Batch learn from bead ${beadId}`, {
        ...options,
        mode: 'offline',
      });
      
      results.push(result);
    }
    
    const accepted = results.filter(r => r.accepted).length;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Batch complete: ${accepted}/${beadIds.length} playbook updates accepted`);
    console.log(`${'='.repeat(60)}\n`);
    
    return results;
  }

  private async loadPlaybook(): Promise<string> {
    return await readFile(this.playbookPath, 'utf-8');
  }

  private async savePlaybook(content: string): Promise<void> {
    await writeFile(this.playbookPath, content, 'utf-8');
  }

  private countBullets(playbook: string): number {
    const bulletRegex = /\[Bullet #\S+, helpful:\d+, harmful:\d+(?:, [^\]]+)?\]/g;
    return (playbook.match(bulletRegex) || []).length;
  }

  private buildGeneratorContext(playbook: string, taskId: string, taskDescription: string): string {
    const bullets = this.extractBullets(playbook);
    
    return `TASK CONTEXT:
Bead ID: ${taskId}
Task: ${taskDescription}

PLAYBOOK BULLETS (consult these during work):
${bullets.map(b =>
  `- [${b.id}] ${b.content} (helpful:${b.helpful}, harmful:${b.harmful})`
).join('\n')}

INSTRUCTIONS:
1. Execute the task using available tools
2. Consult relevant bullets before making decisions
3. Mark bullets as helpful/harmful based on usefulness
4. Record ALL execution results (build/test/lint outcomes)
5. Track discovered issues
6. Output structured trace JSON at the end`;
  }

  private buildReflectorContext(trace: any, playbook: string): string {
    return `EXECUTION TRACE:
${JSON.stringify(trace, null, 2)}

CURRENT PLAYBOOK:
${playbook}

INSTRUCTIONS:
Analyze this trace and extract insights with confidence scores.
Focus on:
- Error patterns and frequencies
- Bullet feedback (harmful bullets to remove/refine)
- Discovery chains
- Cross-trace patterns

Output insights as JSON array with: pattern, evidence, recommendation, confidence, delta`;
  }

  private buildCuratorContext(insights: any[], playbook: string, maxDeltas: number): string {
    return `INSIGHTS TO VALIDATE:
${JSON.stringify(insights, null, 2)}

CURRENT PLAYBOOK:
${playbook}

MAX DELTAS: ${maxDeltas}

INSTRUCTIONS:
1. Deduplicate insights against existing bullets
2. Refine wording for clarity
3. Route to appropriate sections
4. Prune bullets with net score < -3
5. Compose P′ with validated deltas
6. Output updated playbook text`;
  }

  private parseTrace(result: any): any {
    try {
      // Look for JSON in transcript
      const jsonMatch = result.transcript.join('\n').match(/\{[\s\S]*"trace_id"[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}
    return null;
  }

  private parseInsights(result: any): any[] {
    try {
      const jsonMatch = result.transcript.join('\n').match(/\[[\s\S]*"pattern"[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}
    return [];
  }

  private parseCuratedPlaybook(result: any): string | null {
    // Extract updated playbook from curator output
    const text = result.transcript.join('\n');
    const playbookMatch = text.match(/```(?:markdown)?\n([\s\S]*?)\n```/);
    if (playbookMatch) {
      return playbookMatch[1];
    }
    return null;
  }

  private extractBullets(
    playbook: string
  ): Array<{ id: string; content: string; helpful: number; harmful: number }> {
    const bullets: Array<{
      id: string;
      content: string;
      helpful: number;
      harmful: number;
    }> = [];
    const lines = playbook.split('\n');
    const bulletRegex = /\[Bullet #(\S+), helpful:(\d+), harmful:(\d+)(?:, [^\]]+)?\] (.+)/;

    for (const line of lines) {
      const match = line.match(bulletRegex);
      if (match) {
        bullets.push({
          id: match[1],
          content: match[4],
          helpful: parseInt(match[2]),
          harmful: parseInt(match[3]),
        });
      }
    }

    return bullets;
  }

  private async saveTrace(trace: any): Promise<void> {
    const { appendFile } = await import('fs/promises');
    await appendFile(this.tracesPath, JSON.stringify(trace) + '\n');
  }

  private async saveInsights(insights: any[]): Promise<void> {
    const { appendFile } = await import('fs/promises');
    for (const insight of insights) {
      await appendFile(this.insightsPath, JSON.stringify(insight) + '\n');
    }
  }

  private async persistArtifacts(trace: any, insights: any[], playbook: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const artifactDir = `${this.config.logsDir}/artifacts/${timestamp}`;
    
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(artifactDir, { recursive: true });
    
    await writeFile(`${artifactDir}/trace.json`, JSON.stringify(trace, null, 2));
    await writeFile(`${artifactDir}/insights.json`, JSON.stringify(insights, null, 2));
    await writeFile(`${artifactDir}/playbook.md`, playbook);
    
    console.log(`\n📦 Artifacts saved to ${artifactDir}`);
  }

  async getTracesForBead(beadId: string, sinceTimestamp?: string): Promise<any[]> {
    const content = await readFile(this.tracesPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const traces = [];
    
    for (const line of lines) {
      try {
        const trace = JSON.parse(line);
        if (trace.bead_id === beadId) {
          if (!sinceTimestamp || trace.timestamp > sinceTimestamp) {
            traces.push(trace);
          }
        }
      } catch {}
    }
    
    return traces;
  }

  async runWithTrace(trace: any, options: ACELoopOptions): Promise<ACELoopResult> {
    const { minConfidence = 0.8, maxDeltas = 3, dryRun = false } = options;
    
    await this.loadSubagentRunner();
    
    console.log(`\n🔄 ACE Loop - learning from trace ${trace.trace_id}`);
    console.log(`Task: ${trace.bead_id} - ${trace.task_description}\n`);

    const history: ACELoopResult['history'] = [];
    let iterations = 0;
    let bulletsAdded = 0;
    let netScoreChange = 0;

    const P = await this.loadPlaybook();
    
    history.push({
      iteration: ++iterations,
      action: 'init',
      result: `Loaded playbook with ${this.countBullets(P)} bullets`,
    });

    console.log('🔍 Step 1: Reflector analyzing trace...');
    const reflectorContext = this.buildReflectorContext(trace, P);
    
    const reflectorResult = await this.runSubagent(
      'ace-reflector',
      `Analyze execution trace and extract insights with confidence >= ${minConfidence}`,
      aceSubagents,
      { context: reflectorContext, timeout: 180000 }
    );

    history.push({
      iteration: ++iterations,
      action: 'reflect',
      result: reflectorResult.summary,
    });

    const insights = this.parseInsights(reflectorResult);
    
    if (insights.length === 0) {
      console.log('ℹ️  No high-confidence insights extracted');
      return {
        accepted: false,
        iterations,
        finalPlaybook: P,
        metrics: { bulletsAdded: 0, bulletsPruned: 0, netScoreChange: 0 },
        history,
      };
    }

    await this.saveInsights(insights);

    console.log('\n🎯 Step 2: Curator validating and applying deltas...');
    const curatorContext = this.buildCuratorContext(insights, P, maxDeltas);
    
    const curatorPrompt =
      `Validate ${insights.length} insights, deduplicate, ` +
      `and compose P′ with max ${maxDeltas} deltas`;
    const curatorResult = await this.runSubagent(
      'ace-curator',
      curatorPrompt,
      aceSubagents,
      { context: curatorContext, timeout: 180000 }
    );

    history.push({
      iteration: ++iterations,
      action: 'curate',
      result: curatorResult.summary,
    });

    const P_prime = this.parseCuratedPlaybook(curatorResult);
    
    if (!P_prime || P_prime === P) {
      console.log('ℹ️  No changes proposed by curator');
      return {
        accepted: false,
        iterations,
        finalPlaybook: P,
        metrics: { bulletsAdded: 0, bulletsPruned: 0, netScoreChange: 0 },
        history,
      };
    }

    console.log('\n⚖️  Step 3: Evaluating P′ vs P...');
    const evaluation = await this.evaluator.evaluate(P, P_prime);

    history.push({
      iteration: ++iterations,
      action: 'evaluate',
      result: `${evaluation.improved ? 'ACCEPT' : 'REJECT'} - ${evaluation.reason}`,
    });

    console.log(`\nEvaluation: ${evaluation.improved ? '✅ ACCEPT' : '❌ REJECT'}`);
    console.log(`Reason: ${evaluation.reason}`);
    const sign = evaluation.delta.netScore >= 0 ? '+' : '';
    const netScoreMsg = `Net score: ${evaluation.currentMetrics.netScore} → ` +
      `${evaluation.candidateMetrics.netScore} (${sign}${evaluation.delta.netScore})`;
    console.log(netScoreMsg);

    if (evaluation.improved) {
      bulletsAdded = evaluation.delta.totalBullets > 0 ? evaluation.delta.totalBullets : 0;
      netScoreChange = evaluation.delta.netScore;

      if (!dryRun) {
        await this.savePlaybook(P_prime);
        console.log('✅ Playbook updated: P ← P′');
      } else {
        console.log('🔍 [DRY RUN] Would update playbook: P ← P′');
      }

      await this.persistArtifacts(trace, insights, P_prime);

      return {
        accepted: true,
        iterations,
        finalPlaybook: P_prime,
        metrics: { bulletsAdded, bulletsPruned: 0, netScoreChange },
        history,
      };
    } else {
      console.log('❌ Playbook unchanged (P′ rejected)');
      return {
        accepted: false,
        iterations,
        finalPlaybook: P,
        metrics: { bulletsAdded: 0, bulletsPruned: 0, netScoreChange: 0 },
        history,
      };
    }
  }

  async watchBead(beadId: string, options: ACELoopOptions): Promise<void> {
    const { watch: fsWatch } = await import('fs');
    const seenTraceIds = new Set<string>();
    let lastTimestamp = new Date().toISOString();

    console.log(`\n👁️  Watching traces for bead ${beadId}...`);
    console.log('Press Ctrl+C to stop\n');

    const checkNewTraces = async () => {
      const traces = await this.getTracesForBead(beadId, lastTimestamp);
      
      for (const trace of traces) {
        if (!seenTraceIds.has(trace.trace_id)) {
          seenTraceIds.add(trace.trace_id);
          lastTimestamp = trace.timestamp;
          
          console.log(`\n📍 New trace detected: ${trace.trace_id}`);
          await this.runWithTrace(trace, options);
        }
      }
    };

    const watcher = fsWatch(this.tracesPath, { persistent: true }, async (eventType) => {
      if (eventType === 'change') {
        setTimeout(checkNewTraces, 2000);
      }
    });

    await checkNewTraces();

    return new Promise(() => {
      process.on('SIGINT', () => {
        console.log('\n\n👋 Stopping watch...');
        watcher.close();
        process.exit(0);
      });
    });
  }

  async runOfflineEpochs(
    beadIds: string[],
    epochs: number = 3,
    options: Omit<ACELoopOptions, 'mode'>
  ): Promise<{ epochResults: ACELoopResult[][]; summary: any }> {
    console.log(`\n🔄 ACE Offline Multi-Epoch Learning`);
    console.log(`Beads: ${beadIds.length}, Epochs: ${epochs}\n`);
    
    const epochResults: ACELoopResult[][] = [];
    
    for (let epoch = 1; epoch <= epochs; epoch++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`EPOCH ${epoch}/${epochs}`);
      console.log('='.repeat(60));
      
      const shuffledBeads = [...beadIds].sort(() => Math.random() - 0.5);
      const results: ACELoopResult[] = [];
      
      for (const beadId of shuffledBeads) {
        console.log(`\nProcessing bead: ${beadId}`);
        
        const traces = await this.getTracesForBead(beadId);
        
        if (traces.length === 0) {
          console.log(`⚠️  No traces found for ${beadId}`);
          continue;
        }
        
        for (const trace of traces) {
          const result = await this.runWithTrace(trace, {
            ...options,
            mode: 'offline'
          });
          results.push(result);
        }
      }
      
      epochResults.push(results);
      
      const accepted = results.filter(r => r.accepted).length;
      console.log(`\nEpoch ${epoch} complete: ${accepted}/${results.length} updates accepted`);
      
      if (accepted === 0) {
        console.log('⚠️  No updates accepted this epoch, stopping early');
        break;
      }
      
      if (epoch < epochs) {
        console.log('\n🧹 Pruning low-performing bullets...');
        const pruned = await this.evaluator.pruneUnhelpfulBullets(-3);
        console.log(`Pruned ${pruned} bullets with net score < -3`);
      }
    }
    
    const totalAccepted = epochResults.flat().filter(r => r.accepted).length;
    const totalProcessed = epochResults.flat().length;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Multi-epoch learning complete!`);
    console.log(`Total: ${totalAccepted}/${totalProcessed} updates accepted across ${epochResults.length} epochs`);
    console.log(`${'='.repeat(60)}\n`);
    
    return {
      epochResults,
      summary: {
        totalEpochs: epochResults.length,
        totalAccepted,
        totalProcessed,
        acceptanceRate: totalProcessed > 0 ? totalAccepted / totalProcessed : 0
      }
    };
  }
}
