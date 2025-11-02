import { readFile, appendFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { ExecutionTrace, BulletFeedback } from './Generator.js';
import { Insight, NormalizedError } from './mcp-types.js';

export interface PatternSignature {
  errorPattern: string;
  toolPattern: string;
  filePattern?: string;
}

export interface ErrorCluster {
  signature: PatternSignature;
  occurrences: Array<{
    beadId: string;
    traceId: string;
    errors: NormalizedError[];
  }>;
  frequency: number;
}

export class Reflector {
  private insightsPath: string;
  private tracesPath: string;

  constructor(
    insightsPath: string = '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
    tracesPath: string = '/Users/sjarmak/ACE_Beads_Amp/logs/execution_traces.jsonl'
  ) {
    this.insightsPath = insightsPath;
    this.tracesPath = tracesPath;
  }

  async analyzeTrace(trace: ExecutionTrace): Promise<Insight[]> {
    console.log(`[Reflector] Analyzing trace ${trace.trace_id} for bead ${trace.bead_id}`);
    
    const insights: Insight[] = [];

    if (trace.execution_results.length > 0) {
      const executionInsights = await this.analyzeExecutionResults(trace);
      insights.push(...executionInsights);
    }

    if (trace.discovered_issues.length > 0) {
      const discoveryInsight = await this.analyzeDiscoveryChain(trace);
      if (discoveryInsight) {
        insights.push(discoveryInsight);
      }
    }

    if (trace.bullets_consulted.length > 0) {
      const bulletInsight = await this.analyzeBulletFeedback(trace);
      if (bulletInsight) {
        insights.push(bulletInsight);
      }
    }

    for (const insight of insights) {
      await this.writeInsight(insight);
    }

    console.log(`[Reflector] Generated ${insights.length} insights from trace ${trace.trace_id}`);
    return insights;
  }

  async analyzeMultipleTraces(beadIds?: string[]): Promise<Insight[]> {
    const traces = await this.loadTraces();
    
    let tracesToAnalyze = traces;
    if (beadIds) {
      tracesToAnalyze = traces.filter((t) => beadIds.includes(t.bead_id));
    }

    console.log(`[Reflector] Analyzing ${tracesToAnalyze.length} traces for patterns`);

    const clusters = this.clusterErrors(tracesToAnalyze);
    const insights: Insight[] = [];

    for (const cluster of clusters) {
      if (cluster.frequency >= 2) {
        const insight = this.generateInsightFromCluster(cluster);
        insights.push(insight);
        await this.writeInsight(insight);
      }
    }

    console.log(`[Reflector] Generated ${insights.length} insights from ${tracesToAnalyze.length} traces`);
    return insights;
  }

  private async analyzeExecutionResults(trace: ExecutionTrace): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    const failedResults = trace.execution_results.filter((r) => r.status === 'fail');
    
    for (const result of failedResults) {
      if (result.errors.length === 0) continue;

      const errorsByTool = this.groupErrorsByTool(result.errors);

      for (const [tool, errors] of Object.entries(errorsByTool)) {
        const pattern = this.extractErrorPattern(errors);
        const recommendation = this.generateRecommendation(tool, pattern, errors);
        
        const filePatterns = this.extractFilePatterns(errors);
        
        insights.push({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          taskId: trace.bead_id,
          source: {
            runner: tool,
            beadIds: [trace.bead_id],
          },
          signal: {
            pattern,
            evidence: errors.map((e) => `${e.file}:${e.line} - ${e.message}`),
          },
          recommendation,
          scope: {
            files: filePatterns.length > 0 ? filePatterns : undefined,
          },
          confidence: this.calculateConfidence(errors, 1),
          onlineEligible: this.isOnlineEligible(this.calculateConfidence(errors, 1)),
          metaTags: [tool, 'error-pattern', trace.outcome],
          delta: `[Bullet #${randomUUID().slice(0, 8)}] ${pattern} - ${recommendation}`,
        });
      }
    }

    return insights;
  }

  private async analyzeDiscoveryChain(trace: ExecutionTrace): Promise<Insight | null> {
    if (trace.discovered_issues.length === 0) return null;

    const pattern = `Discovered ${trace.discovered_issues.length} related issues during ${trace.task_description}`;
    const recommendation = `When working on similar tasks, consider: ${trace.discovered_issues.join(', ')}`;

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      taskId: trace.bead_id,
      source: {
        beadIds: [trace.bead_id, ...trace.discovered_issues],
      },
      signal: {
        pattern: 'discovery-chain',
        evidence: trace.discovered_issues.map((id) => `Discovered issue: ${id}`),
      },
      recommendation,
      scope: {},
      confidence: trace.discovered_issues.length >= 3 ? 0.85 : 0.65,
      onlineEligible: trace.discovered_issues.length >= 3,
      metaTags: ['discovery', 'meta-pattern'],
      delta: `[Bullet #${randomUUID().slice(0, 8)}] ${pattern} - ${recommendation}`,
    };
  }

  private async analyzeBulletFeedback(trace: ExecutionTrace): Promise<Insight | null> {
    const harmfulBullets = trace.bullets_consulted.filter((b) => b.feedback === 'harmful');
    
    if (harmfulBullets.length === 0) return null;

    const pattern = `Bullets marked harmful: ${harmfulBullets.map((b) => b.bullet_id).join(', ')}`;
    const evidence = harmfulBullets.map((b) => `${b.bullet_id}: ${b.reason}`);

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      taskId: trace.bead_id,
      source: {
        beadIds: [trace.bead_id],
      },
      signal: {
        pattern: 'harmful-bullet-feedback',
        evidence,
      },
      recommendation: 'Review these bullets for removal or refinement',
      scope: {},
      confidence: 0.75,
      onlineEligible: false,
      metaTags: ['bullet-feedback', 'review-needed'],
      delta: `[Bullet #${randomUUID().slice(0, 8)}] ${pattern} - Review these bullets for removal or refinement`,
    };
  }

  private clusterErrors(traces: ExecutionTrace[]): ErrorCluster[] {
    const clusters = new Map<string, ErrorCluster>();

    for (const trace of traces) {
      for (const result of trace.execution_results) {
        if (result.status !== 'fail') continue;

        for (const error of result.errors) {
          const signature = this.computeSignature(error);
          const key = JSON.stringify(signature);

          if (!clusters.has(key)) {
            clusters.set(key, {
              signature,
              occurrences: [],
              frequency: 0,
            });
          }

          const cluster = clusters.get(key)!;
          cluster.occurrences.push({
            beadId: trace.bead_id,
            traceId: trace.trace_id,
            errors: [error],
          });
          cluster.frequency++;
        }
      }
    }

    return Array.from(clusters.values()).sort((a, b) => b.frequency - a.frequency);
  }

  private generateInsightFromCluster(cluster: ErrorCluster): Insight {
    const beadIds = [...new Set(cluster.occurrences.map((o) => o.beadId))];
    const allErrors = cluster.occurrences.flatMap((o) => o.errors);
    
    const pattern = this.extractErrorPattern(allErrors);
    const recommendation = this.generateRecommendation(
      cluster.signature.toolPattern,
      pattern,
      allErrors
    );

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      taskId: beadIds[0],
      source: {
        runner: cluster.signature.toolPattern,
        beadIds,
      },
      signal: {
        pattern,
        evidence: allErrors.map((e) => `${e.file}:${e.line} - ${e.message}`),
      },
      recommendation,
      scope: {
        glob: cluster.signature.filePattern,
      },
      confidence: this.calculateConfidence(allErrors, beadIds.length),
      onlineEligible: this.isOnlineEligible(this.calculateConfidence(allErrors, beadIds.length)),
      metaTags: ['recurring-error', cluster.signature.toolPattern, `frequency-${cluster.frequency}`],
      delta: `[Bullet #${randomUUID().slice(0, 8)}] ${pattern} - ${recommendation}`,
    };
  }

  private computeSignature(error: NormalizedError): PatternSignature {
    let errorPattern = error.message
      .replace(/['"]/g, '')
      .replace(/\d+/g, 'N')
      .substring(0, 100);

    // Abstract TypeScript type errors to a higher-level pattern
    if (error.tool === 'tsc') {
      if (errorPattern.includes('not assignable to') || errorPattern.includes('Type')) {
        errorPattern = 'TypeScript type mismatch error';
      } else if (errorPattern.includes('Cannot find module') || errorPattern.includes('module')) {
        errorPattern = 'TypeScript module resolution error';
      }
    }

    const fileExt = error.file.split('.').pop() || '';
    const filePattern = fileExt ? `**/*.${fileExt}` : undefined;

    return {
      errorPattern,
      toolPattern: error.tool,
      filePattern,
    };
  }

  private groupErrorsByTool(errors: NormalizedError[]): Record<string, NormalizedError[]> {
    const grouped: Record<string, NormalizedError[]> = {};
    
    for (const error of errors) {
      if (!grouped[error.tool]) {
        grouped[error.tool] = [];
      }
      grouped[error.tool].push(error);
    }
    
    return grouped;
  }

  private extractErrorPattern(errors: NormalizedError[]): string {
    if (errors.length === 1) {
      return errors[0].message;
    }

    const commonWords = this.findCommonWords(errors.map((e) => e.message));
    if (commonWords.length > 0) {
      return commonWords.join(' ');
    }

    return `Multiple ${errors[0].tool} errors (${errors.length} occurrences)`;
  }

  private findCommonWords(messages: string[]): string[] {
    if (messages.length === 0) return [];
    
    const wordSets = messages.map((msg) => 
      new Set(msg.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
    );

    const firstSet = wordSets[0];
    const common: string[] = [];

    for (const word of firstSet) {
      if (wordSets.every((set) => set.has(word))) {
        common.push(word);
      }
    }

    return common.slice(0, 5);
  }

  private extractFilePatterns(errors: NormalizedError[]): string[] {
    const files = [...new Set(errors.map((e) => e.file))];
    return files.slice(0, 5);
  }

  private generateRecommendation(tool: string, pattern: string, errors: NormalizedError[]): string {
    if (tool === 'tsc') {
      if (pattern.includes('type') || pattern.includes('Type')) {
        return 'Run npm run build before npm test to catch type errors early';
      }
      if (pattern.includes('module') || pattern.includes('import')) {
        return 'Ensure TypeScript imports use .js extension for ESM modules';
      }
    }

    if (tool === 'eslint') {
      return `Fix ESLint ${errors[0].severity} issues: ${pattern}`;
    }

    if (tool === 'vitest') {
      return `Address test failures: ${pattern}`;
    }

    return `Fix ${tool} errors: ${pattern}`;
  }

  private calculateConfidence(errors: NormalizedError[], beadCount: number): number {
    let confidence = 0.5;

    if (beadCount >= 3) confidence += 0.2;
    if (beadCount >= 5) confidence += 0.1;

    if (errors.every((e) => e.severity === 'error')) confidence += 0.1;

    const uniqueFiles = new Set(errors.map((e) => e.file));
    if (uniqueFiles.size >= 3) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private isOnlineEligible(confidence: number): boolean {
    return confidence >= 0.8;
  }

  private async loadTraces(): Promise<ExecutionTrace[]> {
    try {
      const content = await readFile(this.tracesPath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private async writeInsight(insight: Insight): Promise<void> {
    await appendFile(this.insightsPath, JSON.stringify(insight) + '\n');
    console.log(`[Reflector] Wrote insight ${insight.id} (confidence: ${insight.confidence})`);
  }
}
