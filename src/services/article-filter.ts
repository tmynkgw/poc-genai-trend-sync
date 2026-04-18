import type { NotionClient } from '../infra/notion-client.js';
import type { RawArticle, ExecutionConfig } from '../domain/types.js';
import { isWithinLookback } from '../utils/date.js';
import { logger } from '../utils/logger.js';

export interface FilterResult {
  kept: RawArticle[];
  droppedByDate: RawArticle[];
  droppedByDuplicate: RawArticle[];
}

export class ArticleFilter {
  constructor(
    private notionClient: NotionClient,
    private config: ExecutionConfig,
  ) {}

  async filter(
    articlesBySource: Map<string, RawArticle[]>,
    databaseId: string,
  ): Promise<FilterResult> {
    const existingUrls = await this.notionClient.fetchExistingUrls(databaseId);
    logger.info(
      { component: 'ArticleFilter', existingCount: existingUrls.size },
      'fetched existing URLs',
    );

    const kept: RawArticle[] = [];
    const droppedByDate: RawArticle[] = [];
    const droppedByDuplicate: RawArticle[] = [];

    for (const [sourceId, articles] of articlesBySource) {
      const afterDateFilter = articles.filter((a) => {
        if (isWithinLookback(a.publishedAt, this.config.lookbackDays)) {
          return true;
        }
        droppedByDate.push(a);
        return false;
      });

      const afterDuplicateFilter = afterDateFilter.filter((a) => {
        if (existingUrls.has(a.url)) {
          droppedByDuplicate.push(a);
          return false;
        }
        return true;
      });

      const limited = afterDuplicateFilter.slice(0, this.config.maxArticles);
      kept.push(...limited);

      logger.info(
        {
          component: 'ArticleFilter',
          sourceId,
          total: articles.length,
          afterDate: afterDateFilter.length,
          afterDuplicate: afterDuplicateFilter.length,
          kept: limited.length,
        },
        'filtered articles',
      );
    }

    return { kept, droppedByDate, droppedByDuplicate };
  }
}
