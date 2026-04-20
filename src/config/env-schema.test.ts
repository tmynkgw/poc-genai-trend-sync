import { describe, it, expect } from 'vitest';
import { envSchema } from './env-schema.js';

const BASE_ENV = {
  GEMINI_API_KEY: 'gemini-key',
  NOTION_API_KEY: 'notion-key',
  NOTION_PARENT_PAGE_ID: 'parent-page-id',
  GITHUB_TOKEN: 'github-token',
  GITHUB_REPOSITORY: 'owner/repo',
};

describe('envSchema', () => {
  it('NOTION_PARENT_PAGE_ID が設定されていれば成功する', () => {
    const result = envSchema.safeParse(BASE_ENV);
    expect(result.success).toBe(true);
  });

  it('NOTION_PARENT_PAGE_ID が未設定の場合はバリデーションエラー', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { NOTION_PARENT_PAGE_ID, ...env } = BASE_ENV;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('NOTION_PARENT_PAGE_ID_TEST を任意で設定できる', () => {
    const result = envSchema.safeParse({
      ...BASE_ENV,
      NOTION_PARENT_PAGE_ID_TEST: 'test-parent-page-id',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NOTION_PARENT_PAGE_ID_TEST).toBe('test-parent-page-id');
    }
  });

  it('NOTION_PARENT_PAGE_ID_TEST が空文字の場合は undefined になる', () => {
    const result = envSchema.safeParse({
      ...BASE_ENV,
      NOTION_PARENT_PAGE_ID_TEST: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NOTION_PARENT_PAGE_ID_TEST).toBeUndefined();
    }
  });

  it('NOTION_DATABASE_ID は存在しない（廃止済み）', () => {
    const result = envSchema.safeParse(BASE_ENV);
    expect(result.success).toBe(true);
    if (result.success) {
      expect('NOTION_DATABASE_ID' in result.data).toBe(false);
    }
  });
});
