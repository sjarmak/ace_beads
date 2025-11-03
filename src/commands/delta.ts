import { DeltaQueue } from '../lib/deltas.js';
import { loadConfig } from '../lib/config.js';

export interface DeltaListOptions {
  json?: boolean;
}

export interface DeltaShowOptions {
  json?: boolean;
}

export interface DeltaRmOptions {
  json?: boolean;
}

export async function deltaListCommand(options: DeltaListOptions): Promise<void> {
  const config = loadConfig();
  const queue = new DeltaQueue(config.deltaQueue || '.ace/delta-queue.json');
  const deltas = await queue.read();

  if (options.json) {
    console.log(JSON.stringify(deltas, null, 2));
    return;
  }

  if (deltas.length === 0) {
    console.log('No deltas in queue');
    return;
  }

  console.log(`${deltas.length} delta(s) in queue:\n`);
  for (const delta of deltas) {
    console.log(`[${delta.id.slice(0, 8)}] ${delta.section}`);
    console.log(`  Op: ${delta.op}, Confidence: ${delta.metadata.confidence.toFixed(2)}`);
    const contentPreview = delta.content.slice(0, 60);
    const suffix = delta.content.length > 60 ? '...' : '';
    console.log(`  Content: ${contentPreview}${suffix}`);
    console.log('');
  }
}

export async function deltaShowCommand(id: string, options: DeltaShowOptions): Promise<void> {
  const config = loadConfig();
  const queue = new DeltaQueue(config.deltaQueue || '.ace/delta-queue.json');
  const deltas = await queue.read();
  
  const delta = deltas.find((d) => d.id.startsWith(id) || d.id === id);
  
  if (!delta) {
    throw new Error(`Delta ${id} not found`);
  }

  if (options.json) {
    console.log(JSON.stringify(delta, null, 2));
    return;
  }

  console.log(`Delta: ${delta.id}\n`);
  console.log(`Section: ${delta.section}`);
  console.log(`Op: ${delta.op}`);
  console.log(`Confidence: ${delta.metadata.confidence}`);
  console.log(`\nContent:\n${delta.content}\n`);
  console.log(`Evidence:\n${delta.metadata.evidence}\n`);
  console.log(`Source:`);
  console.log(`  Bead: ${delta.metadata.source.beadsId}`);
  console.log(`  Files: ${delta.metadata.source.files?.join(', ') || 'N/A'}`);
  console.log(`  Commit: ${delta.metadata.source.commit || 'N/A'}`);
  console.log(`\nTags: ${delta.metadata.tags.join(', ')}`);
  console.log(`Scope: ${delta.metadata.scope?.join(', ') || 'N/A'}`);
  console.log(`Created: ${delta.metadata.createdAt}`);
}

export async function deltaRmCommand(ids: string[], options: DeltaRmOptions): Promise<void> {
  const config = loadConfig();
  const queue = new DeltaQueue(config.deltaQueue || '.ace/delta-queue.json');
  const deltas = await queue.read();
  
  // Match full or partial IDs
  const toRemove: string[] = [];
  for (const id of ids) {
    const matches = deltas.filter((d) => d.id.startsWith(id) || d.id === id);
    toRemove.push(...matches.map((m) => m.id));
  }

  if (toRemove.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ removed: 0 }, null, 2));
    } else {
      console.log('No deltas matched');
    }
    return;
  }

  await queue.dequeue(toRemove);

  if (options.json) {
    console.log(JSON.stringify({ removed: toRemove.length, ids: toRemove }, null, 2));
  } else {
    console.log(`Removed ${toRemove.length} delta(s)`);
  }
}
