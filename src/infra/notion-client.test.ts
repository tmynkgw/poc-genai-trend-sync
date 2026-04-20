import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotionClient } from './notion-client.js';
import { ConfigError } from '../domain/errors.js';
import { APIResponseError } from '@notionhq/client';

const mockSearch = vi.fn();
const mockDatabasesCreate = vi.fn();
const mockDatabasesQuery = vi.fn();
const mockPagesCreate = vi.fn();

vi.mock('@notionhq/client', () => {
  class APIResponseError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = 'APIResponseError';
    }
  }
  return {
    Client: vi.fn().mockImplementation(() => ({
      search: mockSearch,
      databases: {
        create: mockDatabasesCreate,
        query: mockDatabasesQuery,
      },
      pages: {
        create: mockPagesCreate,
      },
    })),
    APIResponseError,
  };
});

describe('NotionClient', () => {
  let client: NotionClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new NotionClient('test-api-key');
  });

  describe('searchDatabase', () => {
    it('タイトルと親ページIDが一致するDBが見つかった場合にIDを返す', async () => {
      mockSearch.mockResolvedValue({
        results: [
          {
            object: 'database',
            id: 'found-db-id',
            parent: { type: 'page_id', page_id: 'parent-page-id' },
            title: [{ plain_text: 'AI Trend Sync DB' }],
          },
        ],
      });

      const result = await client.searchDatabase('parent-page-id', 'AI Trend Sync DB');
      expect(result).toBe('found-db-id');
    });

    it('一致するDBがない場合は null を返す', async () => {
      mockSearch.mockResolvedValue({ results: [] });

      const result = await client.searchDatabase('parent-page-id', 'AI Trend Sync DB');
      expect(result).toBeNull();
    });

    it('401 認証エラーの場合は ConfigError を投げる', async () => {
      // APIResponseError のモック実装を直接生成してステータスを設定
      const err = Object.assign(new APIResponseError('unauthorized' as never), { status: 401 });
      mockSearch.mockRejectedValue(err);

      await expect(client.searchDatabase('parent-page-id', 'AI Trend Sync DB')).rejects.toThrow(ConfigError);
    });

    it('親ページIDが異なるDBは無視する', async () => {
      mockSearch.mockResolvedValue({
        results: [
          {
            object: 'database',
            id: 'other-db-id',
            parent: { type: 'page_id', page_id: 'different-parent-id' },
            title: [{ plain_text: 'AI Trend Sync DB' }],
          },
        ],
      });

      const result = await client.searchDatabase('parent-page-id', 'AI Trend Sync DB');
      expect(result).toBeNull();
    });
  });

  describe('createDatabase', () => {
    it('データベースを作成してIDを返す', async () => {
      mockDatabasesCreate.mockResolvedValue({ id: 'new-db-id' });

      const result = await client.createDatabase('parent-page-id', 'AI Trend Sync DB', {
        Title: { title: {} },
      });

      expect(result).toBe('new-db-id');
      expect(mockDatabasesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { type: 'page_id', page_id: 'parent-page-id' },
        }),
      );
    });
  });

  describe('buildPageParams', () => {
    it('"Published At" プロパティ名を使用する', () => {
      const params = client.buildPageParams(
        'db-id',
        'テストタイトル',
        'OpenAI',
        'https://example.com',
        new Date('2024-01-01'),
        new Date(),
        false,
        null,
        [],
        '概要テキスト',
      );

      expect(params.properties).toHaveProperty('Published At');
      expect(params.properties).not.toHaveProperty('PublishedAt');
    });

    it('"Summary" rich_text プロパティを含む', () => {
      const params = client.buildPageParams(
        'db-id',
        'テストタイトル',
        'OpenAI',
        'https://example.com',
        new Date('2024-01-01'),
        new Date(),
        false,
        null,
        [],
        '概要テキスト',
      );

      expect(params.properties).toHaveProperty('Summary');
      const summary = params.properties['Summary'] as { rich_text: Array<{ text: { content: string } }> };
      expect(summary.rich_text[0].text.content).toBe('概要テキスト');
    });

    it('database_id が parent に設定される', () => {
      const params = client.buildPageParams(
        'test-db-id',
        'タイトル',
        'Anthropic',
        'https://example.com/article',
        new Date(),
        new Date(),
        false,
        null,
        [],
        '要約',
      );

      expect(params.parent).toEqual({ database_id: 'test-db-id' });
    });
  });
});
