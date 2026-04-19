import { describe, it, expect, vi, afterEach } from 'vitest';
import { ImageGenerator } from '../../../src/services/image-generator.js';
import { InfraError } from '../../../src/domain/errors.js';
import type { GeneratedImage } from '../../../src/domain/types.js';

const mockImageGenClient = {
  generateImage: vi.fn(),
};

const fakeImage: GeneratedImage = {
  data: Buffer.from('fake-image-data'),
  mimeType: 'image/png',
  prompt: 'test prompt',
};

describe('ImageGenerator', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('画像生成に成功した場合は GeneratedImage を返す', async () => {
    mockImageGenClient.generateImage.mockResolvedValue(fakeImage);
    const generator = new ImageGenerator(mockImageGenClient as never, 'model');
    const result = await generator.generate('test prompt', 'https://example.com');
    expect(result).toEqual(fakeImage);
  });

  it('API がエラーを返した場合は null を返す（処理継続）', async () => {
    mockImageGenClient.generateImage.mockRejectedValue(new InfraError('API error'));
    const generator = new ImageGenerator(mockImageGenClient as never, 'model');
    const result = await generator.generate('test prompt', 'https://example.com');
    expect(result).toBeNull();
  });

  it('API が null を返した場合は null を返す', async () => {
    mockImageGenClient.generateImage.mockResolvedValue(null);
    const generator = new ImageGenerator(mockImageGenClient as never, 'model');
    const result = await generator.generate('test prompt', 'https://example.com');
    expect(result).toBeNull();
  });
});
