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
  
  // Load insights
  const insightsContent = readFileSync(config.insightsPath, 'utf-8');
  const allInsights = insightsContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  // Filter insights
  let insights = allInsights.filter(i => i.confidence >= minConfidence);
  
  if (options.forceInsightIds) {
    const forcedIds = options.forceInsightIds.split(',').map(s => s.trim());
    const forcedInsights = allInsights.filter(i => forcedIds.includes(i.id));
    insights = [...insights, ...forcedInsights];
  }
  
  // Load existing AGENTS.md
  let agentsContent = readFileSync(config.agentsPath, 'utf-8');
  const existingBullets = extractBullets(agentsContent);
  
  // Generate deltas
  const deltas: Delta[] = [];
  let duplicatesSkipped = 0;
  let lowConfidenceSkipped = allInsights.length - insights.length;
  
  for (const insight of insights) {
    if (deltas.length >= maxDeltas) break;
    
    // Check for duplicates
    const isDuplicate = existingBullets.some(b => 
      b.content.toLowerCase().includes(insight.signal.pattern.toLowerCase())
    );
    
    if (isDuplicate) {
      duplicatesSkipped++;
      continue;
    }
    
    // Determine section
    const section = determineSection(insight);
    
    // Generate bullet
    const bulletId = createHash('md5')
      .update(insight.signal.pattern + insight.timestamp)
      .digest('hex')
      .substring(0, 8);
    
    const bulletContent = `[Bullet #${bulletId}, helpful:0, harmful:0] ${insight.signal.pattern} - ${insight.recommendation}`;
    
    deltas.push({
      bulletId,
      section,
      content: bulletContent,
      confidence: insight.confidence,
      applied: false
    });
  }
  
  // Apply deltas
  if (!options.dryRun && deltas.length > 0) {
    for (const delta of deltas) {
      agentsContent = addBulletToSection(agentsContent, delta.section, delta.content);
      delta.applied = true;
    }
    
    writeFileSync(config.agentsPath, agentsContent, 'utf-8');
    
    // Run deduplication after applying deltas
    const curator = new Curator(config.insightsPath, config.agentsPath, config.maxDeltas);
    await curator.deduplicateAndConsolidate();
    
    // Trim AGENTS.md to 500 lines if needed
    const maintainer = new AgentsMdMaintainer(500, config.agentsPath);
    await maintainer.trimToLimit();
  }
  
  // Output
  if (options.json) {
    console.log(JSON.stringify({
      deltas,
      duplicatesSkipped,
      lowConfidenceSkipped,
      updated: !options.dryRun
    }, null, 2));
  } else {
    console.log(`✅ Knowledge update complete`);
    console.log(`   Deltas applied: ${deltas.length}`);
    console.log(`   Duplicates skipped: ${duplicatesSkipped}`);
    console.log(`   Low confidence skipped: ${lowConfidenceSkipped}`);
    
    if (deltas.length > 0) {
      console.log(`\n📝 New bullets:`);
      deltas.forEach(d => {
        console.log(`   [${d.section}] ${d.content.substring(0, 80)}...`);
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
