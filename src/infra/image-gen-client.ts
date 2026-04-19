import { GoogleGenAI, Modality } from '@google/genai';
import { InfraError } from '../domain/errors.js';
import type { GeneratedImage } from '../domain/types.js';

export class ImageGenClient {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateImage(
    model: string,
    prompt: string,
    timeoutMs: number,
  ): Promise<GeneratedImage | null> {
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
          httpOptions: { timeout: timeoutMs },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType ?? 'image/png';
          if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') continue;
          return {
            data: Buffer.from(part.inlineData.data, 'base64'),
            mimeType: mimeType as 'image/png' | 'image/jpeg',
            prompt,
          };
        }
      }
      return null;
    } catch (err) {
      throw new InfraError(`Image generation failed: ${String(err)}`, err);
    }
  }
}
