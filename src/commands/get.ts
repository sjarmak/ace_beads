import { readFileSync, existsSync } from 'fs';
import { loadConfig } from '../lib/config.js';

interface GetOptions {
  source: 'insights' | 'bullets' | 'both';
  minConfidence?: number;
  tags?: string;
  sections?: string;
  beads?: string;
  threads?: string;
  after?: string;
  before?: string;
  limit?: number;
  sortBy?: 'confidence' | 'timestamp' | 'helpful';
  json?: boolean;
}

export async function getCommand(options: GetOptions): Promise<void> {
  const config = loadConfig();
  const limit = options.limit || 50;

  const result: any = {
    totalMatched: 0,
    filtered: false,
    insightsTotal: 0,
    bulletsTotal: 0
  };
  
  // Get insights
  if (options.source === 'insights' || options.source === 'both') {
    if (!existsSync(config.insightsPath)) {
      result.insights = [];
    } else {
      const content = readFileSync(config.insightsPath, 'utf-8');
      let insights = content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
      
      // Apply filters
      if (options.minConfidence) {
        insights = insights.filter(i => i.confidence >= options.minConfidence!);
        result.filtered = true;
      }
      
      if (options.tags) {
        const tags = options.tags.split(',').map(s => s.trim());
        insights = insights.filter(i => 
          i.metaTags && i.metaTags.some((t: string) => tags.includes(t))
        );
        result.filtered = true;
      }
      
      if (options.beads) {
        const beadIds = options.beads.split(',').map(s => s.trim());
        insights = insights.filter(i =>
          beadIds.includes(i.taskId) ||
          (i.source.beadIds && i.source.beadIds.some((b: string) => beadIds.includes(b)))
        );
        result.filtered = true;
      }

      if (options.threads) {
        const threadIds = options.threads.split(',').map(s => s.trim());
        insights = insights.filter(i => {
          const threadRefs = (i as any).thread_refs;
          return threadRefs && threadRefs.some((tr: string) => threadIds.includes(tr));
        });
        result.filtered = true;
      }
      
      if (options.after) {
        insights = insights.filter(i => i.timestamp >= options.after!);
        result.filtered = true;
      }
      
      if (options.before) {
        insights = insights.filter(i => i.timestamp <= options.before!);
        result.filtered = true;
      }
      
      // Sort
      if (options.sortBy === 'confidence') {
        insights.sort((a, b) => b.confidence - a.confidence);
      } else if (options.sortBy === 'timestamp') {
        insights.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      }
      
      result.insightsTotal = insights.length;
      if (options.source === 'insights') result.totalMatched = insights.length;
      result.insights = insights.slice(0, limit);
    }
  }
  
  // Get bullets
  if (options.source === 'bullets' || options.source === 'both') {
    if (!existsSync(config.agentsPath)) {
      result.bullets = [];
    } else {
      const content = readFileSync(config.agentsPath, 'utf-8');
      let bullets = extractBullets(content);
      
      // Apply filters
      if (options.sections) {
        const sections = options.sections.split(',').map(s => s.trim());
        bullets = bullets.filter(b => sections.includes(b.section));
        result.filtered = true;
      }
      
      // Sort
      if (options.sortBy === 'helpful') {
        bullets.sort((a, b) => (b.helpful - b.harmful) - (a.helpful - a.harmful));
      }
      
      result.bulletsTotal = bullets.length;
      if (options.source === 'bullets') result.totalMatched = bullets.length;
      result.bullets = bullets.slice(0, limit);
    }
  }
  
  // Output
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.insights) {
      console.log(`\n📊 Insights (${result.insights.length}/${result.insightsTotal}):\n`);
      result.insights.forEach((insight: any, i: number) => {
        console.log(`${i + 1}. ${insight.signal.pattern}`);
        console.log(`   Confidence: ${insight.confidence.toFixed(2)}`);
        console.log(`   Recommendation: ${insight.recommendation}`);
        console.log(`   Tags: ${insight.metaTags.join(', ')}`);
        console.log('');
      });
    }
    
    if (result.bullets) {
      console.log(`\n📝 Bullets (${result.bullets.length}/${result.bulletsTotal}):\n`);
      result.bullets.forEach((bullet: any, i: number) => {
        console.log(`${i + 1}. [${bullet.section}] ${bullet.content}`);
        console.log(`   Score: +${bullet.helpful}/-${bullet.harmful} (net: ${bullet.score})`);
        console.log('');
      });
    }
  }
}

interface Bullet {
  id: string;
  content: string;
  helpful: number;
  harmful: number;
  section: string;
  score: number;
}

function extractBullets(content: string): Bullet[] {
  const bullets: Bullet[] = [];
  const lines = content.split('\n');
  let currentSection = 'Unknown';
  
  const sectionRegex = /^#{2,3} (.+)/;
  const bulletRegex = /\[Bullet #([a-zA-Z0-9]+), helpful:(\d+), harmful:(\d+)(?:, [^\]]+)?\] (.+)/;
  
  for (const line of lines) {
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }
    
    const bulletMatch = line.match(bulletRegex);
    if (bulletMatch) {
      const helpful = parseInt(bulletMatch[2]);
      const harmful = parseInt(bulletMatch[3]);
      
      bullets.push({
        id: bulletMatch[1],
        content: bulletMatch[4],
        helpful,
        harmful,
        section: currentSection,
        score: helpful - harmful
      });
    }
  }
  
  return bullets;
}
