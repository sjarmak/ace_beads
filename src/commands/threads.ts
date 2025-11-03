import { ThreadIndexer } from '../lib/thread-indexer.js';

interface ThreadsListOptions {
  json?: boolean;
  limit?: number;
  tags?: string;
  component?: string;
}

interface ThreadsShowOptions {
  json?: boolean;
}

interface ThreadsByBeadOptions {
  json?: boolean;
}

export async function threadsListCommand(options: ThreadsListOptions): Promise<void> {
  const indexer = new ThreadIndexer();
  const limit = options.limit || 20;

  const query: any = {};
  if (options.tags) {
    query.tags = options.tags.split(',').map(t => t.trim());
  }
  if (options.component) {
    query.component = options.component;
  }

  const threads = await indexer.getAllThreads(query);
  const displayed = threads.slice(0, limit);

  if (options.json) {
    console.log(JSON.stringify({
      threads: displayed,
      total: threads.length,
      shown: displayed.length,
    }, null, 2));
    return;
  }

  console.log(`\n🧵 Thread Index\n`);
  console.log(`Total threads: ${threads.length}, Showing: ${displayed.length}\n`);

  if (displayed.length === 0) {
    console.log('No threads found. Use `ace capture` with --thread-refs to index threads.\n');
    return;
  }

  for (const thread of displayed) {
    console.log(`Thread: ${thread.thread_id}`);
    console.log(`  Beads: ${thread.bead_ids.length} (${thread.bead_ids.slice(0, 3).join(', ')}${thread.bead_ids.length > 3 ? '...' : ''})`);
    console.log(`  Traces: ${thread.trace_count}`);
    
    if (thread.tags.length > 0) {
      console.log(`  Tags: ${thread.tags.join(', ')}`);
    }
    
    if (thread.component) {
      console.log(`  Component: ${thread.component}`);
    }
    
    if (thread.feature) {
      console.log(`  Feature: ${thread.feature}`);
    }
    
    if (thread.amp_metadata?.thread_url) {
      console.log(`  URL: ${thread.amp_metadata.thread_url}`);
    }
    
    if (thread.amp_metadata?.created_by_agent) {
      console.log(`  Created by: ${thread.amp_metadata.created_by_agent}`);
    }
    
    console.log(`  First seen: ${new Date(thread.first_seen).toLocaleString()}`);
    console.log(`  Last seen: ${new Date(thread.last_seen).toLocaleString()}`);
    console.log('');
  }

  console.log(`💡 Use \`ace threads show <thread-id>\` to view beads for a specific thread\n`);
}

export async function threadsShowCommand(threadId: string, options: ThreadsShowOptions): Promise<void> {
  const indexer = new ThreadIndexer();
  const thread = await indexer.getThread(threadId);

  if (!thread) {
    if (options.json) {
      console.error(JSON.stringify({ error: 'Thread not found' }, null, 2));
    } else {
      console.error(`❌ Thread ${threadId} not found in index`);
    }
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(thread, null, 2));
    return;
  }

  console.log(`\n🧵 Thread: ${thread.thread_id}\n`);
  
  if (thread.amp_metadata?.thread_url) {
    console.log(`URL: ${thread.amp_metadata.thread_url}`);
  }
  
  if (thread.amp_metadata?.workspace_id) {
    console.log(`Workspace: ${thread.amp_metadata.workspace_id}`);
  }
  
  if (thread.component) {
    console.log(`Component: ${thread.component}`);
  }
  
  if (thread.feature) {
    console.log(`Feature: ${thread.feature}`);
  }
  
  console.log(`\nMetadata:`);
  console.log(`  First seen: ${new Date(thread.first_seen).toLocaleString()}`);
  console.log(`  Last seen: ${new Date(thread.last_seen).toLocaleString()}`);
  console.log(`  Total traces: ${thread.trace_count}`);
  
  if (thread.amp_metadata?.created_by_agent) {
    console.log(`  Created by: ${thread.amp_metadata.created_by_agent}`);
  }
  
  if (thread.amp_metadata?.created_in_context) {
    console.log(`  Context: ${thread.amp_metadata.created_in_context}`);
  }
  
  if (thread.amp_metadata?.main_thread_id) {
    console.log(`  Main thread: ${thread.amp_metadata.main_thread_id}`);
  }
  
  if (thread.tags.length > 0) {
    console.log(`\nTags: ${thread.tags.join(', ')}`);
  }
  
  console.log(`\nAssociated Beads (${thread.bead_ids.length}):`);
  for (const beadId of thread.bead_ids) {
    console.log(`  - ${beadId}`);
  }
  
  console.log('');
}

export async function threadsByBeadCommand(beadId: string, options: ThreadsByBeadOptions): Promise<void> {
  const indexer = new ThreadIndexer();
  const threads = await indexer.getThreadsForBead(beadId);

  if (options.json) {
    console.log(JSON.stringify({
      bead_id: beadId,
      threads,
      count: threads.length,
    }, null, 2));
    return;
  }

  console.log(`\n🧵 Threads for Bead: ${beadId}\n`);

  if (threads.length === 0) {
    console.log('No threads found for this bead.\n');
    return;
  }

  console.log(`Found ${threads.length} thread(s):\n`);

  for (const thread of threads) {
    console.log(`Thread: ${thread.thread_id}`);
    
    if (thread.amp_metadata?.thread_url) {
      console.log(`  URL: ${thread.amp_metadata.thread_url}`);
    }
    
    console.log(`  Total beads: ${thread.bead_ids.length}`);
    console.log(`  Traces: ${thread.trace_count}`);
    
    if (thread.tags.length > 0) {
      console.log(`  Tags: ${thread.tags.join(', ')}`);
    }
    
    console.log(`  Last seen: ${new Date(thread.last_seen).toLocaleString()}`);
    console.log('');
  }
}
