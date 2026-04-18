import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../../src/orchestrator/orchestrator.js';
import type { ExecutionConfig, RssSource, RawArticle, ReconstructedContent } from '../../src/domain/types.js';
import fixtureContent from '../fixtures/gemini/reconstruct-response.json' assert { type: 'json' };

const config: ExecutionConfig = {
  maxArticles: 5,
  lookbackDays: 7,
  testMode: false,
  notionDatabaseId: 'db-id',
};

const sources: RssSource[] = [{ id: 'openai', name: 'OpenAI', feedUrl: 'url' }];

describe('Orchestrator image failure', () => {
  it('画像生成が失敗しても記事はテキストのみで投稿される', async () => {
    const articles: RawArticle[] = [
      { sourceId: 'openai', sourceName: 'OpenAI', title: 'T', url: 'https://example.com/1', publishedAt: new Date(), rawContent: 'c' },
    ];
    const articlesBySource = new Map([['openai', articles]]);

    const mockCollector = { collect: vi.fn().mockResolvedValue(articlesBySource) };
    const mockFilter = {
      filter: vi.fn().mockResolvedValue({ kept: articles, droppedByDate: [], droppedByDuplicate: [] }),
    };
    const mockReconstructor = {
      reconstruct: vi.fn().mockResolvedValue(fixtureContent as ReconstructedContent),
    };
    // ImageGenerator は null を返す（失敗してもnullを返す設計）
    const mockImageGenerator = { generate: vi.fn().mockResolvedValue(null) };
    const mockPublisher = { publish: vi.fn().mockResolvedValue('page-id') };

    const orchestrator = new Orchestrator(
      mockCollector as never,
      mockFilter as never,
      mockReconstructor as never,
      mockImageGenerator as never,
      mockPublisher as never,
    );

    const summary = await orchestrator.run(config, sources);

    expect(summary.counts.published).toBe(1);
    expect(summary.counts.withoutImage).toBe(1);
    expect(summary.counts.withImage).toBe(0);
    expect(mockPublisher.publish).toHaveBeenCalledWith(articles[0], fixtureContent, null);
  });
});
