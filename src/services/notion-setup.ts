import type { CreateDatabaseParameters } from '@notionhq/client/build/src/api-endpoints.js';
import type { NotionClient } from '../infra/notion-client.js';
import { logger } from '../utils/logger.js';

const DB_PROPERTIES: CreateDatabaseParameters['properties'] = {
  Title: { title: {} },
  Source: {
    select: {
      options: [
        { name: 'OpenAI', color: 'green' },
        { name: 'Anthropic', color: 'orange' },
        { name: 'Google DeepMind', color: 'blue' },
      ],
    },
  },
  URL: { url: {} },
  PublishedAt: { date: {} },
  SyncedAt: { date: {} },
  HasImage: { checkbox: {} },
};

function formatDbTitle(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}-GenAI-Trend-News`;
}

export class NotionSetupService {
  constructor(private notionClient: NotionClient) {}

  async findOrCreateDatabase(parentPageId: string, date: Date): Promise<string> {
    const title = formatDbTitle(date);

    const existingId = await this.notionClient.searchDatabase(parentPageId, title);
    if (existingId) {
      logger.info(
        { component: 'NotionSetupService', databaseId: existingId, title },
        'reusing existing Notion database',
      );
      return existingId;
    }

    const newId = await this.notionClient.createDatabase(parentPageId, title, DB_PROPERTIES);
    logger.info(
      { component: 'NotionSetupService', databaseId: newId, title },
      'created new Notion database',
    );
    return newId;
  }
}
