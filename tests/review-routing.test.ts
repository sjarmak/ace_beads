import { describe, it, expect } from 'vitest';
import { ReviewRouter, DEFAULT_ROUTING_CONFIG, ReviewRoutingConfig } from '../src/review-routing.js';

describe('ReviewRouter', () => {
  it('should use default config when no config provided', () => {
    const router = new ReviewRouter();
    expect(router.getConfig()).toEqual(DEFAULT_ROUTING_CONFIG);
  });

  it('should merge partial config with defaults', () => {
    const router = new ReviewRouter({ onBeadClosed: 'bd-comment' });
    const config = router.getConfig();
    
    expect(config.onBeadClosed).toBe('bd-comment');
    expect(config.onBeadCreated).toBe(DEFAULT_ROUTING_CONFIG.onBeadCreated);
  });

  it('should get destination for event types', () => {
    const router = new ReviewRouter({
      onBeadClosed: 'new-bead',
      onKnowledgeReview: 'file',
    });

    expect(router.getDestination('onBeadClosed')).toBe('new-bead');
    expect(router.getDestination('onKnowledgeReview')).toBe('file');
  });

  it('should update config dynamically', () => {
    const router = new ReviewRouter();
    
    router.updateConfig({ onBeadCreated: 'bd-comment' });
    
    expect(router.getConfig().onBeadCreated).toBe('bd-comment');
  });

  it('should get review file path from config', () => {
    const router = new ReviewRouter({ reviewFilePath: 'custom/path.jsonl' });
    expect(router.getReviewFilePath()).toBe('custom/path.jsonl');
  });

  it('should get review bead prefix from config', () => {
    const router = new ReviewRouter({ reviewBeadPrefix: '[ACE]' });
    expect(router.getReviewBeadPrefix()).toBe('[ACE]');
  });

  it('should use default paths when not specified', () => {
    const router = new ReviewRouter();
    expect(router.getReviewFilePath()).toBe('logs/reviews.jsonl');
    expect(router.getReviewBeadPrefix()).toBe('[Review]');
  });

  it('should support all destination types', () => {
    const destinations: Array<ReviewRoutingConfig['onBeadClosed']> = [
      'bd-comment',
      'new-bead',
      'file',
      'none',
    ];

    destinations.forEach(dest => {
      const router = new ReviewRouter({ onBeadClosed: dest });
      expect(router.getDestination('onBeadClosed')).toBe(dest);
    });
  });
});
