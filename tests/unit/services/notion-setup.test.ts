import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotionSetupService, getDbTitle } from '../../../src/services/notion-setup.js';
import { ConfigError, InfraError } from '../../../src/domain/errors.js';

const mockNotionClient = {
  searchDatabase: vi.fn(),
  createDatabase: vi.fn(),
};

const PARENT_PAGE_ID = 'parent-page-id';

describe('NotionSetupService.findOrCreateDatabase', () => {
  let service: NotionSetupService;

  beforeEach(() => {
    service = new NotionSetupService(mockNotionClient as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const fixedDate = new Date('2026-04-20');
  const expectedTitle = '2026-04-20-AI News';

  it('getDbTitle が日付を "YYYY-MM-DD-AI News" 形式にフォーマットする', () => {
    expect(getDbTitle(fixedDate)).toBe(expectedTitle);
  });

  it('同名 DB が存在する場合は既存 ID を返す', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue('existing-db-id');

    const result = await service.findOrCreateDatabase(PARENT_PAGE_ID, fixedDate);

    expect(result).toBe('existing-db-id');
    expect(mockNotionClient.searchDatabase).toHaveBeenCalledWith(PARENT_PAGE_ID, expectedTitle);
    expect(mockNotionClient.createDatabase).not.toHaveBeenCalled();
  });

  it('DB が存在しない場合は新規作成して ID を返す', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue(null);
    mockNotionClient.createDatabase.mockResolvedValue('new-db-id');

    const result = await service.findOrCreateDatabase(PARENT_PAGE_ID, fixedDate);

    expect(result).toBe('new-db-id');
    expect(mockNotionClient.createDatabase).toHaveBeenCalledWith(
      PARENT_PAGE_ID,
      expectedTitle,
      expect.objectContaining({
        Title: { title: {} },
        Source: expect.objectContaining({ select: expect.any(Object) }),
        URL: { url: {} },
        'Published At': { date: {} },
        Summary: { rich_text: {} },
        SyncedAt: { date: {} },
        HasImage: { checkbox: {} },
      }),
    );
  });

  it('新規作成時のスキーマに "Published At" が含まれ "PublishedAt" は含まれない', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue(null);
    mockNotionClient.createDatabase.mockResolvedValue('new-db-id');

    await service.findOrCreateDatabase(PARENT_PAGE_ID, fixedDate);

    const [, , properties] = mockNotionClient.createDatabase.mock.calls[0];
    expect(properties).toHaveProperty('Published At');
    expect(properties).not.toHaveProperty('PublishedAt');
  });

  it('searchDatabase が ConfigError を throw した場合はそのまま伝播する', async () => {
    mockNotionClient.searchDatabase.mockRejectedValue(new ConfigError('auth failed'));

    await expect(service.findOrCreateDatabase(PARENT_PAGE_ID, fixedDate)).rejects.toThrow(ConfigError);
  });

  it('createDatabase が InfraError を throw した場合はそのまま伝播する', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue(null);
    mockNotionClient.createDatabase.mockRejectedValue(new InfraError('create failed'));

    await expect(service.findOrCreateDatabase(PARENT_PAGE_ID, fixedDate)).rejects.toThrow(InfraError);
  });
});
