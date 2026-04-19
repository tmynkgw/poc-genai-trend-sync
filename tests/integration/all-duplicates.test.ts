import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../../src/orchestrator/orchestrator.js';
import type { ExecutionConfig, RssSource, RawArticle } from '../../src/domain/types.js';

const config: ExecutionConfig = {
  maxArticles: 5,
  lookbackDays: 7,
  testMode: false,
  notionDatabaseId: 'db-id',
};

const sources: RssSource[] = [{ id: 'openai', name: 'OpenAI', feedUrl: 'url' }];

describe('Orchestrator all duplicates', () => {
  it('全記事が重複の場合は投稿0件で正常終了する', async () => {
    const articles: RawArticle[] = [
      { sourceId: 'openai', sourceName: 'OpenAI', title: 'T', url: 'https://example.com/dup', publishedAt: new Date(), rawContent: 'c' },
    ];
    const articlesBySource = new Map([['openai', articles]]);

    const mockCollector = { collect: vi.fn().mockResolvedValue(articlesBySource) };
    const mockFilter = {
      filter: vi.fn().mockResolvedValue({
        kept: [],
        droppedByDate: [],
        droppedByDuplicate: articles,
      }),
    };
    const mockReconstructor = { reconstruct: vi.fn() };
    const mockImageGenerator = { generate: vi.fn() };
    const mockPublisher = { publish: vi.fn() };

    const orchestrator = new Orchestrator(
      mockCollector as never,
      mockFilter as never,
      mockReconstructor as never,
      mockImageGenerator as never,
      mockPublisher as never,
    );

    const summary = await orchestrator.run(config, sources);

    expect(summary.counts.published).toBe(0);
    expect(summary.counts.skippedDuplicate).toBe(1);
    expect(mockReconstructor.reconstruct).not.toHaveBeenCalled();
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });
});
