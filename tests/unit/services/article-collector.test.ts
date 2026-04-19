import { describe, it, expect, vi, afterEach } from 'vitest';
import { ArticleCollector } from '../../../src/services/article-collector.js';
import { InfraError } from '../../../src/domain/errors.js';
import type { RssSource } from '../../../src/domain/types.js';

const sources: RssSource[] = [
  { id: 'openai', name: 'OpenAI', feedUrl: 'https://openai.com/rss' },
  { id: 'anthropic', name: 'Anthropic', feedUrl: 'https://anthropic.com/rss' },
];

const mockRssClient = {
  fetchFeed: vi.fn(),
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('ArticleCollector', () => {
  it('全ソース成功時に各ソースのRawArticle[]を返す', async () => {
    mockRssClient.fetchFeed
      .mockResolvedValueOnce([
        { title: 'GPT-5', link: 'https://openai.com/gpt-5', pubDate: new Date().toISOString(), contentSnippet: 'content' },
      ])
      .mockResolvedValueOnce([
        { title: 'Claude 4', link: 'https://anthropic.com/claude-4', pubDate: new Date().toISOString(), contentSnippet: 'content' },
      ]);

    const collector = new ArticleCollector(mockRssClient as never);
    const result = await collector.collect(sources);

    expect(result.get('openai')).toHaveLength(1);
    expect(result.get('anthropic')).toHaveLength(1);
    expect(result.get('openai')?.[0]?.url).toBe('https://openai.com/gpt-5');
  });

  it('1ソースのfetchFeedが失敗しても他ソースの記事は返される', async () => {
    mockRssClient.fetchFeed
      .mockRejectedValueOnce(new InfraError('RSS fetch failed'))
      .mockResolvedValueOnce([
        { title: 'Claude 4', link: 'https://anthropic.com/claude-4', pubDate: new Date().toISOString(), contentSnippet: 'content' },
      ]);

    const collector = new ArticleCollector(mockRssClient as never);
    const result = await collector.collect(sources);

    expect(result.get('openai')).toHaveLength(0);
    expect(result.get('anthropic')).toHaveLength(1);
  });

  it('link または title が空のアイテムはフィルタリングされる', async () => {
    mockRssClient.fetchFeed.mockResolvedValue([
      { title: '', link: 'https://openai.com/1', pubDate: new Date().toISOString(), contentSnippet: 'c' },
      { title: 'Valid', link: '', pubDate: new Date().toISOString(), contentSnippet: 'c' },
      { title: 'Valid Article', link: 'https://openai.com/valid', pubDate: new Date().toISOString(), contentSnippet: 'c' },
    ]);

    const collector = new ArticleCollector(mockRssClient as never);
    const result = await collector.collect([sources[0]!]);

    expect(result.get('openai')).toHaveLength(1);
    expect(result.get('openai')?.[0]?.url).toBe('https://openai.com/valid');
  });
});
