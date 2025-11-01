export type Role = 'generator' | 'reflector' | 'curator';

export interface FilePermission {
  role: Role;
  operation: 'read' | 'write';
  pathPattern: string;
  allowed: boolean;
}

export interface ExecutionResult {
  status: 'pass' | 'fail';
  errors: NormalizedError[];
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  timestamp: string;
}

export interface NormalizedError {
  tool: 'tsc' | 'eslint' | 'vitest' | 'unknown';
  file: string;
  line?: number;
  column?: number;
  code?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface Insight {
  id: string;
  timestamp: string;
  taskId: string;
  source: {
    runner?: string;
    beadIds?: string[];
  };
  signal: {
    pattern: string;
    evidence: string[];
  };
  recommendation: string;
  scope: {
    glob?: string;
    files?: string[];
  };
  confidence: number;
  onlineEligible: boolean;
  metaTags: string[];
}

export interface Delta {
  id: string;
  timestamp: string;
  scope: string;
  rationale: string;
  confidence: number;
  patch: string;
}

export interface AmpThreadMetadata {
  thread_id: string;
  thread_url: string;
  thread_title?: string;
  workspace_id: string;
  created_by_agent?: 'generator' | 'reflector' | 'curator' | 'user';
  created_in_context?: 'main-thread' | 'subagent-thread' | 'handoff';
  main_thread_id?: string;
  parent_thread_id?: string;
  handoff_goal?: string;
  last_notified_at?: string;
  notification_count: number;
  thread_created_at: string;
  thread_updated_at: string;
  synced_at: string;
}

export type NotificationEventType =
  | 'bead_created'
  | 'bead_completed'
  | 'bead_blocked'
  | 'knowledge_updated'
  | 'meta_bead_created'
  | 'review_needed'
  | 'discovery_chain';

export interface NotificationPayload {
  summary: string;
  details?: {
    bullets_added?: number;
    bullets_updated?: number;
    meta_beads_created?: string[];
    discovered_issues?: string[];
    confidence?: number;
    review_type?: 'conflicting-feedback' | 'low-confidence' | 'consolidation';
  };
  action_required?: boolean;
  action_url?: string;
}

export interface BeadNotificationEvent {
  event_id: string;
  timestamp: string;
  bead_id: string;
  thread_id: string;
  event_type: NotificationEventType;
  payload: NotificationPayload;
}
