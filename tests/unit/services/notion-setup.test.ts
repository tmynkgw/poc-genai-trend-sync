import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotionSetupService } from '../../../src/services/notion-setup.js';
import { ConfigError, InfraError } from '../../../src/domain/errors.js';

const mockNotionClient = {
  searchDatabase: vi.fn(),
  createDatabase: vi.fn(),
};

const PARENT_PAGE_ID = 'parent-page-id';
const TEST_DATE = new Date('2026-04-18T00:00:00Z');
const EXPECTED_TITLE = '2026-04-18-GenAI-Trend-News';

describe('NotionSetupService.findOrCreateDatabase', () => {
  let service: NotionSetupService;

  beforeEach(() => {
    service = new NotionSetupService(mockNotionClient as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('同名 DB が存在する場合は既存 ID を返す', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue('existing-db-id');

    const result = await service.findOrCreateDatabase(PARENT_PAGE_ID, TEST_DATE);

    expect(result).toBe('existing-db-id');
    expect(mockNotionClient.searchDatabase).toHaveBeenCalledWith(PARENT_PAGE_ID, EXPECTED_TITLE);
    expect(mockNotionClient.createDatabase).not.toHaveBeenCalled();
  });

  it('DB が存在しない場合は新規作成して ID を返す', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue(null);
    mockNotionClient.createDatabase.mockResolvedValue('new-db-id');

    const result = await service.findOrCreateDatabase(PARENT_PAGE_ID, TEST_DATE);

    expect(result).toBe('new-db-id');
    expect(mockNotionClient.createDatabase).toHaveBeenCalledWith(
      PARENT_PAGE_ID,
      EXPECTED_TITLE,
      expect.objectContaining({
        Title: { title: {} },
        Source: expect.objectContaining({ select: expect.any(Object) }),
        URL: { url: {} },
        PublishedAt: { date: {} },
        SyncedAt: { date: {} },
        HasImage: { checkbox: {} },
      }),
    );
  });

  it('DB 名が YYYY-MM-DD-GenAI-Trend-News 形式になる', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue(null);
    mockNotionClient.createDatabase.mockResolvedValue('new-db-id');

    await service.findOrCreateDatabase(PARENT_PAGE_ID, new Date('2026-01-05T00:00:00Z'));

    expect(mockNotionClient.searchDatabase).toHaveBeenCalledWith(
      PARENT_PAGE_ID,
      '2026-01-05-GenAI-Trend-News',
    );
  });

  it('searchDatabase が ConfigError を throw した場合はそのまま伝播する', async () => {
    mockNotionClient.searchDatabase.mockRejectedValue(new ConfigError('auth failed'));

    await expect(service.findOrCreateDatabase(PARENT_PAGE_ID, TEST_DATE)).rejects.toThrow(
      ConfigError,
    );
  });

  it('createDatabase が InfraError を throw した場合はそのまま伝播する', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue(null);
    mockNotionClient.createDatabase.mockRejectedValue(new InfraError('create failed'));

    await expect(service.findOrCreateDatabase(PARENT_PAGE_ID, TEST_DATE)).rejects.toThrow(
      InfraError,
    );
  });
});
