/**
 * Review Routing Configuration
 * 
 * Configures where ACE reviews should be sent based on event type:
 * - bd comments: Post reviews as bd comments on the bead
 * - new beads: Create new issues for review items
 * - files: Write reviews to log files
 */

export type ReviewDestination = 'bd-comment' | 'new-bead' | 'file' | 'none';

export interface ReviewRoutingConfig {
  /** Where to send reviews for new bead creation */
  onBeadCreated: ReviewDestination;
  
  /** Where to send reviews for bead updates (status changes, etc) */
  onBeadUpdated: ReviewDestination;
  
  /** Where to send reviews for bead closure (execution trace analysis) */
  onBeadClosed: ReviewDestination;
  
  /** Where to send reviews for file changes */
  onFileChanged: ReviewDestination;
  
  /** Where to send knowledge base reviews (duplicates, archival candidates) */
  onKnowledgeReview: ReviewDestination;
  
  /** Custom file path for file-based reviews (default: logs/reviews.jsonl) */
  reviewFilePath?: string;
  
  /** Custom prefix for review beads (default: "[Review]") */
  reviewBeadPrefix?: string;
}

export const DEFAULT_ROUTING_CONFIG: ReviewRoutingConfig = {
  onBeadCreated: 'none',
  onBeadUpdated: 'none',
  onBeadClosed: 'file', // Default: execution trace reviews go to file
  onFileChanged: 'none',
  onKnowledgeReview: 'file', // Default: knowledge reviews go to file
  reviewFilePath: 'logs/reviews.jsonl',
  reviewBeadPrefix: '[Review]',
};

export class ReviewRouter {
  private config: ReviewRoutingConfig;

  constructor(config: Partial<ReviewRoutingConfig> = {}) {
    this.config = { ...DEFAULT_ROUTING_CONFIG, ...config };
  }

  getDestination(
    eventType: keyof Omit<ReviewRoutingConfig, 'reviewFilePath' | 'reviewBeadPrefix'>
  ): ReviewDestination {
    return this.config[eventType];
  }

  getReviewFilePath(): string {
    return this.config.reviewFilePath || DEFAULT_ROUTING_CONFIG.reviewFilePath!;
  }

  getReviewBeadPrefix(): string {
    return this.config.reviewBeadPrefix || DEFAULT_ROUTING_CONFIG.reviewBeadPrefix!;
  }

  updateConfig(updates: Partial<ReviewRoutingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): ReviewRoutingConfig {
    return { ...this.config };
  }
}
