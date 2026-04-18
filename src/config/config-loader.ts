import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { envSchema } from './env-schema.js';
import type { ExecutionConfig, RssSource } from '../domain/types.js';
import { ConfigError } from '../domain/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sourcesSchema = z.object({
  sources: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      feedUrl: z.string().url(),
    }),
  ),
});

export interface CliArgs {
  maxArticles?: number;
  lookbackDays?: number;
  test?: boolean;
}

export class ConfigLoader {
  loadEnv(): z.infer<typeof envSchema> {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      throw new ConfigError(
        `Invalid environment variables: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      );
    }
    return result.data;
  }

  loadExecutionConfig(args: CliArgs, env: z.infer<typeof envSchema>): ExecutionConfig {
    const testMode = args.test ?? env.TEST_MODE;
    const notionDatabaseId = testMode
      ? (env.NOTION_DATABASE_ID_TEST ?? env.NOTION_DATABASE_ID)
      : env.NOTION_DATABASE_ID;

    return {
      maxArticles: args.maxArticles ?? env.MAX_ARTICLES,
      lookbackDays: args.lookbackDays ?? env.LOOKBACK_DAYS,
      testMode,
      notionDatabaseId,
    };
  }

  loadSources(env: z.infer<typeof envSchema>): RssSource[] {
    const sourcesPath = join(__dirname, '../../config/sources.json');
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
    } catch (err) {
      throw new ConfigError(`Failed to read sources.json: ${String(err)}`, err);
    }
    const result = sourcesSchema.safeParse(raw);
    if (!result.success) {
      throw new ConfigError(`Invalid sources.json: ${result.error.message}`);
    }

    // FEED_URL_{ID_UPPER} 形式の環境変数でfeedUrlをオーバーライド
    return result.data.sources.map((source) => {
      const envKey = `FEED_URL_${source.id.toUpperCase().replace(/-/g, '_')}` as keyof typeof env;
      const overrideUrl = env[envKey];
      if (typeof overrideUrl === 'string' && overrideUrl) {
        return { ...source, feedUrl: overrideUrl };
      }
      return source;
    });
  }
}
