#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';

interface ACEServerConfig {
  knowledgeBasePath?: string;
  executionTracePath?: string;
  insightsPath?: string;
  maxDeltasPerSession?: number;
  defaultConfidenceThreshold?: number;
}

const DEFAULT_CONFIG: Required<ACEServerConfig> = {
  knowledgeBasePath: '/Users/sjarmak/ACE_Beads_Amp/AGENTS.md',
  executionTracePath: '/Users/sjarmak/ACE_Beads_Amp/logs/execution_traces.jsonl',
  insightsPath: '/Users/sjarmak/ACE_Beads_Amp/logs/insights.jsonl',
  maxDeltasPerSession: 3,
  defaultConfidenceThreshold: 0.8
};

class ACEMCPServer {
  private server: Server;
  private config: Required<ACEServerConfig>;

  constructor(config: ACEServerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.server = new Server(
      {
        name: 'ace-learning-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'ace_capture_trace',
          description: 'Captures execution traces during task execution. Records build/test/lint outcomes and associates them with a task for later analysis.',
          inputSchema: {
            type: 'object',
            properties: {
              beadId: {
                type: 'string',
                description: 'Bead/task identifier (e.g., "ACE_Beads_Amp-42")'
              },
              taskDescription: {
                type: 'string',
                description: 'Optional description (defaults to bead title)'
              },
              executions: {
                type: 'array',
                description: 'Array of execution results',
                items: {
                  type: 'object',
                  properties: {
                    runner: {
                      type: 'string',
                      description: 'Tool that ran (e.g., "tsc", "vitest", "eslint")'
                    },
                    command: {
                      type: 'string',
                      description: 'Command executed (e.g., "npm run build")'
                    },
                    status: {
                      type: 'string',
                      enum: ['pass', 'fail'],
                      description: 'Execution outcome'
                    },
                    errors: {
                      type: 'array',
                      description: 'Errors encountered (empty for pass)',
                      items: {
                        type: 'object',
                        properties: {
                          tool: { type: 'string' },
                          severity: {
                            type: 'string',
                            enum: ['error', 'warning', 'info']
                          },
                          message: { type: 'string' },
                          file: { type: 'string' },
                          line: { type: 'number' },
                          column: { type: 'number' }
                        },
                        required: ['tool', 'severity', 'message', 'file', 'line']
                      }
                    }
                  },
                  required: ['runner', 'command', 'status', 'errors']
                }
              },
              discoveredIssues: {
                type: 'array',
                description: 'Optional array of discovered bead IDs',
                items: { type: 'string' }
              },
              outcome: {
                type: 'string',
                enum: ['success', 'failure', 'partial'],
                description: 'Overall outcome'
              }
            },
            required: ['beadId', 'executions']
          }
        },
        {
          name: 'ace_analyze_patterns',
          description: 'Analyzes execution traces to extract insights and identify error patterns. Can analyze a single trace or multiple traces to find cross-task patterns.',
          inputSchema: {
            type: 'object',
            properties: {
              mode: {
                type: 'string',
                enum: ['single', 'batch'],
                description: 'Analysis mode'
              },
              traceId: {
                type: 'string',
                description: 'For single mode: specific trace to analyze'
              },
              beadIds: {
                type: 'array',
                description: 'For batch mode: analyze traces from these beads',
                items: { type: 'string' }
              },
              minConfidence: {
                type: 'number',
                description: 'Filter insights by minimum confidence (0.0-1.0)',
                minimum: 0.0,
                maximum: 1.0
              },
              minFrequency: {
                type: 'number',
                description: 'For batch mode: minimum error occurrences'
              }
            },
            required: ['mode']
          }
        },
        {
          name: 'ace_update_knowledge',
          description: 'Updates AGENTS.md with learned patterns from insights. Handles deduplication, section routing, and bullet formatting with helpfulness counters.',
          inputSchema: {
            type: 'object',
            properties: {
              minConfidence: {
                type: 'number',
                description: 'Minimum confidence threshold (default: 0.8)',
                minimum: 0.0,
                maximum: 1.0
              },
              maxDeltas: {
                type: 'number',
                description: 'Max updates per session (default: 3)'
              },
              dryRun: {
                type: 'boolean',
                description: 'Preview changes without writing (default: false)'
              },
              forceInsightIds: {
                type: 'array',
                description: 'Force process specific insights regardless of confidence',
                items: { type: 'string' }
              }
            }
          }
        },
        {
          name: 'ace_get_insights',
          description: 'Queries learned patterns and insights from logs/insights.jsonl or AGENTS.md bullets. Read-only operation with filtering and sorting support.',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                enum: ['insights', 'bullets', 'both'],
                description: 'What to query'
              },
              filters: {
                type: 'object',
                description: 'Optional filters',
                properties: {
                  minConfidence: {
                    type: 'number',
                    description: 'Filter by confidence (0.0-1.0)',
                    minimum: 0.0,
                    maximum: 1.0
                  },
                  tags: {
                    type: 'array',
                    description: 'Filter by metaTags (OR logic)',
                    items: { type: 'string' }
                  },
                  sections: {
                    type: 'array',
                    description: 'Filter bullets by section (OR logic)',
                    items: { type: 'string' }
                  },
                  beadIds: {
                    type: 'array',
                    description: 'Filter by related beads',
                    items: { type: 'string' }
                  },
                  after: {
                    type: 'string',
                    description: 'ISO 8601 timestamp: insights after this time'
                  },
                  before: {
                    type: 'string',
                    description: 'ISO 8601 timestamp: insights before this time'
                  }
                }
              },
              limit: {
                type: 'number',
                description: 'Max results to return (default: 50)'
              },
              sortBy: {
                type: 'string',
                enum: ['confidence', 'timestamp', 'helpful'],
                description: 'Sort order'
              }
            },
            required: ['source']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'ace_capture_trace':
            return await this.handleCaptureTrace(request.params.arguments);
          
          case 'ace_analyze_patterns':
            return await this.handleAnalyzePatterns(request.params.arguments);
          
          case 'ace_update_knowledge':
            return await this.handleUpdateKnowledge(request.params.arguments);
          
          case 'ace_get_insights':
            return await this.handleGetInsights(request.params.arguments);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleCaptureTrace(args: any): Promise<any> {
    // TODO: Implement ace_capture_trace handler
    // - Initialize Generator with config paths
    // - Call startTask(beadId, taskDescription)
    // - Call recordExecution() for each execution
    // - Call recordDiscoveredIssue() for each discovered issue
    // - Call completeTask() to finalize and write trace
    // - Return traceId, timestamp, written, bulletsConsulted
    
    console.error('[ace_capture_trace] TODO: Implementation needed');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'ace_capture_trace handler not yet implemented'
          }
        }, null, 2)
      }]
    };
  }

  private async handleAnalyzePatterns(args: any): Promise<any> {
    // TODO: Implement ace_analyze_patterns handler
    // - Initialize Reflector with config paths
    // - For single mode: load specific trace, call analyzeTrace()
    // - For batch mode: call analyzeMultipleTraces() with bead filters
    // - Filter results by minConfidence if provided
    // - Write insights to logs/insights.jsonl
    // - Return insights array, tracesAnalyzed, written
    
    console.error('[ace_analyze_patterns] TODO: Implementation needed');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'ace_analyze_patterns handler not yet implemented'
          }
        }, null, 2)
      }]
    };
  }

  private async handleUpdateKnowledge(args: any): Promise<any> {
    // TODO: Implement ace_update_knowledge handler
    // - Initialize Curator with config paths and maxDeltas
    // - Call processInsights(minConfidence)
    // - In dryRun mode: generate deltas but don't write
    // - Apply section mapping for routing bullets
    // - Update AGENTS.md with new bullets
    // - Return deltas array, duplicatesSkipped, lowConfidenceSkipped, updated
    
    console.error('[ace_update_knowledge] TODO: Implementation needed');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'ace_update_knowledge handler not yet implemented'
          }
        }, null, 2)
      }]
    };
  }

  private async handleGetInsights(args: any): Promise<any> {
    // TODO: Implement ace_get_insights handler
    // - Read-only operation
    // - For insights: parse logs/insights.jsonl
    // - For bullets: parse AGENTS.md using regex
    // - Apply filters: time range → confidence → tags → beadIds → sections
    // - Sort results by specified sortBy field
    // - Apply limit to results
    // - Return insights/bullets arrays, totalMatched, filtered
    
    console.error('[ace_get_insights] TODO: Implementation needed');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'ace_get_insights handler not yet implemented'
          }
        }, null, 2)
      }]
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[ACE MCP Server Error]', error);
    };

    process.on('SIGINT', async () => {
      console.error('[ACE MCP Server] Shutting down...');
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[ACE MCP Server] Started successfully on stdio');
    console.error(`[ACE MCP Server] Config: ${JSON.stringify(this.config, null, 2)}`);
  }
}

export async function initServer(config?: ACEServerConfig): Promise<void> {
  const server = new ACEMCPServer(config);
  await server.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initServer().catch((error) => {
    console.error('[ACE MCP Server] Fatal error:', error);
    process.exit(1);
  });
}

export { ACEMCPServer };
export type { ACEServerConfig };
