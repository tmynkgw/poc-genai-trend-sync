import { z } from 'zod';
import {
  DEFAULT_MAX_ARTICLES,
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_GEMINI_IMAGE_MODEL,
} from '../domain/constants.js';

export const envSchema = z
  .object({
  GEMINI_API_KEY: z.string().min(1),
  NOTION_API_KEY: z.string().min(1),
  NOTION_DATABASE_ID: z.string().min(1).optional(),
  NOTION_PARENT_PAGE_ID: z.string().min(1).optional(),
  NOTION_DATABASE_ID_TEST: z.string().optional(),
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_REPOSITORY: z.string().regex(/^[^/]+\/[^/]+$/),
  MAX_ARTICLES: z.coerce.number().int().positive().default(DEFAULT_MAX_ARTICLES),
  LOOKBACK_DAYS: z.coerce.number().int().positive().default(DEFAULT_LOOKBACK_DAYS),
  TEST_MODE: z.coerce.boolean().default(false),
  GEMINI_TEXT_MODEL: z.string().default(DEFAULT_GEMINI_TEXT_MODEL),
  GEMINI_IMAGE_MODEL: z.string().default(DEFAULT_GEMINI_IMAGE_MODEL),
  // RSSフィードURLのオーバーライド（設定時はsources.jsonのデフォルト値を上書き）
  FEED_URL_OPENAI: z.string().url().optional(),
  FEED_URL_ANTHROPIC: z.string().url().optional(),
  FEED_URL_GOOGLE_DEEPMIND: z.string().url().optional(),
})
.refine(
  (env) => env.NOTION_DATABASE_ID || env.NOTION_PARENT_PAGE_ID,
  { message: 'NOTION_DATABASE_ID または NOTION_PARENT_PAGE_ID のいずれかを設定してください' },
);

export type EnvConfig = z.infer<typeof envSchema>;
