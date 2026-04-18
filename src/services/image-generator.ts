import type { ImageGenClient } from '../infra/image-gen-client.js';
import type { GeneratedImage } from '../domain/types.js';
import { logger } from '../utils/logger.js';
import { IMAGE_TIMEOUT_MS } from '../domain/constants.js';

export class ImageGenerator {
  constructor(
    private imageGenClient: ImageGenClient,
    private model: string,
  ) {}

  async generate(prompt: string, articleUrl: string): Promise<GeneratedImage | null> {
    try {
      const image = await this.imageGenClient.generateImage(this.model, prompt, IMAGE_TIMEOUT_MS);
      if (!image) {
        logger.warn(
          { component: 'ImageGenerator', articleUrl },
          'image generation returned no data',
        );
        return null;
      }
      logger.info({ component: 'ImageGenerator', articleUrl }, 'image.generated');
      return image;
    } catch (err) {
      logger.warn(
        { component: 'ImageGenerator', articleUrl, err },
        'image generation failed, continuing without image',
      );
      return null;
    }
  }
}
