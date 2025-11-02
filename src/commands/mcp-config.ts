import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';
import { loadConfig, getEffectiveMCPServers } from '../lib/config.js';

export interface MCPConfigCommandOptions {
  apply?: boolean;
  list?: boolean;
  json?: boolean;
  verbose?: boolean;
  restore?: boolean;
}

export function mcpConfigCommand(options: MCPConfigCommandOptions = {}) {
  const config = loadConfig();

  if (options.restore) {
    // Restore global default configuration
    restoreGlobalConfig();
    if (!options.json) {
      console.log('Restored global default MCP configuration.');
    }
    return;
  }

  // Check for project-specific config file
  const projectConfig = loadProjectConfig();
  const activeConfig = projectConfig || config;

  if (options.list) {
    if (projectConfig) {
      // Show project-specific configuration
      if (options.json) {
        console.log(JSON.stringify({
          type: 'project',
          configFile: findProjectConfigFile(),
          config: projectConfig
        }, null, 2));
      } else {
        console.log('📍 Project-specific MCP Configuration:');
        console.log(`   File: ${findProjectConfigFile()}`);
        if (projectConfig.mcpServers) {
          const servers = Object.keys(projectConfig.mcpServers);
          console.log(`   Servers: ${servers.length > 0 ? servers.join(', ') : 'none'}`);
        }
        if (projectConfig.agents) {
          const agents = Object.entries(projectConfig.agents)
            .filter(([_, enabled]) => enabled)
            .map(([name, _]) => name);
          console.log(`   Agents: ${agents.join(', ')}`);
        }
      }
    } else {
      // Show ACE project configuration (filtering approach)
      const mcpConfig = config.mcpServers || { enabled: [], disabled: [] };

      if (options.json) {
        console.log(JSON.stringify({
          type: 'ace-filtering',
          projectConfig: mcpConfig,
          effectiveServers: getEffectiveMCPServers(config, getAllAvailableMCPServers())
        }, null, 2));
      } else {
        console.log('Project MCP Server Configuration (ACE filtering):');
        console.log(`  Enabled: ${mcpConfig.enabled?.join(', ') || 'none'}`);
        console.log(`  Disabled: ${mcpConfig.disabled?.join(', ') || 'none'}`);

        const effective = getEffectiveMCPServers(config, getAllAvailableMCPServers());
        console.log(`  Effective servers: ${effective.join(', ')}`);
      }
    }
    return;
  }

  if (options.apply) {
    if (projectConfig) {
      // Apply project-specific configuration as complete override
      applyProjectConfigToClient(projectConfig);
      if (!options.json) {
        console.log(`Applied project configuration from ${findProjectConfigFile()}`);
      }
    } else {
      // Apply ACE filtering configuration
      applyMCPConfigToClient(config);
      if (!options.json) {
        console.log('Applied ACE filtering configuration to client.');
      }
    }
    return;
  }

  // Default: show help
  console.log(`
ACE Directory Configuration Management

Configure complete Amp settings with directory-level overrides.

USAGE:
  ace mcp-config [options]

OPTIONS:
  --apply          Apply project config to client configuration
  --list           List current configuration
  --restore        Restore global default configuration from backup
  --json           Output in JSON format
  --verbose        Show detailed output

EXAMPLES:
  ace mcp-config --list                    # Show current config
  ace mcp-config --apply                   # Apply to client config
  ace mcp-config --restore                 # Restore global defaults
  ace mcp-config --list --json             # Show config as JSON

CONFIGURATION METHODS:

1. Complete Project Override (.amp-config.json):
   Create .amp-config.json in any project directory for full Amp config override:

   {
     "mcpServers": {
       "braingrid": {"url": "https://mcp.braingrid.ai/mcp"}
     },
     "agents": {"planning": true, "testing": true, "autonomy": false},
     "experimental": {"librarian": true},
     "amp": {"dangerouslyAllowAll": false, "updates": {"mode": "manual"}}
   }

2. ACE Filtering (.ace.json):
   For projects using the ACE filtering approach (MCP-only):

   {
     "mcpServers": {
       "enabled": ["braingrid"],
       "disabled": ["chrome-devtools"]
     }
   }

PRIORITY: .amp-config.json completely overrides global config.
          .ace.json filtering applies only when no .amp-config.json exists.
`);
}

function getAllAvailableMCPServers(): string[] {
  // This would ideally be discovered dynamically, but for now hardcode known servers
  return [
    'braingrid',
    'chrome-devtools',
    'gong-extended',
    'salesforce',
    'notion',
    'sourcegraph',
    'codemode',
    'ace-learning-server'
  ];
}

// Load project-specific configuration file
function loadProjectConfig(): any | null {
  const configPath = findProjectConfigFile();
  if (!configPath) return null;

  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.error(`Failed to parse project config ${configPath}:`, error);
    return null;
  }
}

// Find project configuration file by walking up directories
function findProjectConfigFile(): string | null {
  let current = process.cwd();
  while (current !== '/') {
    const configPath = join(current, '.amp-config.json');
    if (existsSync(configPath)) {
      return configPath;
    }
    current = dirname(current);
  }
  return null;
}

// Apply project-specific configuration as complete override
function applyProjectConfigToClient(projectConfig: any) {
  const clientConfigPaths = [
    join(homedir(), '.config', 'amp', 'settings.json'),         // Amp
    join(homedir(), '.config', 'amp', 'config.json'),           // Amp (fallback)
    join(homedir(), '.config', 'cline', 'settings.json'),       // Cline/VS Code
    join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json') // Claude Desktop
  ];

  for (const configPath of clientConfigPaths) {
    if (existsSync(configPath)) {
      try {
        const clientConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
        const backupPath = `${configPath}.backup.${Date.now()}`;

        // Create backup
        writeFileSync(backupPath, JSON.stringify(clientConfig, null, 2));

        // Apply project configuration overrides
        const mergedConfig = { ...clientConfig, ...projectConfig };

        // Handle Amp-specific MCP server key
        if (projectConfig.mcpServers && clientConfig['amp.mcpServers']) {
          mergedConfig['amp.mcpServers'] = projectConfig.mcpServers;
        }

        writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
        console.log(`Updated ${configPath} with project config (backup: ${backupPath})`);
      } catch (error) {
        console.error(`Failed to update ${configPath}:`, error);
      }
    }
  }
}

// Restore global default configuration
function restoreGlobalConfig() {
  const clientConfigPaths = [
    join(homedir(), '.config', 'amp', 'settings.json'),         // Amp
    join(homedir(), '.config', 'amp', 'config.json'),           // Amp (fallback)
  ];

  for (const configPath of clientConfigPaths) {
    if (existsSync(configPath)) {
      try {
        // Look for the most recent backup
        const backups = readdirSync(dirname(configPath))
          .filter((file: string) => file.startsWith(basename(configPath) + '.backup.'))
          .sort()
          .reverse();

        if (backups.length > 0) {
          const latestBackup = join(dirname(configPath), backups[0]);
          const backupContent = readFileSync(latestBackup, 'utf-8');
          writeFileSync(configPath, backupContent);
          console.log(`Restored ${configPath} from ${latestBackup}`);
        } else {
          console.log(`No backup found for ${configPath}`);
        }
      } catch (error) {
        console.error(`Failed to restore ${configPath}:`, error);
      }
    }
  }
}

function applyMCPConfigToClient(config: any) {
  const clientConfigPaths = [
    join(homedir(), '.config', 'amp', 'settings.json'),         // Amp
    join(homedir(), '.config', 'amp', 'config.json'),           // Amp (fallback)
    join(homedir(), '.config', 'cline', 'settings.json'),       // Cline/VS Code
    join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json') // Claude Desktop
  ];

  const effectiveServers = getEffectiveMCPServers(config, getAllAvailableMCPServers());

  for (const configPath of clientConfigPaths) {
    if (existsSync(configPath)) {
      try {
        const clientConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

        // Handle different MCP server key formats
        let mcpKey = 'mcpServers';
        if (clientConfig['amp.mcpServers']) {
          mcpKey = 'amp.mcpServers';  // Amp format
        }

        // Filter MCP servers based on effective servers list
        if (clientConfig[mcpKey]) {
          const filteredServers: Record<string, any> = {};

          for (const [serverName, serverConfig] of Object.entries(clientConfig[mcpKey])) {
            if (effectiveServers.includes(serverName)) {
              filteredServers[serverName] = serverConfig;
            }
          }

          clientConfig[mcpKey] = filteredServers;
          writeFileSync(configPath, JSON.stringify(clientConfig, null, 2));
          console.log(`Updated ${configPath} (${mcpKey})`);
        }
      } catch (error) {
        console.error(`Failed to update ${configPath}:`, error);
      }
    }
  }
}
