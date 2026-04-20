import type { CreateDatabaseParameters } from '@notionhq/client/build/src/api-endpoints.js';
import type { NotionClient } from '../infra/notion-client.js';
import { logger } from '../utils/logger.js';

export function getDbTitle(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-AI News`;
}

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

  async findOrCreateDatabase(parentPageId: string, date: Date = new Date()): Promise<string> {
    const title = getDbTitle(date);
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
