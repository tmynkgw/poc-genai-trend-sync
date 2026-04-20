import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfigLoader } from '../../../src/config/config-loader.js';
import { ConfigError } from '../../../src/domain/errors.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function stubValidEnv() {
  vi.stubEnv('GEMINI_API_KEY', 'gemini-key');
  vi.stubEnv('NOTION_API_KEY', 'notion-key');
  vi.stubEnv('NOTION_PARENT_PAGE_ID', 'parent-page-id');
  vi.stubEnv('GITHUB_TOKEN', 'gh-token');
  vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo');
}

const mockNotionClient = {
  searchDatabase: vi.fn(),
  createDatabase: vi.fn(),
};

describe('ConfigLoader.loadEnv', () => {
  it('有効な環境変数からEnvConfigを返す', () => {
    stubValidEnv();
    const env = new ConfigLoader().loadEnv();
    expect(env.GEMINI_API_KEY).toBe('gemini-key');
    expect(env.MAX_ARTICLES).toBe(5);
    expect(env.LOOKBACK_DAYS).toBe(7);
    expect(env.TEST_MODE).toBe(false);
  });

  it('必須環境変数が欠落している場合 ConfigError を投げる', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(() => new ConfigLoader().loadEnv()).toThrow(ConfigError);
  });

  it('NOTION_PARENT_PAGE_ID が設定されていれば有効な環境変数として通る', () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key');
    vi.stubEnv('NOTION_API_KEY', 'notion-key');
    vi.stubEnv('NOTION_PARENT_PAGE_ID', 'parent-id');
    vi.stubEnv('GITHUB_TOKEN', 'gh-token');
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo');
    const env = new ConfigLoader().loadEnv();
    expect(env.NOTION_PARENT_PAGE_ID).toBe('parent-id');
  });

  it('NOTION_PARENT_PAGE_ID が未設定の場合 ConfigError を投げる', () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key');
    vi.stubEnv('NOTION_API_KEY', 'notion-key');
    vi.stubEnv('GITHUB_TOKEN', 'gh-token');
    vi.stubEnv('GITHUB_REPOSITORY', 'owner/repo');
    expect(() => new ConfigLoader().loadEnv()).toThrow(ConfigError);
  });
});

const baseEnv = {
  GEMINI_API_KEY: 'k',
  NOTION_API_KEY: 'k',
  NOTION_PARENT_PAGE_ID: 'parent-page-id',
  GITHUB_TOKEN: 'k',
  GITHUB_REPOSITORY: 'o/r',
  MAX_ARTICLES: 5,
  LOOKBACK_DAYS: 7,
  TEST_MODE: false,
  GEMINI_TEXT_MODEL: 'gemini-2.5-pro',
  GEMINI_IMAGE_MODEL: 'gemini-2.0-flash-preview-image-generation',
};

describe('ConfigLoader.loadExecutionConfig', () => {
  const loader = new ConfigLoader();

  it('CLIの引数がenv変数より優先される', () => {
    const config = loader.loadExecutionConfig(
      { maxArticles: 2, lookbackDays: 3, test: false },
      baseEnv,
      'resolved-db-id',
    );
    expect(config.maxArticles).toBe(2);
    expect(config.lookbackDays).toBe(3);
  });

  it('notionDatabaseId に渡した ID がそのまま設定される', () => {
    const config = loader.loadExecutionConfig({}, baseEnv, 'my-db-id');
    expect(config.notionDatabaseId).toBe('my-db-id');
  });

  it('テストモード時に notionParentPageId_TEST を使用する', () => {
    const envWithTest = { ...baseEnv, NOTION_PARENT_PAGE_ID_TEST: 'test-parent-id' };
    const config = loader.loadExecutionConfig({ test: true }, envWithTest, 'db-id');
    expect(config.testMode).toBe(true);
    expect(config.notionParentPageId).toBe('test-parent-id');
  });

  it('テストモードで NOTION_PARENT_PAGE_ID_TEST 未設定時は NOTION_PARENT_PAGE_ID を使用する', () => {
    const config = loader.loadExecutionConfig({ test: true }, baseEnv, 'db-id');
    expect(config.notionParentPageId).toBe('parent-page-id');
  });

  it('引数未指定の場合はenvのデフォルト値を使用する', () => {
    const config = loader.loadExecutionConfig({}, baseEnv, 'db-id');
    expect(config.maxArticles).toBe(5);
    expect(config.lookbackDays).toBe(7);
  });
});

describe('ConfigLoader.loadSources', () => {
  const loader = new ConfigLoader();

  it('FEED_URL_ANTHROPIC が設定されている場合はfeedUrlが上書きされる', () => {
    const overrideUrl = 'https://example.com/anthropic-custom-rss.xml';
    const env = { ...baseEnv, FEED_URL_ANTHROPIC: overrideUrl };
    const sources = loader.loadSources(env);
    const anthropic = sources.find((s) => s.id === 'anthropic');
    expect(anthropic?.feedUrl).toBe(overrideUrl);
  });

  it('FEED_URL_ANTHROPIC が未設定の場合はsources.jsonのデフォルト値を使用する', () => {
    const sources = loader.loadSources(baseEnv);
    const anthropic = sources.find((s) => s.id === 'anthropic');
    expect(anthropic?.feedUrl).toBe('https://raw.githubusercontent.com/0xSMW/rss-feeds/main/feeds/feed_anthropic_news.xml');
  });

  it('FEED_URL_OPENAI が設定されている場合はOpenAIのfeedUrlが上書きされる', () => {
    const overrideUrl = 'https://openai.com/custom-rss.xml';
    const env = { ...baseEnv, FEED_URL_OPENAI: overrideUrl };
    const sources = loader.loadSources(env);
    const openai = sources.find((s) => s.id === 'openai');
    expect(openai?.feedUrl).toBe(overrideUrl);
  });

  it('FEED_URL_GOOGLE_DEEPMIND が設定されている場合はGoogle DeepMindのfeedUrlが上書きされる', () => {
    const overrideUrl = 'https://deepmind.google/custom-rss.xml';
    const env = { ...baseEnv, FEED_URL_GOOGLE_DEEPMIND: overrideUrl };
    const sources = loader.loadSources(env);
    const gDeepmind = sources.find((s) => s.id === 'google-deepmind');
    expect(gDeepmind?.feedUrl).toBe(overrideUrl);
  });

  it('全ソースのid・nameは環境変数に関わらず変わらない', () => {
    const sources = loader.loadSources(baseEnv);
    expect(sources.map((s) => s.id)).toEqual(['openai', 'anthropic', 'google-deepmind']);
    expect(sources.map((s) => s.name)).toEqual(['OpenAI', 'Anthropic', 'Google DeepMind']);
  });
});

describe('ConfigLoader.resolveNotionDatabaseId', () => {
  const loader = new ConfigLoader();

  it('通常モードで NOTION_PARENT_PAGE_ID を使って findOrCreateDatabase を呼ぶ', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue('auto-db-id');

    const result = await loader.resolveNotionDatabaseId(baseEnv, mockNotionClient as never, false);

    expect(result).toBe('auto-db-id');
    expect(mockNotionClient.searchDatabase).toHaveBeenCalledWith('parent-page-id', 'AI Trend Sync DB');
  });

  it('テストモード時は NOTION_PARENT_PAGE_ID_TEST を使って findOrCreateDatabase を呼ぶ', async () => {
    const envWithTest = { ...baseEnv, NOTION_PARENT_PAGE_ID_TEST: 'test-parent-id' };
    mockNotionClient.searchDatabase.mockResolvedValue('test-db-id');

    await loader.resolveNotionDatabaseId(envWithTest, mockNotionClient as never, true);

    expect(mockNotionClient.searchDatabase).toHaveBeenCalledWith('test-parent-id', 'AI Trend Sync DB');
  });

  it('テストモードで NOTION_PARENT_PAGE_ID_TEST 未設定時は NOTION_PARENT_PAGE_ID を使用する', async () => {
    mockNotionClient.searchDatabase.mockResolvedValue('fallback-db-id');

    await loader.resolveNotionDatabaseId(baseEnv, mockNotionClient as never, true);

    expect(mockNotionClient.searchDatabase).toHaveBeenCalledWith('parent-page-id', 'AI Trend Sync DB');
  });
});
