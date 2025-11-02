import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { loadConfig } from '../lib/config.js';
import { Curator } from '../lib/Curator.js';
import { AgentsMdMaintainer } from '../lib/agents-md-maintainer.js';

interface UpdateOptions {
  minConfidence?: number;
  maxDeltas?: number;
  dryRun?: boolean;
  forceInsightIds?: string;
  json?: boolean;
}

interface Delta {
  bulletId: string;
  section: string;
  content: string;
  confidence: number;
  applied: boolean;
}

export async function updateCommand(options: UpdateOptions): Promise<void> {
  const config = loadConfig();
  const minConfidence = options.minConfidence ?? config.defaultConfidence;
  const maxDeltas = options.maxDeltas ?? config.maxDeltas;
  
  if (!existsSync(config.insightsPath)) {
    throw new Error(`Insights file not found: ${config.insightsPath}`);
  }
  
  if (!existsSync(config.agentsPath)) {
    throw new Error(`AGENTS.md not found: ${config.agentsPath}`);
  }
  
  // Delegate to Curator for processing insights and applying deltas
  const curator = new Curator(config.insightsPath, config.agentsPath, maxDeltas);
  const deltas = options.dryRun ? [] : await curator.processInsights(minConfidence);
  
  // Run deduplication and consolidation
  if (!options.dryRun && deltas.length > 0) {
    await curator.deduplicateAndConsolidate();
    
    // Trim AGENTS.md to 500 lines if needed
    const maintainer = new AgentsMdMaintainer(500, config.agentsPath);
    await maintainer.trimToLimit();
  }
  
  // Output
  if (options.json) {
    console.log(JSON.stringify({
      deltas: deltas.map(d => ({
        bulletId: d.bullet_id,
        section: d.section,
        content: d.content,
        confidence: d.confidence,
        applied: true
      })),
      updated: !options.dryRun
    }, null, 2));
  } else {
    console.log(`✅ Knowledge update complete`);
    console.log(`   Deltas applied: ${deltas.length}`);
    
    if (deltas.length > 0) {
      console.log(`\n📝 New bullets:`);
      deltas.forEach(d => {
        const preview = d.content.length > 60 ? d.content.substring(0, 60) + '...' : d.content;
        console.log(`   [${d.section}] ${preview}`);
      });
    }
    
    if (!options.dryRun) {
      console.log(`\n   Updated: ${config.agentsPath}`);
    } else {
      console.log(`\n   (Dry run - not saved)`);
    }
  }
}

function extractBullets(content: string): Array<{ id: string; content: string }> {
  const bulletRegex = /\[Bullet #([a-f0-9]+), helpful:\d+, harmful:\d+\] (.+)/g;
  const bullets: Array<{ id: string; content: string }> = [];
  
  let match;
  while ((match = bulletRegex.exec(content)) !== null) {
    bullets.push({
      id: match[1],
      content: match[2]
    });
  }
  
  return bullets;
}

function determineSection(insight: any): string {
  const tags = insight.metaTags || [];
  const runner = insight.source.runner || '';
  const pattern = insight.signal.pattern.toLowerCase();
  const recommendation = (insight.signal.recommendation || '').toLowerCase();
  
  // Check for project-specific patterns first
  if (pattern.includes('ace') || pattern.includes('reflector') || pattern.includes('curator') || pattern.includes('generator')) {
    return 'ACE Framework Patterns';
  }
  if (pattern.includes('bead') || pattern.includes('bd ') || pattern.includes('discovered')) {
    return 'Beads Integration Patterns';
  }
  if (pattern.includes('mcp') || tags.includes('mcp')) {
    return 'MCP Server Patterns';
  }
  
  // Then check for general patterns
  if (tags.includes('typescript') || runner === 'tsc' || pattern.includes('typescript')) {
    return 'TypeScript Patterns';
  }
  if (tags.includes('test') || runner === 'vitest' || runner === 'jest' || pattern.includes('test')) {
    return 'Build & Test Patterns';
  }
  if (pattern.includes('dependency')) {
    return 'Dependency Patterns';
  }
  if (pattern.includes('architecture') || pattern.includes('design')) {
    return 'Architecture Patterns';
  }
  
  return 'TypeScript Patterns';
}

function addBulletToSection(content: string, section: string, bullet: string): string {
  const sectionHeader = `### ${section}`;
  const sectionIndex = content.indexOf(sectionHeader);
  
  if (sectionIndex === -1) {
    console.warn(`Section "${section}" not found, adding to end`);
    return content + `\n\n### ${section}\n\n${bullet}\n`;
  }
  
  // Find the end of the section header comment
  const commentEndIndex = content.indexOf('-->', sectionIndex);
  if (commentEndIndex === -1) {
    // No comment, add after section header
    const lineEnd = content.indexOf('\n', sectionIndex);
    return content.substring(0, lineEnd + 1) + `${bullet}\n` + content.substring(lineEnd + 1);
  }
  
  // Add after the comment
  const insertIndex = content.indexOf('\n', commentEndIndex) + 1;
  return content.substring(0, insertIndex) + `${bullet}\n` + content.substring(insertIndex);
}
