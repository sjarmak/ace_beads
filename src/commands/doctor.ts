import { access, readFile, stat } from 'fs/promises';
import { spawn } from 'child_process';
import { loadConfig } from '../lib/config.js';

export interface DoctorOptions {
  json?: boolean;
}

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  const results: DiagnosticResult[] = [];

  // Check 1: .ace/config.json exists and valid
  try {
    const config = loadConfig();
    results.push({
      name: 'ACE config',
      status: 'pass',
      message: 'Configuration loaded successfully',
    });
  } catch (err) {
    results.push({
      name: 'ACE config',
      status: 'fail',
      message: `Failed to load config: ${err}`,
    });
  }

  // Check 2: Beads CLI available
  try {
    await execCommand('bd', ['--version']);
    results.push({
      name: 'Beads CLI',
      status: 'pass',
      message: 'bd command available',
    });
  } catch {
    results.push({
      name: 'Beads CLI',
      status: 'warn',
      message: 'bd command not found on PATH',
    });
  }

  // Check 3: .beads directory exists
  try {
    await access('.beads');
    results.push({
      name: 'Beads DB',
      status: 'pass',
      message: '.beads directory exists',
    });
  } catch {
    results.push({
      name: 'Beads DB',
      status: 'warn',
      message: '.beads directory not found (run bd init)',
    });
  }

  // Check 4: knowledge/ directory
  try {
    await access('knowledge');
    results.push({
      name: 'Knowledge dir',
      status: 'pass',
      message: 'knowledge/ exists',
    });
  } catch {
    results.push({
      name: 'Knowledge dir',
      status: 'warn',
      message: 'knowledge/ not found (run ace init)',
    });
  }

  // Check 5: AGENTS.md
  try {
    const config = loadConfig();
    const agentsMdPath = config.agentsPath || 'knowledge/AGENTS.md';
    const statInfo = await stat(agentsMdPath);
    results.push({
      name: 'AGENTS.md',
      status: 'pass',
      message: `Found (${statInfo.size} bytes)`,
    });
  } catch {
    results.push({
      name: 'AGENTS.md',
      status: 'warn',
      message: 'AGENTS.md not found',
    });
  }

  // Check 6: playbook.yaml
  try {
    await access('knowledge/playbook.yaml');
    results.push({
      name: 'playbook.yaml',
      status: 'pass',
      message: 'Found',
    });
  } catch {
    results.push({
      name: 'playbook.yaml',
      status: 'warn',
      message: 'playbook.yaml not found',
    });
  }

  // Check 7: Delta queue
  try {
    const config = loadConfig();
    const queuePath = config.deltaQueue || '.ace/delta-queue.json';
    await access(queuePath);
    const content = await readFile(queuePath, 'utf-8');
    const deltas = JSON.parse(content);
    results.push({
      name: 'Delta queue',
      status: 'pass',
      message: `${deltas.length} delta(s) queued`,
    });
  } catch {
    results.push({
      name: 'Delta queue',
      status: 'warn',
      message: 'Delta queue not initialized',
    });
  }

  // Check 8: Git available
  try {
    await execCommand('git', ['--version']);
    results.push({
      name: 'Git',
      status: 'pass',
      message: 'Git available',
    });
  } catch {
    results.push({
      name: 'Git',
      status: 'fail',
      message: 'Git not found (required for curations)',
    });
  }

  // Summary
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;

  if (options.json) {
    console.log(JSON.stringify({
      checks: results,
      summary: { passed, failed, warned, total: results.length },
    }, null, 2));
    return;
  }

  console.log('ACE Doctor - Diagnostics\n');
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.name}: ${result.message}`);
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${warned} warnings`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

function execCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { shell: true, stdio: 'pipe' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}
