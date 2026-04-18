import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints.js';
import type { NotionClient } from '../infra/notion-client.js';
import type { ImageHostClient } from '../infra/image-host-client.js';
import type { RawArticle, ReconstructedContent, GeneratedImage, ExecutionConfig } from '../domain/types.js';
import { NotionPublishError } from '../domain/errors.js';
import { generateArticleId } from '../utils/slug.js';
import { logger } from '../utils/logger.js';

export class NotionPublisher {
  constructor(
    private notionClient: NotionClient,
    private imageHostClient: ImageHostClient,
    private config: ExecutionConfig,
  ) {}

  async publish(
    article: RawArticle,
    content: ReconstructedContent,
    image: GeneratedImage | null,
  ): Promise<string> {
    let imageUrl: string | null = null;

    if (image) {
      try {
        const articleId = generateArticleId(article.url);
        imageUrl = await this.imageHostClient.uploadImage(articleId, image.data, image.mimeType);
        logger.info(
          { component: 'NotionPublisher', articleUrl: article.url, imageUrl },
          'image uploaded',
        );
      } catch (err) {
        logger.warn(
          { component: 'NotionPublisher', articleUrl: article.url, err },
          'image upload failed, publishing without image',
        );
      }
    }

    const blocks = this.buildBlocks(content, article.url, imageUrl);
    const params = this.notionClient.buildPageParams(
      this.config.notionDatabaseId,
      content.titleJa,
      article.sourceName,
      article.url,
      article.publishedAt,
      new Date(),
      imageUrl !== null,
      imageUrl,
      blocks,
    );

    try {
      const pageId = await this.notionClient.createPage(params);
      logger.info(
        { component: 'NotionPublisher', articleUrl: article.url, pageId },
        'page.published',
      );
      return pageId;
    } catch (err) {
      throw new NotionPublishError(`Failed to publish to Notion: ${String(err)}`, err);
    }
  }

  private buildBlocks(
    content: ReconstructedContent,
    originalUrl: string,
    imageUrl: string | null,
  ): BlockObjectRequest[] {
    const blocks: BlockObjectRequest[] = [];

    if (imageUrl) {
      blocks.push({
        type: 'image',
        image: { type: 'external', external: { url: imageUrl } },
      });
    }

    const addSection = (heading: string, text: string) => {
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: heading } }] },
      });
      blocks.push({
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
      });
    };

    addSection('概要', content.overview);
    addSection('技術的インパクト', content.technicalImpact);
    addSection('背景', content.context);
    addSection('所感・示唆', content.insights);

    blocks.push({ type: 'divider', divider: {} });
    blocks.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: '元記事: ' } },
          { type: 'text', text: { content: originalUrl, link: { url: originalUrl } } },
        ],
      },
    });

    return blocks;
  }
}
