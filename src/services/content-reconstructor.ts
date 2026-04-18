import { z } from 'zod';
import type { GeminiClient } from '../infra/gemini-client.js';
import type { RawArticle, ReconstructedContent } from '../domain/types.js';
import { ReconstructError } from '../domain/errors.js';
import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { LLM_TIMEOUT_MS, MAX_RETRY_COUNT } from '../domain/constants.js';

const contentSchema = z.object({
  titleJa: z.string().min(1),
  overview: z.string().min(1),
  technicalImpact: z.string().min(1),
  context: z.string().min(1),
  insights: z.string().min(1),
  imagePrompt: z.string().min(10),
});

const SYSTEM_PROMPT = `あなたはAIトレンドを読者に伝えるテックライターです。
以下のルールを守って記事を再構成してください:
- 読み物として自然な日本語の文体で書く（箇条書きの機械的な要約は避ける）
- 技術的インパクトや背景が伝わる読み物にする
- imagePromptは英語で100〜300語程度、記事のコア概念を視覚化するプロンプト
- imagePromptには実在人物の顔を生成するような表現を含めない
- 元記事の著作権を尊重し大量引用はしない`;

export class ContentReconstructor {
  constructor(
    private geminiClient: GeminiClient,
    private model: string,
  ) {}

  async reconstruct(article: RawArticle): Promise<ReconstructedContent> {
    const userPrompt = `以下のAI関連記事を再構成してください。

タイトル: ${article.title}
ソース: ${article.sourceName}
公開日: ${article.publishedAt.toISOString()}
本文:
${article.rawContent}

出力フォーマット（JSON）:
- titleJa: 記事タイトルの日本語訳
- overview: 概要（1〜2文）
- technicalImpact: 技術的インパクト・注目ポイント
- context: 関連する背景・文脈
- insights: 所感・示唆
- imagePrompt: 画像生成用プロンプト（英語、100〜300語）`;

    try {
      const raw = await withRetry(
        () =>
          this.geminiClient.generateStructuredContent(
            this.model,
            SYSTEM_PROMPT,
            userPrompt,
            LLM_TIMEOUT_MS,
          ),
        MAX_RETRY_COUNT,
      );

      const validated = contentSchema.safeParse(raw);
      if (!validated.success) {
        throw new ReconstructError(
          `Invalid LLM response structure: ${validated.error.message}`,
        );
      }

      logger.info(
        { component: 'ContentReconstructor', articleUrl: article.url },
        'reconstruct.success',
      );
      return validated.data;
    } catch (err) {
      if (err instanceof ReconstructError) throw err;
      throw new ReconstructError(`Failed to reconstruct article: ${String(err)}`, err);
    }
  }
}
