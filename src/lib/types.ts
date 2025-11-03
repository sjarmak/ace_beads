import { z } from 'zod';

export const KnowledgeBulletSchema = z.object({
  id: z.string(),
  section: z.string(),
  content: z.string(),
  helpful: z.number().int().min(0),
  harmful: z.number().int().min(0),
  hash: z.string().optional(),
  provenance: z.object({
    deltaId: z.string(),
    beadsId: z.string(),
    createdAt: z.string(),
  }).optional(),
});

export type KnowledgeBullet = z.infer<typeof KnowledgeBulletSchema>;

export const ExecutionResultSchema = z.object({
  runner: z.string(),
  command: z.string(),
  status: z.enum(['pass', 'fail']),
  errors: z.array(z.object({
    tool: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
    message: z.string(),
    file: z.string(),
    line: z.number().int(),
    column: z.number().int().optional(),
  })),
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

export const ThreadCitationSchema = z.object({
  thread_id: z.string(),
  message_id: z.string().optional(),
  quote: z.string(),
  rationale: z.string(),
});

export type ThreadCitation = z.infer<typeof ThreadCitationSchema>;

export const ExecutionTraceSchema = z.object({
  trace_id: z.string(),
  timestamp: z.string(),
  bead_id: z.string(),
  task_description: z.string(),
  execution_results: z.array(ExecutionResultSchema),
  discovered_issues: z.array(z.string()),
  outcome: z.enum(['success', 'failure', 'partial']),
  thread_refs: z.array(z.string()).optional(),
  thread_summary: z.string().optional(),
  thread_citations: z.array(ThreadCitationSchema).optional(),
});

export type ExecutionTrace = z.infer<typeof ExecutionTraceSchema>;

export const InsightSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  taskId: z.string(),
  source: z.object({
    runner: z.string().optional(),
    beadIds: z.array(z.string()).optional(),
  }),
  signal: z.object({
    pattern: z.string(),
    evidence: z.array(z.string()),
  }),
  recommendation: z.string(),
  scope: z.object({
    glob: z.string().optional(),
    files: z.array(z.string()).optional(),
  }),
  confidence: z.number().min(0).max(1),
  onlineEligible: z.boolean(),
  delta: z.object({
    section: z.string(),
    operation: z.enum(['add', 'remove', 'refine']),
    bulletId: z.string().optional(),
    content: z.string().optional(),
  }),
  metaTags: z.array(z.string()).optional(),
  thread_refs: z.array(z.string()).optional(),
});

export type Insight = z.infer<typeof InsightSchema>;

export interface PlaybookMetrics {
  totalBullets: number;
  avgHelpfulScore: number;
  avgHarmfulScore: number;
  netScore: number;
  sectionDistribution: Record<string, number>;
  topPerformingBullets: KnowledgeBullet[];
  lowPerformingBullets: KnowledgeBullet[];
}
