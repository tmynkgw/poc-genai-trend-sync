import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotionSetupService, getDbTitle } from './notion-setup.js';
import type { NotionClient } from '../infra/notion-client.js';

function makeMockNotionClient(): NotionClient {
  return {
    searchDatabase: vi.fn(),
    createDatabase: vi.fn(),
    fetchExistingUrls: vi.fn(),
    createPage: vi.fn(),
    buildPageParams: vi.fn(),
  } as unknown as NotionClient;
}

describe('NotionSetupService', () => {
  let mockClient: NotionClient;
  let service: NotionSetupService;

  beforeEach(() => {
    mockClient = makeMockNotionClient();
    service = new NotionSetupService(mockClient);
  });

  describe('getDbTitle', () => {
    it('日付を "YYYY-MM-DD-AI News" 形式にフォーマットする', () => {
      expect(getDbTitle(new Date('2026-04-20'))).toBe('2026-04-20-AI News');
    });

    it('月・日が1桁の場合はゼロパディングする', () => {
      expect(getDbTitle(new Date('2026-01-05'))).toBe('2026-01-05-AI News');
    });
  });

  describe('findOrCreateDatabase', () => {
    const fixedDate = new Date('2026-04-20');
    const expectedTitle = '2026-04-20-AI News';

    it('既存のデータベースが見つかった場合はそのIDを返す', async () => {
      vi.mocked(mockClient.searchDatabase).mockResolvedValue('existing-db-id');

      const result = await service.findOrCreateDatabase('parent-page-id', fixedDate);

      expect(result).toBe('existing-db-id');
      expect(mockClient.searchDatabase).toHaveBeenCalledWith('parent-page-id', expectedTitle);
      expect(mockClient.createDatabase).not.toHaveBeenCalled();
    });

    it('データベースが見つからない場合は新規作成してIDを返す', async () => {
      vi.mocked(mockClient.searchDatabase).mockResolvedValue(null);
      vi.mocked(mockClient.createDatabase).mockResolvedValue('new-db-id');

      const result = await service.findOrCreateDatabase('parent-page-id', fixedDate);

      expect(result).toBe('new-db-id');
      expect(mockClient.createDatabase).toHaveBeenCalledWith(
        'parent-page-id',
        expectedTitle,
        expect.objectContaining({
          Title: expect.any(Object),
          URL: expect.any(Object),
          'Published At': expect.any(Object),
          Source: expect.any(Object),
          Summary: expect.any(Object),
        }),
      );
    });

    it('新規作成時のスキーマに "Published At" が含まれる', async () => {
      vi.mocked(mockClient.searchDatabase).mockResolvedValue(null);
      vi.mocked(mockClient.createDatabase).mockResolvedValue('new-db-id');

      await service.findOrCreateDatabase('parent-page-id', fixedDate);

      const [, , properties] = vi.mocked(mockClient.createDatabase).mock.calls[0];
      expect(properties).toHaveProperty('Published At');
      expect(properties).not.toHaveProperty('PublishedAt');
    });

    it('新規作成時のスキーマに "Summary" が含まれる', async () => {
      vi.mocked(mockClient.searchDatabase).mockResolvedValue(null);
      vi.mocked(mockClient.createDatabase).mockResolvedValue('new-db-id');

      await service.findOrCreateDatabase('parent-page-id', fixedDate);

      const [, , properties] = vi.mocked(mockClient.createDatabase).mock.calls[0];
      expect(properties).toHaveProperty('Summary');
    });
  });
});
