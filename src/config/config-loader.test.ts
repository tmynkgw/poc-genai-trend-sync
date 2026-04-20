import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigLoader } from './config-loader.js';
import type { NotionClient } from '../infra/notion-client.js';
import type { EnvConfig } from './env-schema.js';

vi.mock('../services/notion-setup.js', () => ({
  NotionSetupService: vi.fn().mockImplementation(() => ({
    findOrCreateDatabase: vi.fn().mockResolvedValue('resolved-db-id'),
  })),
}));

function makeMockNotionClient(): NotionClient {
  return {} as NotionClient;
}

const BASE_ENV: EnvConfig = {
  GEMINI_API_KEY: 'gemini-key',
  NOTION_API_KEY: 'notion-key',
  NOTION_PARENT_PAGE_ID: 'parent-page-id',
  GITHUB_TOKEN: 'github-token',
  GITHUB_REPOSITORY: 'owner/repo',
  MAX_ARTICLES: 10,
  LOOKBACK_DAYS: 7,
  TEST_MODE: false,
  GEMINI_TEXT_MODEL: 'gemini-pro',
  GEMINI_IMAGE_MODEL: 'gemini-image',
};

describe('ConfigLoader', () => {
  let loader: ConfigLoader;
  let mockClient: NotionClient;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new ConfigLoader();
    mockClient = makeMockNotionClient();
  });

  describe('resolveNotionDatabaseId', () => {
    it('通常モードで NOTION_PARENT_PAGE_ID を使用して DB を解決する', async () => {
      const { NotionSetupService } = await import('../services/notion-setup.js');
      const fixedDate = new Date('2026-04-20');

      const result = await loader.resolveNotionDatabaseId(BASE_ENV, mockClient, false, fixedDate);

      expect(result).toBe('resolved-db-id');
      expect(NotionSetupService).toHaveBeenCalledWith(mockClient);
      const instance = vi.mocked(NotionSetupService).mock.results[0].value;
      expect(instance.findOrCreateDatabase).toHaveBeenCalledWith('parent-page-id', fixedDate);
    });

    it('テストモードで NOTION_PARENT_PAGE_ID_TEST を優先使用する', async () => {
      const { NotionSetupService } = await import('../services/notion-setup.js');
      const envWithTest: EnvConfig = {
        ...BASE_ENV,
        NOTION_PARENT_PAGE_ID_TEST: 'test-parent-page-id',
      };
      const fixedDate = new Date('2026-04-20');

      await loader.resolveNotionDatabaseId(envWithTest, mockClient, true, fixedDate);

      const instance = vi.mocked(NotionSetupService).mock.results[0].value;
      expect(instance.findOrCreateDatabase).toHaveBeenCalledWith('test-parent-page-id', fixedDate);
    });

    it('テストモードで NOTION_PARENT_PAGE_ID_TEST が未設定の場合は NOTION_PARENT_PAGE_ID を使用する', async () => {
      const { NotionSetupService } = await import('../services/notion-setup.js');
      const fixedDate = new Date('2026-04-20');

      await loader.resolveNotionDatabaseId(BASE_ENV, mockClient, true, fixedDate);

      const instance = vi.mocked(NotionSetupService).mock.results[0].value;
      expect(instance.findOrCreateDatabase).toHaveBeenCalledWith('parent-page-id', fixedDate);
    });
  });
});
