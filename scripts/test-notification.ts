import { BeadsClient } from '../src/lib/beads-client.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

async function testNotification() {
  console.log('Setting environment variables...');
  process.env.AMP_THREAD_ID = 'T-test-script-456';
  process.env.AMP_WORKSPACE_ID = 'ws-test-script';
  process.env.ACE_ROLE = 'generator';

  const beads = new BeadsClient();
  
  console.log('Creating issue with Amp thread context...');
  const issue = await beads.createIssue('Test notification via BeadsClient', {
    type: 'task',
    priority: 2,
    description: 'Testing notification delivery mechanism',
  });

  console.log(`Created issue: ${issue.id}`);
  console.log(`Amp metadata present: ${!!issue.amp_metadata}`);
  if (issue.amp_metadata) {
    console.log(`Thread ID: ${issue.amp_metadata.thread_id}`);
  }

  console.log('\nClosing issue...');
  const closedIssue = await beads.closeIssue(issue.id, 'Testing notification delivery');
  console.log(`Closed issue: ${closedIssue.id}`);

  const notificationPath = '/Users/sjarmak/ACE_Beads_Amp/amp_notifications.jsonl';
  if (existsSync(notificationPath)) {
    console.log('\n✅ Notification file created!');
    const content = await readFile(notificationPath, 'utf-8');
    const lines = content.trim().split('\n');
    console.log(`Number of notifications: ${lines.length}`);
    
    for (const line of lines) {
      const notification = JSON.parse(line);
      console.log('\nNotification details:');
      console.log(`  Event ID: ${notification.event_id}`);
      console.log(`  Bead ID: ${notification.bead_id}`);
      console.log(`  Thread ID: ${notification.thread_id}`);
      console.log(`  Event Type: ${notification.event_type}`);
      console.log(`  Summary: ${notification.payload.summary}`);
    }
  } else {
    console.log('\n❌ Notification file was not created');
  }
}

testNotification().catch(console.error);
