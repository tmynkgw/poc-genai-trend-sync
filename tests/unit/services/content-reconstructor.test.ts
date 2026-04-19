import { describe, it, expect, vi, afterEach } from 'vitest';
import { ContentReconstructor } from '../../../src/services/content-reconstructor.js';
import { InfraError, ReconstructError } from '../../../src/domain/errors.js';
import type { RawArticle } from '../../../src/domain/types.js';
import fixtureResponse from '../../fixtures/gemini/reconstruct-response.json' assert { type: 'json' };

const mockGeminiClient = {
  generateStructuredContent: vi.fn(),
};

const article: RawArticle = {
  sourceId: 'openai',
  sourceName: 'OpenAI',
  title: 'GPT-5 Released',
  url: 'https://openai.com/blog/gpt-5',
  publishedAt: new Date('2026-04-14'),
  rawContent: 'GPT-5 is our most capable model.',
};

describe('ContentReconstructor', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Gemini の正常レスポンスを ReconstructedContent として返す', async () => {
    mockGeminiClient.generateStructuredContent.mockResolvedValue(fixtureResponse);
    const reconstructor = new ContentReconstructor(mockGeminiClient as never, 'gemini-2.5-pro');
    const result = await reconstructor.reconstruct(article);
    expect(result.titleJa).toBe(fixtureResponse.titleJa);
    expect(result.overview).toBe(fixtureResponse.overview);
    expect(result.imagePrompt).toBe(fixtureResponse.imagePrompt);
  });

  it('Gemini API エラー時は ReconstructError を投げる', async () => {
    mockGeminiClient.generateStructuredContent.mockRejectedValue(
      new InfraError('API error'),
    );
    const reconstructor = new ContentReconstructor(mockGeminiClient as never, 'gemini-2.5-pro');
    await expect(reconstructor.reconstruct(article)).rejects.toThrow(ReconstructError);
  }, 10_000);

  it('不正なレスポンス形式の場合は ReconstructError を投げる', async () => {
    mockGeminiClient.generateStructuredContent.mockResolvedValue({ invalid: 'response' });
    const reconstructor = new ContentReconstructor(mockGeminiClient as never, 'gemini-2.5-pro');
    await expect(reconstructor.reconstruct(article)).rejects.toThrow(ReconstructError);
  });
});
