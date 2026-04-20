import { Client, APIResponseError } from '@notionhq/client';
import type {
  BlockObjectRequest,
  CreatePageParameters,
  CreateDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints.js';
import { InfraError, ConfigError } from '../domain/errors.js';

export class NotionClient {
  private client: Client;

  constructor(apiKey: string) {
    this.client = new Client({ auth: apiKey });
  }

  async fetchExistingUrls(databaseId: string): Promise<Set<string>> {
    const urls = new Set<string>();
    let cursor: string | undefined;

    try {
      do {
        const response = await this.client.databases.query({
          database_id: databaseId,
          start_cursor: cursor,
          page_size: 100,
          filter_properties: ['URL'],
        });

        for (const page of response.results) {
          if ('properties' in page) {
            const urlProp = page.properties['URL'];
            if (urlProp?.type === 'url' && typeof urlProp.url === 'string') {
              urls.add(urlProp.url);
            }
          }
        }

        cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
      } while (cursor);
    } catch (err) {
      if (err instanceof APIResponseError && (err.status === 401 || err.status === 403)) {
        throw new ConfigError(`Notion authentication failed: ${String(err)}`, err);
      }
      throw new InfraError(`Failed to fetch existing URLs from Notion: ${String(err)}`, err);
    }

    return urls;
  }

  async createPage(params: CreatePageParameters): Promise<string> {
    try {
      const page = await this.client.pages.create(params);
      return page.id;
    } catch (err) {
      if (err instanceof APIResponseError && (err.status === 401 || err.status === 403)) {
        throw new ConfigError(`Notion authentication failed: ${String(err)}`, err);
      }
      throw new InfraError(`Failed to create Notion page: ${String(err)}`, err);
    }
  }

  async searchDatabase(parentPageId: string, title: string): Promise<string | null> {
    try {
      const response = await this.client.search({
        query: title,
        filter: { property: 'object', value: 'database' },
      });
      for (const result of response.results) {
        if (
          result.object === 'database' &&
          'parent' in result &&
          result.parent.type === 'page_id' &&
          result.parent.page_id.replace(/-/g, '') === parentPageId.replace(/-/g, '') &&
          'title' in result &&
          Array.isArray(result.title) &&
          result.title.map((t: { plain_text: string }) => t.plain_text).join('') === title
        ) {
          return result.id;
        }
      }
      return null;
    } catch (err) {
      if (err instanceof APIResponseError && (err.status === 401 || err.status === 403)) {
        throw new ConfigError(`Notion authentication failed: ${String(err)}`, err);
      }
      throw new InfraError(`Failed to search Notion database: ${String(err)}`, err);
    }
  }

  async createDatabase(
    parentPageId: string,
    title: string,
    properties: CreateDatabaseParameters['properties'],
  ): Promise<string> {
    try {
      const db = await this.client.databases.create({
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: title } }],
        properties,
      });
      return db.id;
    } catch (err) {
      if (err instanceof APIResponseError && (err.status === 401 || err.status === 403)) {
        throw new ConfigError(`Notion authentication failed: ${String(err)}`, err);
      }
      if (err instanceof APIResponseError && (err.status === 404 || err.status === 400)) {
        throw new ConfigError(
          `Failed to create Notion database: parent page not found or inaccessible (${String(err)})`,
          err,
        );
      }
      throw new InfraError(`Failed to create Notion database: ${String(err)}`, err);
    }
  }

  buildPageParams(
    databaseId: string,
    title: string,
    source: string,
    url: string,
    publishedAt: Date,
    syncedAt: Date,
    hasImage: boolean,
    imageUrl: string | null,
    blocks: BlockObjectRequest[],
    summary: string,
  ): CreatePageParameters {
    const coverImage = imageUrl
      ? { cover: { type: 'external' as const, external: { url: imageUrl } } }
      : {};

    return {
      parent: { database_id: databaseId },
      ...coverImage,
      properties: {
        title: { title: [{ text: { content: title } }] },
        Source: { select: { name: source } },
        URL: { url },
        'Published At': { date: { start: publishedAt.toISOString() } },
        SyncedAt: { date: { start: syncedAt.toISOString() } },
        HasImage: { checkbox: hasImage },
        Summary: { rich_text: [{ type: 'text', text: { content: summary } }] },
      },
      children: blocks,
    };
  }
}
