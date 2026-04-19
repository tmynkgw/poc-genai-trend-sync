import Parser from 'rss-parser';
import { InfraError } from '../domain/errors.js';
import { RSS_TIMEOUT_MS } from '../domain/constants.js';

export interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  content?: string;
}

export class RssClient {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      timeout: RSS_TIMEOUT_MS,
      headers: { 'User-Agent': 'genai-trend-sync/1.0' },
    });
  }

  async fetchFeed(feedUrl: string): Promise<RssItem[]> {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      return (feed.items ?? []).map((item) => ({
        title: item.title ?? '',
        link: item.link ?? '',
        pubDate: item.pubDate ?? item.isoDate ?? '',
        contentSnippet: item.contentSnippet,
        content: item.content,
      }));
    } catch (err) {
      throw new InfraError(`Failed to fetch RSS feed: ${feedUrl}`, err);
    }
  }
}
