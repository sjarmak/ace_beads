import { readFileSync, appendFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { loadConfig } from '../lib/config.js';

interface AnalyzeOptions {
  mode: 'single' | 'batch';
  trace?: string;
  beads?: string;
  minConfidence?: number;
  minFrequency?: number;
  dryRun?: boolean;
  json?: boolean;
}

interface Insight {
  id: string;
  timestamp: string;
  taskId: string;
  source: {
    runner?: string;
    beadIds: string[];
  };
  signal: {
    pattern: string;
    evidence: string[];
  };
  recommendation: string;
  scope: {
    files?: string[];
    glob?: string;
  };
  confidence: number;
  onlineEligible: boolean;
  metaTags: string[];
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const config = loadConfig();
  
  if (!existsSync(config.tracesPath)) {
    throw new Error(`Traces file not found: ${config.tracesPath}`);
  }
  
  // Load traces
  const tracesContent = readFileSync(config.tracesPath, 'utf-8');
  const allTraces = tracesContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  let tracesToAnalyze = allTraces;
  
  // Filter by mode
  if (options.mode === 'single') {
    if (!options.trace) {
      throw new Error('--trace <id> required for single mode');
    }
    tracesToAnalyze = allTraces.filter(t => t.trace_id === options.trace);
    if (tracesToAnalyze.length === 0) {
      throw new Error(`Trace not found: ${options.trace}`);
    }
  } else if (options.mode === 'batch' && options.beads) {
    const beadIds = options.beads.split(',').map(s => s.trim());
    tracesToAnalyze = allTraces.filter(t => beadIds.includes(t.bead_id));
  }
  
  // Analyze traces and generate insights
  const insights: Insight[] = [];
  
  for (const trace of tracesToAnalyze) {
    // Skip successful traces
    if (trace.outcome === 'success') continue;
    
    // Analyze each execution result
    for (const exec of trace.execution_results || []) {
      if (exec.status === 'fail' && exec.errors && exec.errors.length > 0) {
        // Group errors by pattern
        const errorsByPattern = new Map<string, any[]>();
        
        for (const error of exec.errors) {
          const pattern = inferPattern(error);
          if (!errorsByPattern.has(pattern)) {
            errorsByPattern.set(pattern, []);
          }
          errorsByPattern.get(pattern)!.push(error);
        }
        
        // Create insights for each pattern
        for (const [pattern, errors] of errorsByPattern) {
          const confidence = calculateConfidence(errors, tracesToAnalyze.length);
          
          if (options.minConfidence && confidence < options.minConfidence) {
            continue;
          }
          
          const insight: Insight = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            taskId: trace.bead_id,
            source: {
              runner: exec.runner,
              beadIds: [trace.bead_id]
            },
            signal: {
              pattern,
              evidence: errors.map(e => `${e.file}:${e.line}: ${e.message}`)
            },
            recommendation: generateRecommendation(pattern, errors[0]),
            scope: {
              files: errors.map(e => e.file),
              glob: inferGlob(errors.map(e => e.file))
            },
            confidence,
            onlineEligible: confidence >= 0.8,
            metaTags: inferTags(exec.runner, errors[0])
          };
          
          insights.push(insight);
        }
      }
    }
  }
  
  // Write insights
  if (!options.dryRun && insights.length > 0) {
    for (const insight of insights) {
      appendFileSync(config.insightsPath, JSON.stringify(insight) + '\n', 'utf-8');
    }
  }
  
  // Output
  if (options.json) {
    console.log(JSON.stringify({
      insights,
      tracesAnalyzed: tracesToAnalyze.length,
      written: !options.dryRun
    }, null, 2));
  } else {
    console.log(`✅ Analysis complete`);
    console.log(`   Traces analyzed: ${tracesToAnalyze.length}`);
    console.log(`   Insights generated: ${insights.length}`);
    if (!options.dryRun) {
      console.log(`   Saved to: ${config.insightsPath}`);
    } else {
      console.log(`   (Dry run - not saved)`);
    }
    
    if (insights.length > 0) {
      console.log(`\n📊 Top insights:`);
      insights.slice(0, 3).forEach(i => {
        console.log(`   • ${i.signal.pattern} (confidence: ${i.confidence.toFixed(2)})`);
      });
    }
  }
}

function inferPattern(error: any): string {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('explicit file extensions') || (msg.includes('relative import') && msg.includes('.js'))) {
    return 'TypeScript ESM import missing .js extension';
  }
  if (msg.includes('cannot find module') && msg.includes('.js')) {
    return 'TypeScript ESM import missing .js extension';
  }
  if (msg.includes('cannot find module')) {
    return 'Module not found';
  }
  if (msg.includes('type') && msg.includes('not assignable')) {
    return 'Type mismatch';
  }
  if (msg.includes('undefined') || msg.includes('null')) {
    return 'Null/undefined reference';
  }
  
  return 'Generic error pattern';
}

function calculateConfidence(errors: any[], totalTraces: number): number {
  // Simple confidence: more errors = higher confidence
  // Start with higher base to ensure single errors can pass default threshold
  const base = Math.min(errors.length / 2, 0.7);
  const frequency = Math.min(errors.length / totalTraces, 0.3);
  return Math.min(base + frequency, 1.0);
}

function generateRecommendation(pattern: string, error: any): string {
  if (pattern.includes('ESM import missing .js')) {
    return 'Always use .js extensions in import statements for TypeScript files when using ESM module resolution';
  }
  if (pattern.includes('Module not found')) {
    return `Verify the module exists and the import path is correct: ${error.message}`;
  }
  return `Address the error pattern: ${pattern}`;
}

function inferGlob(files: string[]): string {
  if (files.every(f => f.endsWith('.ts'))) return '**/*.ts';
  if (files.every(f => f.endsWith('.tsx'))) return '**/*.tsx';
  return '**/*';
}

function inferTags(runner: string, error: any): string[] {
  const tags = [runner];
  
  if (error.message.includes('module')) tags.push('import', 'module');
  if (error.message.includes('type')) tags.push('type-error');
  if (runner === 'tsc') tags.push('typescript', 'build');
  if (runner === 'vitest') tags.push('test');
  if (runner === 'eslint') tags.push('lint');
  
  return tags;
}
