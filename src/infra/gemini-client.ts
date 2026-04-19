import { GoogleGenAI, Type } from '@google/genai';
import { InfraError } from '../domain/errors.js';
import type { ReconstructedContent } from '../domain/types.js';

const reconstructedContentSchema = {
  type: Type.OBJECT,
  properties: {
    titleJa: { type: Type.STRING },
    overview: { type: Type.STRING },
    technicalImpact: { type: Type.STRING },
    context: { type: Type.STRING },
    insights: { type: Type.STRING },
    imagePrompt: { type: Type.STRING },
  },
  required: ['titleJa', 'overview', 'technicalImpact', 'context', 'insights', 'imagePrompt'],
};

export class GeminiClient {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateStructuredContent(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    timeoutMs: number,
  ): Promise<ReconstructedContent> {
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: reconstructedContentSchema,
          httpOptions: { timeout: timeoutMs },
        },
      });

      const text = response.text;
      if (!text) {
        throw new InfraError('Empty response from Gemini text API');
      }
      return JSON.parse(text) as ReconstructedContent;
    } catch (err) {
      if (err instanceof InfraError) throw err;
      throw new InfraError(`Gemini text generation failed: ${String(err)}`, err);
    }
  }
}
