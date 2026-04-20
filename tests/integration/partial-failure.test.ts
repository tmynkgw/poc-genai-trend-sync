import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../../src/orchestrator/orchestrator.js';
import { ReconstructError } from '../../src/domain/errors.js';
import type { ExecutionConfig, RssSource, RawArticle, ReconstructedContent, GeneratedImage } from '../../src/domain/types.js';
import fixtureContent from '../fixtures/gemini/reconstruct-response.json' assert { type: 'json' };

const config: ExecutionConfig = {
  maxArticles: 5,
  lookbackDays: 7,
  testMode: false,
  notionDatabaseId: 'db-id',
  notionParentPageId: 'parent-page-id',
};

const sources: RssSource[] = [{ id: 'openai', name: 'OpenAI', feedUrl: 'url' }];

function makeArticle(url: string): RawArticle {
  return { sourceId: 'openai', sourceName: 'OpenAI', title: 'T', url, publishedAt: new Date(), rawContent: 'c' };
}

describe('Orchestrator partial failure', () => {
  it('1件でLLM失敗しても他2件は投稿される', async () => {
    const articles = [
      makeArticle('https://example.com/1'),
      makeArticle('https://example.com/2'),
      makeArticle('https://example.com/3'),
    ];
    const articlesBySource = new Map([['openai', articles]]);

    const mockCollector = { collect: vi.fn().mockResolvedValue(articlesBySource) };
    const mockFilter = {
      filter: vi.fn().mockResolvedValue({ kept: articles, droppedByDate: [], droppedByDuplicate: [] }),
    };
    const mockReconstructor = {
      reconstruct: vi.fn()
        .mockRejectedValueOnce(new ReconstructError('LLM failed'))
        .mockResolvedValue(fixtureContent as ReconstructedContent),
    };
    const fakeImage: GeneratedImage = { data: Buffer.from('img'), mimeType: 'image/png', prompt: 'p' };
    const mockImageGenerator = { generate: vi.fn().mockResolvedValue(fakeImage) };
    const mockPublisher = { publish: vi.fn().mockResolvedValue('page-id') };

    const orchestrator = new Orchestrator(
      mockCollector as never,
      mockFilter as never,
      mockReconstructor as never,
      mockImageGenerator as never,
      mockPublisher as never,
    );

    const summary = await orchestrator.run(config, sources);

    expect(summary.counts.published).toBe(2);
    expect(summary.counts.skippedError).toBe(1);
    expect(summary.results.find((r) => r.status === 'skipped_error')?.failureStage).toBe('reconstruct');
  });
});
