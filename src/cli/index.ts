import { parseArgs } from './args.js';
import { ConfigLoader } from '../config/config-loader.js';
import { ConfigError } from '../domain/errors.js';
import { RssClient } from '../infra/rss-client.js';
import { GeminiClient } from '../infra/gemini-client.js';
import { ImageGenClient } from '../infra/image-gen-client.js';
import { NotionClient } from '../infra/notion-client.js';
import { ImageHostClient } from '../infra/image-host-client.js';
import { ArticleCollector } from '../services/article-collector.js';
import { ArticleFilter } from '../services/article-filter.js';
import { ContentReconstructor } from '../services/content-reconstructor.js';
import { ImageGenerator } from '../services/image-generator.js';
import { NotionPublisher } from '../services/notion-publisher.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { logger } from '../utils/logger.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const configLoader = new ConfigLoader();

  let env: ReturnType<ConfigLoader['loadEnv']>;
  try {
    env = configLoader.loadEnv();
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.fatal({ component: 'CLI', err }, err.message);
      process.exit(1);
    }
    throw err;
  }

  const config = configLoader.loadExecutionConfig(
    { maxArticles: args.maxArticles, lookbackDays: args.lookbackDays, test: args.test },
    env,
  );

  let sources: ReturnType<ConfigLoader['loadSources']>;
  try {
    sources = configLoader.loadSources(env);
  } catch (err) {
    if (err instanceof ConfigError) {
      logger.fatal({ component: 'CLI', err }, err.message);
      process.exit(1);
    }
    throw err;
  }

  const rssClient = new RssClient();
  const geminiClient = new GeminiClient(env.GEMINI_API_KEY);
  const imageGenClient = new ImageGenClient(env.GEMINI_API_KEY);
  const notionClient = new NotionClient(env.NOTION_API_KEY);
  const imageHostClient = new ImageHostClient(env.GITHUB_TOKEN, env.GITHUB_REPOSITORY);

  const collector = new ArticleCollector(rssClient);
  const filter = new ArticleFilter(notionClient, config);
  const reconstructor = new ContentReconstructor(geminiClient, env.GEMINI_TEXT_MODEL);
  const imageGenerator = new ImageGenerator(imageGenClient, env.GEMINI_IMAGE_MODEL);
  const publisher = new NotionPublisher(notionClient, imageHostClient, config);

  const orchestrator = new Orchestrator(
    collector,
    filter,
    reconstructor,
    imageGenerator,
    publisher,
  );

  try {
    const summary = await orchestrator.run(config, sources);

    if (process.env['GITHUB_STEP_SUMMARY']) {
      const { writeFile } = await import('node:fs/promises');
      const md = [
        '## genai-trend-sync 実行結果',
        `- testMode: ${summary.testMode}`,
        `- sources: ${summary.sources.length}`,
        `- published: ${summary.counts.published}`,
        `- skipped_duplicate: ${summary.counts.skippedDuplicate}`,
        `- skipped_error: ${summary.counts.skippedError}`,
        `- withImage: ${summary.counts.withImage}`,
        `- withoutImage: ${summary.counts.withoutImage}`,
      ].join('\n');
      await writeFile(process.env['GITHUB_STEP_SUMMARY'], md, { flag: 'a' });
    }

    process.exit(0);
  } catch (err) {
    logger.fatal({ component: 'CLI', err }, 'fatal error');
    process.exit(1);
  }
}

main();
