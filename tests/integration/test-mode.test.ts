import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../../src/orchestrator/orchestrator.js';
import type { ExecutionConfig, RssSource, RawArticle, ReconstructedContent, GeneratedImage } from '../../src/domain/types.js';
import fixtureContent from '../fixtures/gemini/reconstruct-response.json' assert { type: 'json' };

const sources: RssSource[] = [{ id: 'openai', name: 'OpenAI', feedUrl: 'url' }];

describe('Orchestrator test mode', () => {
  it('テストモード時は testMode=true の ExecutionSummary を返す', async () => {
    const testConfig: ExecutionConfig = {
      maxArticles: 1,
      lookbackDays: 3,
      testMode: true,
      notionDatabaseId: 'test-db-id',
    };

    const article: RawArticle = {
      sourceId: 'openai',
      sourceName: 'OpenAI',
      title: 'T',
      url: 'https://example.com/1',
      publishedAt: new Date(),
      rawContent: 'c',
    };
    const articlesBySource = new Map([['openai', [article]]]);

    const mockCollector = { collect: vi.fn().mockResolvedValue(articlesBySource) };
    const mockFilter = {
      filter: vi.fn().mockResolvedValue({ kept: [article], droppedByDate: [], droppedByDuplicate: [] }),
    };
    const mockReconstructor = { reconstruct: vi.fn().mockResolvedValue(fixtureContent as ReconstructedContent) };
    const fakeImage: GeneratedImage = { data: Buffer.from('img'), mimeType: 'image/png', prompt: 'p' };
    const mockImageGenerator = { generate: vi.fn().mockResolvedValue(fakeImage) };
    const mockPublisher = { publish: vi.fn().mockResolvedValue('test-page-id') };

    const orchestrator = new Orchestrator(
      mockCollector as never,
      mockFilter as never,
      mockReconstructor as never,
      mockImageGenerator as never,
      mockPublisher as never,
    );

    const summary = await orchestrator.run(testConfig, sources);

    expect(summary.testMode).toBe(true);
    expect(summary.counts.published).toBe(1);
    // テストモードでは設定したDB IDが使われていることを確認
    expect(testConfig.notionDatabaseId).toBe('test-db-id');
  });
});
