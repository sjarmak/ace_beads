export interface ACEConfig {
  agentsPath: string;
  logsDir: string;
  insightsPath: string;
  tracesPath: string;
  maxDeltas: number;
  defaultConfidence: number;
}

export interface InitOptions {
  agentsPath?: string;
  logsDir?: string;
  yes?: boolean;
  json?: boolean;
}

export interface InitResult {
  created: string[];
  skipped: string[];
  agentsPath: string;
  logsDir: string;
  tracesPath: string;
  insightsPath: string;
}

export interface ExecutionError {
  tool: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line: number;
  column?: number;
}

export interface ExecutionResult {
  runner: string;
  command: string;
  status: 'pass' | 'fail';
  errors: ExecutionError[];
}

export interface CLIError {
  code: string;
  message: string;
  details?: any;
}

// ACE Framework Types
export interface ACESession {
  id: string;
  beadId: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'failed';
  traces: ExecutionTrace[];
}

export interface ExecutionTrace {
  timestamp: string;
  tool: string;
  command?: string;
  result: ExecutionResult;
  discoveredIssues: string[]; // Bead IDs discovered during this execution
}

export interface Insight {
  id: string;
  sessionId: string;
  pattern: string;
  description: string;
  evidence: string[];
  confidence: number;
  bulletId?: string; // If this insight led to a bullet
  createdAt: string;
}

export interface Bullet {
  id: string;
  pattern: string;
  description: string;
  helpful: number;
  harmful: number;
  createdAt: string;
  sources: string[]; // Insight IDs that contributed to this bullet
}
