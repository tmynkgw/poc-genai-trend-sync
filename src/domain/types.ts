export interface RawArticle {
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: Date;
  rawContent: string;
}

export interface ReconstructedContent {
  titleJa: string;
  overview: string;
  technicalImpact: string;
  context: string;
  insights: string;
  imagePrompt: string;
}

export interface GeneratedImage {
  data: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  prompt: string;
}

export interface ExecutionConfig {
  maxArticles: number;
  lookbackDays: number;
  testMode: boolean;
  notionDatabaseId: string;
  notionParentPageId: string;
}

export interface RssSource {
  id: string;
  name: string;
  feedUrl: string;
}

export interface ArticleResult {
  article: RawArticle;
  status: 'published' | 'skipped_duplicate' | 'skipped_error';
  failureStage?: 'reconstruct' | 'image' | 'notion';
  errorMessage?: string;
  notionPageId?: string;
  hasImage: boolean;
}

export interface ExecutionSummary {
  startedAt: Date;
  finishedAt: Date;
  testMode: boolean;
  sources: {
    sourceId: string;
    fetched: number;
    filtered: number;
  }[];
  results: ArticleResult[];
  counts: {
    published: number;
    skippedDuplicate: number;
    skippedError: number;
    withImage: number;
    withoutImage: number;
  };
}
