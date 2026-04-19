import type { ArticleCollector } from '../services/article-collector.js';
import type { ArticleFilter } from '../services/article-filter.js';
import type { ContentReconstructor } from '../services/content-reconstructor.js';
import type { ImageGenerator } from '../services/image-generator.js';
import type { NotionPublisher } from '../services/notion-publisher.js';
import type {
  ExecutionConfig,
  RssSource,
  ExecutionSummary,
  ArticleResult,
} from '../domain/types.js';
import { ConfigError, ReconstructError, ImageGenError, NotionPublishError } from '../domain/errors.js';
import { logger } from '../utils/logger.js';

export class Orchestrator {
  constructor(
    private collector: ArticleCollector,
    private filter: ArticleFilter,
    private reconstructor: ContentReconstructor,
    private imageGenerator: ImageGenerator,
    private publisher: NotionPublisher,
  ) {}

  async run(config: ExecutionConfig, sources: RssSource[]): Promise<ExecutionSummary> {
    const startedAt = new Date();

    if (config.testMode) {
      logger.info(
        {
          component: 'Orchestrator',
          testMode: true,
          maxArticles: config.maxArticles,
          lookbackDays: config.lookbackDays,
        },
        `[TEST MODE] max_articles=${config.maxArticles}, lookback_days=${config.lookbackDays}`,
      );
    }

    const articlesBySource = await this.collector.collect(sources);
    const sourceStats = sources.map((s) => ({
      sourceId: s.id,
      fetched: articlesBySource.get(s.id)?.length ?? 0,
      filtered: 0,
    }));

    const { kept, droppedByDuplicate } = await this.filter.filter(
      articlesBySource,
      config.notionDatabaseId,
    );

    // ソース別のフィルタ後件数を集計
    for (const stat of sourceStats) {
      stat.filtered = kept.filter((a) => a.sourceId === stat.sourceId).length;
    }

    const results: ArticleResult[] = [];

    // 重複スキップは結果として記録
    for (const article of droppedByDuplicate) {
      results.push({ article, status: 'skipped_duplicate', hasImage: false });
    }

    // Notion API のレート制限回避のため記事単位で直列処理
    for (const article of kept) {
      try {
        const content = await this.reconstructor.reconstruct(article);
        const image = await this.imageGenerator.generate(content.imagePrompt, article.url);
        const notionPageId = await this.publisher.publish(article, content, image);

        results.push({
          article,
          status: 'published',
          hasImage: image !== null,
          notionPageId,
        });
      } catch (err) {
        // Notion認証エラーは設定ミスのため全体を停止させる
        if (err instanceof ConfigError) throw err;
        const errorMessage = String(err);
        logger.error(
          { component: 'Orchestrator', articleUrl: article.url, err },
          'article processing failed',
        );
        results.push({
          article,
          status: 'skipped_error',
          failureStage: this.detectFailureStage(err),
          errorMessage,
          hasImage: false,
        });
      }
    }

    const finishedAt = new Date();
    const counts = {
      published: results.filter((r) => r.status === 'published').length,
      skippedDuplicate: results.filter((r) => r.status === 'skipped_duplicate').length,
      skippedError: results.filter((r) => r.status === 'skipped_error').length,
      withImage: results.filter((r) => r.status === 'published' && r.hasImage).length,
      withoutImage: results.filter((r) => r.status === 'published' && !r.hasImage).length,
    };

    logger.info(
      {
        component: 'Orchestrator',
        testMode: config.testMode,
        sources: sources.length,
        ...counts,
      },
      `[Summary] testMode=${config.testMode}, sources=${sources.length}, published=${counts.published}, skipped_duplicate=${counts.skippedDuplicate}, skipped_error=${counts.skippedError}, withImage=${counts.withImage}, withoutImage=${counts.withoutImage}`,
    );

    return {
      startedAt,
      finishedAt,
      testMode: config.testMode,
      sources: sourceStats,
      results,
      counts,
    };
  }

  private detectFailureStage(err: unknown): 'reconstruct' | 'image' | 'notion' | undefined {
    if (err instanceof ReconstructError) return 'reconstruct';
    if (err instanceof ImageGenError) return 'image';
    if (err instanceof NotionPublishError) return 'notion';
    return undefined;
  }
}
