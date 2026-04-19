import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../src/orchestrator/orchestrator.js';
import type { ExecutionConfig, RssSource, RawArticle, ReconstructedContent, GeneratedImage } from '../../src/domain/types.js';
import fixtureContent from '../fixtures/gemini/reconstruct-response.json' assert { type: 'json' };

const config: ExecutionConfig = {
  maxArticles: 5,
  lookbackDays: 7,
  testMode: false,
  notionDatabaseId: 'test-db-id',
};

const sources: RssSource[] = [
  { id: 'openai', name: 'OpenAI', feedUrl: 'https://openai.com/news/rss.xml' },
];

function makeRecentArticle(url: string): RawArticle {
  return {
    sourceId: 'openai',
    sourceName: 'OpenAI',
    title: 'Test Article',
    url,
    publishedAt: new Date(),
    rawContent: 'content',
  };
}

describe('Orchestrator happy path', () => {
  let mockCollector: { collect: ReturnType<typeof vi.fn> };
  let mockFilter: { filter: ReturnType<typeof vi.fn> };
  let mockReconstructor: { reconstruct: ReturnType<typeof vi.fn> };
  let mockImageGenerator: { generate: ReturnType<typeof vi.fn> };
  let mockPublisher: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const articles = [
      makeRecentArticle('https://openai.com/blog/gpt-5'),
      makeRecentArticle('https://openai.com/blog/gpt-5-api'),
    ];
    const articlesBySource = new Map([['openai', articles]]);

    mockCollector = { collect: vi.fn().mockResolvedValue(articlesBySource) };
    mockFilter = {
      filter: vi.fn().mockResolvedValue({
        kept: articles,
        droppedByDate: [],
        droppedByDuplicate: [],
      }),
    };
    mockReconstructor = {
      reconstruct: vi.fn().mockResolvedValue(fixtureContent as ReconstructedContent),
    };
    const fakeImage: GeneratedImage = {
      data: Buffer.from('img'),
      mimeType: 'image/png',
      prompt: 'prompt',
    };
    mockImageGenerator = { generate: vi.fn().mockResolvedValue(fakeImage) };
    mockPublisher = { publish: vi.fn().mockResolvedValue('page-id') };
  });

  it('全記事が正常に処理される', async () => {
    const orchestrator = new Orchestrator(
      mockCollector as never,
      mockFilter as never,
      mockReconstructor as never,
      mockImageGenerator as never,
      mockPublisher as never,
    );

    const summary = await orchestrator.run(config, sources);

    expect(summary.counts.published).toBe(2);
    expect(summary.counts.skippedError).toBe(0);
    expect(summary.counts.withImage).toBe(2);
    expect(mockPublisher.publish).toHaveBeenCalledTimes(2);
  });
});
