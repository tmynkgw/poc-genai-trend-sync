import { describe, it, expect, vi, afterEach } from 'vitest';
import { NotionPublisher } from '../../../src/services/notion-publisher.js';
import type { RawArticle, ReconstructedContent, GeneratedImage, ExecutionConfig } from '../../../src/domain/types.js';

const mockNotionClient = {
  buildPageParams: vi.fn().mockReturnValue({}),
  createPage: vi.fn().mockResolvedValue('page-id-123'),
};

const mockImageHostClient = {
  uploadImage: vi.fn().mockResolvedValue('https://raw.githubusercontent.com/owner/repo/generated-images/2026/04/abc123.png'),
};

const config: ExecutionConfig = {
  maxArticles: 5,
  lookbackDays: 7,
  testMode: false,
  notionDatabaseId: 'db-id',
  notionParentPageId: 'parent-page-id',
};

const article: RawArticle = {
  sourceId: 'openai',
  sourceName: 'OpenAI',
  title: 'GPT-5 Released',
  url: 'https://openai.com/blog/gpt-5',
  publishedAt: new Date('2026-04-14'),
  rawContent: 'content',
};

const content: ReconstructedContent = {
  titleJa: 'GPT-5リリース',
  overview: '概要テスト',
  technicalImpact: '技術的インパクト',
  context: '背景',
  insights: '示唆',
  imagePrompt: 'image prompt',
};

const image: GeneratedImage = {
  data: Buffer.from('fake'),
  mimeType: 'image/png',
  prompt: 'image prompt',
};

describe('NotionPublisher', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('画像あり時は notionPageId を返す', async () => {
    const publisher = new NotionPublisher(
      mockNotionClient as never,
      mockImageHostClient as never,
      config,
    );
    const pageId = await publisher.publish(article, content, image);
    expect(pageId).toBe('page-id-123');
    expect(mockImageHostClient.uploadImage).toHaveBeenCalledOnce();
    expect(mockNotionClient.createPage).toHaveBeenCalledOnce();
  });

  it('画像なし時でも Notion に投稿できる', async () => {
    const publisher = new NotionPublisher(
      mockNotionClient as never,
      mockImageHostClient as never,
      config,
    );
    const pageId = await publisher.publish(article, content, null);
    expect(pageId).toBe('page-id-123');
    expect(mockImageHostClient.uploadImage).not.toHaveBeenCalled();
  });

  it('画像アップロード失敗時でも Notion に投稿を継続する', async () => {
    mockImageHostClient.uploadImage.mockRejectedValueOnce(new Error('upload failed'));
    const publisher = new NotionPublisher(
      mockNotionClient as never,
      mockImageHostClient as never,
      config,
    );
    const pageId = await publisher.publish(article, content, image);
    expect(pageId).toBe('page-id-123');
  });
});
