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
