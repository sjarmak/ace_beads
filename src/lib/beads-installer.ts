import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, chmodSync, writeFileSync } from 'fs';
import { homedir, platform, arch } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import * as https from 'https';

const BEADS_REPO = 'steveyegge/beads';
const BEADS_RELEASE_URL = `https://api.github.com/repos/${BEADS_REPO}/releases/latest`;

function isBdAvailable(): boolean {
  try {
    execSync('bd --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getInstallPath(): string {
  const localBin = join(homedir(), '.local', 'bin');
  if (!existsSync(localBin)) {
    mkdirSync(localBin, { recursive: true });
  }
  return join(localBin, 'bd');
}

function getAssetName(): string {
  const os = platform();
  const architecture = arch();
  
  let osName: string;
  if (os === 'darwin') {
    osName = 'darwin';
  } else if (os === 'linux') {
    osName = 'linux';
  } else {
    throw new Error(`Unsupported OS: ${os}. Beads supports macOS and Linux only.`);
  }
  
  let archName: string;
  if (architecture === 'x64') {
    archName = 'amd64';
  } else if (architecture === 'arm64') {
    archName = 'arm64';
  } else {
    const errorMsg = `Unsupported architecture: ${architecture}.` +
      ` Beads supports x64 and arm64 only.`;
    throw new Error(errorMsg);
  }
  
  return `bd-${osName}-${archName}`;
}

function promptUser(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'ACE-Framework-Installer'
      }
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        if (res.headers.location) {
          return fetchJSON(res.headers.location).then(resolve).catch(reject);
        }
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'ACE-Framework-Installer'
      }
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        if (res.headers.location) {
          return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          writeFileSync(destPath, buffer);
          chmodSync(destPath, 0o755);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function installBeads(): Promise<void> {
  const assetName = getAssetName();
  const installPath = getInstallPath();
  
  console.log('📥 Fetching latest Beads release...');
  const release = await fetchJSON(BEADS_RELEASE_URL);
  
  const asset = release.assets.find((a: any) => a.name === assetName);
  if (!asset) {
    const available = release.assets.map((a: any) => a.name).join(', ');
    throw new Error(`No release found for ${assetName}. Available: ${available}`);
  }
  
  console.log(`📦 Downloading Beads from ${asset.browser_download_url}...`);
  await downloadFile(asset.browser_download_url, installPath);
  
  console.log(`✅ Beads installed to ${installPath}`);
  const localBinPath = join(homedir(), '.local', 'bin');
  console.log(`\n⚠️  Add ${localBinPath} to your PATH if not already present.`);
  console.log(`   Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):`);
  console.log(`   export PATH="$HOME/.local/bin:$PATH"\n`);
}

export async function ensureBeadsInstalled(): Promise<void> {
  if (isBdAvailable()) {
    return;
  }
  
  console.log('\n⚠️  Beads (bd) CLI is required but not found in PATH.');
  const shouldInstall = await promptUser('Install Beads now? (y/N): ');
  
  if (!shouldInstall) {
    const installUrl = 'https://github.com/steveyegge/beads';
    console.error(`\n❌ Beads is required to use ACE. Install manually from: ${installUrl}`);
    process.exit(6);
  }
  
  try {
    await installBeads();
    
    if (!isBdAvailable()) {
      const installPath = getInstallPath();
      const localBinPath = join(homedir(), '.local', 'bin');
      console.log(`\n⚠️  Beads installed but not in PATH.` +
        ` Please add ${localBinPath} to PATH and retry.`);
      process.exit(6);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Failed to install Beads: ${errorMsg}`);
    console.error('Please install manually from: https://github.com/steveyegge/beads');
    process.exit(6);
  }
}

export function initBeadsIfNeeded(quiet = false): void {
  if (!existsSync('.beads')) {
    if (!quiet) {
      console.log('🔵 Initializing Beads in current directory...');
    }
    try {
      execSync('bd init', { stdio: quiet ? 'ignore' : 'inherit' });
      if (!quiet) {
        console.log('✅ Beads initialized');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to initialize Beads: ${errorMsg}`);
      process.exit(3);
    }
  }
}
