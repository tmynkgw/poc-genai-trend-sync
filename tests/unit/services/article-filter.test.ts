import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArticleFilter } from '../../../src/services/article-filter.js';
import type { RawArticle, ExecutionConfig } from '../../../src/domain/types.js';

const mockNotionClient = {
  fetchExistingUrls: vi.fn(),
};

const baseConfig: ExecutionConfig = {
  maxArticles: 5,
  lookbackDays: 7,
  testMode: false,
  notionDatabaseId: 'db-id',
  notionParentPageId: 'parent-page-id',
};

function makeArticle(url: string, daysAgo: number): RawArticle {
  const publishedAt = new Date();
  publishedAt.setDate(publishedAt.getDate() - daysAgo);
  return {
    sourceId: 'openai',
    sourceName: 'OpenAI',
    title: `Article ${url}`,
    url,
    publishedAt,
    rawContent: 'content',
  };
}

describe('ArticleFilter', () => {
  beforeEach(() => {
    mockNotionClient.fetchExistingUrls.mockResolvedValue(new Set<string>());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lookbackDays より古い記事は除外される', async () => {
    const filter = new ArticleFilter(mockNotionClient as never, baseConfig);
    const articles = [
      makeArticle('https://example.com/new', 2),
      makeArticle('https://example.com/old', 10),
    ];
    const articlesBySource = new Map([['openai', articles]]);
    const { kept, droppedByDate } = await filter.filter(articlesBySource, 'db-id');
    expect(kept).toHaveLength(1);
    expect(kept[0]?.url).toBe('https://example.com/new');
    expect(droppedByDate).toHaveLength(1);
  });

  it('Notion に既存のURLと一致する記事は重複として除外される', async () => {
    mockNotionClient.fetchExistingUrls.mockResolvedValue(
      new Set(['https://example.com/existing']),
    );
    const filter = new ArticleFilter(mockNotionClient as never, baseConfig);
    const articles = [
      makeArticle('https://example.com/existing', 1),
      makeArticle('https://example.com/new', 1),
    ];
    const articlesBySource = new Map([['openai', articles]]);
    const { kept, droppedByDuplicate } = await filter.filter(articlesBySource, 'db-id');
    expect(kept).toHaveLength(1);
    expect(kept[0]?.url).toBe('https://example.com/new');
    expect(droppedByDuplicate).toHaveLength(1);
  });

  it('maxArticles を超える記事はソースごとに切り詰められる', async () => {
    const config = { ...baseConfig, maxArticles: 2 };
    const filter = new ArticleFilter(mockNotionClient as never, config);
    const articles = [
      makeArticle('https://example.com/1', 1),
      makeArticle('https://example.com/2', 1),
      makeArticle('https://example.com/3', 1),
    ];
    const articlesBySource = new Map([['openai', articles]]);
    const { kept } = await filter.filter(articlesBySource, 'db-id');
    expect(kept).toHaveLength(2);
  });
});
