import type { CreateDatabaseParameters } from '@notionhq/client/build/src/api-endpoints.js';
import type { NotionClient } from '../infra/notion-client.js';
import { logger } from '../utils/logger.js';

export const DB_TITLE = 'AI Trend Sync DB';

const DB_PROPERTIES: CreateDatabaseParameters['properties'] = {
  Title: { title: {} },
  URL: { url: {} },
  'Published At': { date: {} },
  Source: {
    select: {
      options: [
        { name: 'OpenAI', color: 'green' },
        { name: 'Anthropic', color: 'orange' },
        { name: 'Google DeepMind', color: 'blue' },
      ],
    },
  },
  Summary: { rich_text: {} },
  SyncedAt: { date: {} },
  HasImage: { checkbox: {} },
};

export class NotionSetupService {
  constructor(private notionClient: NotionClient) {}

  async findOrCreateDatabase(parentPageId: string): Promise<string> {
    const existingId = await this.notionClient.searchDatabase(parentPageId, DB_TITLE);
    if (existingId) {
      logger.info(
        { component: 'NotionSetupService', databaseId: existingId, title: DB_TITLE },
        'reusing existing Notion database',
      );
      return existingId;
    }

    const newId = await this.notionClient.createDatabase(parentPageId, DB_TITLE, DB_PROPERTIES);
    logger.info(
      { component: 'NotionSetupService', databaseId: newId, title: DB_TITLE },
      'created new Notion database',
    );
    return newId;
  }
}
