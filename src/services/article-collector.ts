import type { RssClient } from '../infra/rss-client.js';
import type { RawArticle, RssSource } from '../domain/types.js';
import { logger } from '../utils/logger.js';

export class ArticleCollector {
  constructor(private rssClient: RssClient) {}

  async collect(sources: RssSource[]): Promise<Map<string, RawArticle[]>> {
    const results = await Promise.allSettled(
      sources.map((source) => this.collectFromSource(source)),
    );

    const articlesBySource = new Map<string, RawArticle[]>();
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = sources[i];
      if (!result || !source) continue;

      if (result.status === 'fulfilled') {
        articlesBySource.set(source.id, result.value);
        logger.info(
          { component: 'ArticleCollector', sourceId: source.id, count: result.value.length },
          'collected articles',
        );
      } else {
        logger.warn(
          { component: 'ArticleCollector', sourceId: source.id, err: result.reason },
          'failed to collect from source',
        );
        articlesBySource.set(source.id, []);
      }
    }

    return articlesBySource;
  }

  private async collectFromSource(source: RssSource): Promise<RawArticle[]> {
    const items = await this.rssClient.fetchFeed(source.feedUrl);
    return items
      .filter((item) => item.link && item.title)
      .map((item) => ({
        sourceId: source.id,
        sourceName: source.name,
        title: item.title,
        url: item.link,
        publishedAt: new Date(item.pubDate || Date.now()),
        rawContent: item.contentSnippet ?? item.content ?? '',
      }));
  }
}
