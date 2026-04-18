# 開発ガイドライン (Development Guidelines)

本書は `docs/architecture.md` と `docs/repository-structure.md` に基づき、本プロジェクトで実装・運用する際のコーディング規約・Git運用・テスト指針・レビュー基準を定義する。

---

## 基本原則

1. **型で守る**: TypeScript strict モードを有効にし、`any` は原則禁止。外部境界（環境変数・APIレスポンス）は zod で検証してから内部型に流す
2. **層を守る**: `docs/repository-structure.md` の依存方向に違反しない。横連携・逆流は必ず Orchestrator 経由
3. **失敗は記事単位で閉じ込める**: 1記事の失敗が全体を止めないように、try/catch は記事ループの内側で確実に
4. **機密情報はSecrets/環境変数のみ**: `.env` / Secrets 以外の場所に書かない、ログに出さない

---

## コーディング規約

### TypeScript 設定

`tsconfig.json` で以下を必須とする（既に設定済み）:
- `"strict": true`
- `"module": "NodeNext"` / `"moduleResolution": "NodeNext"`
- `"target": "ES2022"`

**禁止事項**:
- `any` 型の使用（やむを得ない場合は `unknown` → 型ガードで絞り込み）
- `@ts-ignore` / `@ts-expect-error`（脱出口として使う場合はコメントで理由必須）
- `console.log` の本番コードへの残置（必ず pino 経由）

### 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| ファイル | kebab-case.ts | `article-filter.ts` |
| クラス / 型 / interface | PascalCase | `ArticleFilter`, `RawArticle` |
| 関数 / メソッド / 変数 | camelCase | `calculateLookbackDate`, `maxArticles` |
| 定数 | UPPER_SNAKE_CASE | `DEFAULT_MAX_ARTICLES` |
| Boolean変数 | `is` / `has` / `should` 接頭辞 | `isTestMode`, `hasImage` |
| 列挙値（文字列リテラル union） | snake_case または camelCase（統一） | `'skipped_duplicate'` |

**動詞の使い分け**:
- `fetch*` = ネットワーク越しの取得
- `load*` = ファイル・設定の読み込み
- `build*` = 構造体の組み立て
- `publish*` = 外部への書き出し
- `compute*` / `calculate*` = 純粋計算

### インポート順序

```typescript
// 1. Node.js 組み込み
import { readFile } from 'node:fs/promises';

// 2. 外部パッケージ
import { Client as NotionClient } from '@notionhq/client';
import { z } from 'zod';

// 3. 内部モジュール（相対パス）
import type { RawArticle } from '../domain/types.js';
import { logger } from '../utils/logger.js';
```

**ESM 末尾規則**: 相対インポートは必ず `.js` 拡張子付き（`NodeNext` 仕様）。

### 非同期処理

- **Promise チェーンより async/await** を優先
- **並列処理は `Promise.all`** を使い、`for ... of` で順次 `await` しない（並列化できる場面では）
- **タイムアウトは `AbortSignal.timeout()`** を使う（Node 18+標準）

```typescript
// ✅ 良い例
const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });

// ❌ 悪い例: setTimeout での手動実装
```

### エラーハンドリング

**ドメインエラーを定義する** (`src/domain/errors.ts`):

```typescript
export class AppError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigError extends AppError {}         // 起動時の設定不備
export class InfraError extends AppError {}          // 外部API由来のエラー
export class ReconstructError extends AppError {}    // LLM再構成の失敗
export class ImageGenError extends AppError {}       // 画像生成の失敗
export class NotionPublishError extends AppError {}  // Notion投稿の失敗
```

**ルール**:
- サービス層・インフラ層で発生する例外は**必ずドメインエラーでラップ**し、`cause` に元の例外を保持する
- Orchestrator は try/catch で **記事単位** にエラーを捕捉し、`ArticleResult.status = 'skipped_error'` を記録する
- `ConfigError` のみ全体を止める（`process.exit(1)`）
- エラーは握りつぶさない。ログに出せない / 無視したい場合は理由をコメントで必須

```typescript
// ✅ 良い例
try {
  await reconstructor.reconstruct(article);
} catch (err) {
  logger.error({ articleUrl: article.url, err }, 'reconstruct failed');
  results.push({ article, status: 'skipped_error', failureStage: 'reconstruct', errorMessage: String(err) });
  continue; // 次の記事へ
}

// ❌ 悪い例
try { /* ... */ } catch { /* 握りつぶし */ }
```

### ロギング

**pino を唯一のロガーとする**。`console.log` / `console.error` は使わない。

```typescript
logger.info({ component: 'ArticleCollector', sourceId, count }, 'collected');
logger.warn({ component: 'ImageGenerator', articleUrl }, 'image generation failed');
logger.error({ component: 'NotionPublisher', articleUrl, err }, 'publish failed');
```

**ルール**:
- 第1引数 = 構造化データ（フィールド名は camelCase）
- 第2引数 = 人間可読メッセージ（短文）
- 必須フィールド: `component`（モジュール名）、イベント性の操作では `event` も付ける
- APIキー・トークンは**絶対にログに出さない**（pino の `redact` で多層防御）
- エラーオブジェクトは `err` フィールドにそのまま渡す（pino が自動整形）

### コメント

**WHY を書く。WHAT はコードで表現する。**

```typescript
// ✅ 良い例: 制約・判断理由を説明
// Notion API は同一DB への書き込みに同時実行制限があるため、記事投稿は直列化する
for (const article of articles) { /* ... */ }

// ❌ 悪い例: コードを日本語に翻訳
// 記事配列をループする
for (const article of articles) { /* ... */ }
```

**JSDoc は公開API（クラスのpublicメソッド）に対してのみ記述**。内部関数は型と名前で十分。

### zod によるスキーマ検証

境界層（環境変数・設定ファイル・LLMレスポンス）では必ず zod で検証する:

```typescript
// 環境変数
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  MAX_ARTICLES: z.coerce.number().int().positive().default(5),
});
const env = envSchema.parse(process.env); // 失敗時は ConfigError でラップ

// LLM レスポンス
const contentSchema = z.object({
  overview: z.string().min(1),
  technicalImpact: z.string().min(1),
  context: z.string(),
  insights: z.string(),
  imagePrompt: z.string().min(10),
});
```

---

## Git 運用

本プロジェクトは**個人 / 小チーム運用**のため、Git Flow ではなく **GitHub Flow を簡略化した以下の方針**を採用する。

### ブランチ戦略

| ブランチ | 用途 | マージ先 |
|---------|------|---------|
| `main` | 常にデプロイ可能な状態（週次ワークフローはここから実行） | — |
| `feature/*` | 新機能 | `main`（PR経由） |
| `fix/*` | バグ修正 | `main`（PR経由） |
| `docs/*` | ドキュメント更新のみ | `main`（PR経由） |
| `generated-images` | **生成画像のホスト専用**（孤立ブランチ） | マージしない |

**ブランチ名の例**:
- `feature/add-slack-notifier`
- `fix/rss-parser-timeout`
- `docs/update-glossary`

**ルール**:
- `main` に直接 push しない（設定レベルで禁止を推奨）
- `generated-images` ブランチは `@octokit/rest` が自動操作するため、**人間は触らない**
- 作業ブランチは PR マージ後に削除

### コミットメッセージ

**Conventional Commits** に準拠:

```
<type>(<scope>): <subject>

<body>
```

**type 一覧**:
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: 振る舞いを変えないリファクタリング
- `docs`: ドキュメント
- `test`: テスト追加・修正
- `chore`: ビルド・依存関係・CI
- `perf`: パフォーマンス改善

**scope の例**:
- `collector` / `reconstructor` / `image-gen` / `publisher` / `orchestrator` / `cli` / `config` / `ci`

**例**:
```
feat(image-gen): Nano Banana クライアントを追加

Gemini 2.5 Flash Image API を呼び出す ImageGenClient を実装。
- 60秒タイムアウト
- セーフティブロック時は null を返す
- 再試行なし（ImageGenerator 層で制御）
```

**NG例**:
- `update`（何を？）
- `WIP`（マージする前に rebase で整理）
- `fix bug`（どこの何を？）

### プルリクエスト

PR 作成前のセルフチェック:

- [ ] `npm run typecheck` が通る
- [ ] `npm run lint` が通る
- [ ] `npm test` が通る
- [ ] 新規・変更コードにテストがある（設定変更のみ等は除外）
- [ ] 機密情報がコミットに含まれていない

**PRテンプレート**:
```markdown
## 概要
[変更内容を1〜3行]

## 変更理由 / 背景
[なぜ必要か、関連するPRDやIssue]

## 主な変更点
- [変更1]
- [変更2]

## 動作確認
- [ ] ユニットテスト追加
- [ ] 統合テストで正常系を確認
- [ ] `workflow_dispatch` で `--test` 実行（必要な場合）

## チェック
- [ ] ドキュメント更新不要 or 更新済み
- [ ] 破壊的変更なし（ある場合は移行手順を記載）
```

### マージ方針

- **Squash merge を基本**: 作業中の細かいコミットを1つにまとめる
- マージコミットメッセージは Conventional Commits に揃える
- `generated-images` ブランチは `main` にマージしない（孤立ブランチとして維持）

---

## テスト戦略

### テストピラミッド

```
         E2E (手動・限定)
            ▲
      統合テスト（数件）
            ▲
      ユニットテスト（多数）
```

### カバレッジ目標

| 指標 | 目標 | 測定 |
|------|-----|------|
| 行カバレッジ | 80% 以上 | `npm run test:coverage` |
| 対象 | `src/services/` / `src/orchestrator/` / `src/config/` / `src/utils/` | Infra層は統合テスト側で担保 |

### ユニットテスト

**方針**:
- 外部API呼び出し（Infra層）は **必ずモック**
- ビジネスロジック（Service層）は **実装を使ってテスト**
- 1テスト = 1 assertion 原則（関連する assertion はまとめて良い）

**命名規則**: テスト名は日本語で「何をテストするか」を明確に

```typescript
describe('ArticleFilter', () => {
  it('lookbackDays より古い記事は除外される', () => { /* ... */ });
  it('Notion に既存のURLと一致する記事は重複として除外される', () => { /* ... */ });
  it('maxArticles を超える記事はソースごとに切り詰められる', () => { /* ... */ });
});
```

**モックの使い方**:
```typescript
import { vi } from 'vitest';
import { ArticleFilter } from '../../src/services/article-filter.js';

const mockNotion = {
  fetchExistingUrls: vi.fn().mockResolvedValue(new Set(['https://openai.com/blog/gpt-5'])),
};

const filter = new ArticleFilter(mockNotion as any, config);
```

### 統合テスト

**対象**: Orchestrator を通じた一連のフロー

**方針**:
- RSS は `tests/fixtures/rss/` の固定XMLを使用
- Gemini / Notion / GitHub はインメモリスタブで再現
- ネットワークアクセスは**一切しない**

**必須シナリオ**:
1. 全記事成功 (`happy-path.test.ts`)
2. 一部記事で LLM 失敗 (`partial-failure.test.ts`)
3. 画像生成失敗でもテキストは投稿される (`image-failure.test.ts`)
4. 全記事重複で投稿0件 (`all-duplicates.test.ts`)
5. テストモードでテストDB使用 (`test-mode.test.ts`)

### E2E テスト

**頻度**: リリース前 / 外部API の破壊的変更が疑われたとき

**手順**:
1. GitHub Actions で `workflow_dispatch` を実行
2. 入力: `max_articles=1`, `lookback_days=2`, `test_mode=true`
3. 検証: テスト用 Notion DB に1件以上のページが作成される

### テスト設計のアンチパターン

| ❌ 悪い例 | ✅ 良い例 |
|---------|---------|
| 実ネットワーク呼び出し（Gemini実行） | `GeminiClient` モック |
| `setTimeout(3000)` で状態待機 | `await` で明示的に完了を待つ |
| テスト同士が順序に依存 | 各テスト独立で実行可能 |
| ロジックをテスト内でも書き直す | 期待値をハードコード |

---

## レビュー基準

### 必ず確認する観点

**機能性**:
- [ ] PRD の受け入れ条件を満たしているか
- [ ] 記事単位の失敗が全体を止めないか（部分失敗耐性）
- [ ] 冪等性が維持されているか（同一URL重複投稿なし）

**可読性**:
- [ ] 名前から責務が読み取れるか
- [ ] 関数が300行を超えていないか
- [ ] WHY コメントが必要な箇所に書かれているか

**安全性**:
- [ ] APIキーが環境変数以外に書かれていないか
- [ ] ユーザー入力・外部レスポンスが zod で検証されているか
- [ ] エラーが握りつぶされていないか

**アーキテクチャ整合性**:
- [ ] `docs/repository-structure.md` の依存方向に違反していないか
- [ ] Service 間の横連携になっていないか
- [ ] Infra 層にビジネスロジックが漏れていないか

### レビューコメントの優先度ラベル

- **[MUST]**: マージ前に対応必須
- **[SHOULD]**: マージ前に対応推奨、理由があれば別PRで可
- **[NITS]**: 個人的好み・軽微な指摘
- **[Q]**: 質問・理解のため

---

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | 24.x | devcontainer で自動セットアップ |
| npm | 11.x | Node.js 24 に同梱 |
| Git | 2.40+ | — |
| VS Code | 最新 | devcontainer 利用を推奨 |
| gh (GitHub CLI) | 最新（任意） | PR 作成補助 |

### セットアップ手順

```bash
# 1. リポジトリクローン
git clone git@github.com:tmynkgw/poc-genai-trend-sync.git
cd poc-genai-trend-sync

# 2. VS Code で開いて Dev Container を起動（推奨）
code .
# → "Reopen in Container" を選択

# 3. 依存関係インストール（devcontainer 起動時に自動実行される）
npm install

# 4. 環境変数設定（ローカル実行時のみ）
cp .env.example .env  # ※ .env.example は別途用意する想定
# .env を編集してAPIキー等を設定

# 5. 型チェック・Lint・テスト
npm run typecheck
npm run lint
npm test

# 6. ビルド & 実行
npm run build
node dist/cli/index.js --test --max-articles 1 --lookback-days 2
```

### 推奨 VS Code 拡張

| 拡張 | 用途 |
|------|------|
| ESLint | Lint リアルタイム表示 |
| Prettier | 保存時自動フォーマット |
| GitLens | 履歴・Blame表示 |
| Mermaid Preview | 設計書のMermaid図確認 |

### 品質自動化（pre-commit / CI）

**pre-commit（husky + lint-staged、既設定）**:
- `*.{ts,tsx}` に対して `eslint --fix` と `prettier --write` を実行
- 既定で変更ファイルのみが対象（高速）

**CI（将来追加）** — `.github/workflows/ci.yml`:
1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test:coverage`
5. `npm audit --audit-level=high`

main への PR 時に全チェックをブロッキング条件とする。

---

## プロジェクト固有の注意点

### 機密情報の扱い

- **必ず**: GitHub Secrets / ローカルの `.env`（Git管理外）
- **絶対に禁止**: ソースコード・設定ファイル・コミットメッセージ・ログ・PR本文への貼付
- `.env` の扱い:
  - `.gitignore` に登録済み
  - `.env.example` を用意し、必要な変数名だけ明示（値は空欄）

### 外部API呼び出しのルール

1. **必ずタイムアウトを設定**: `AbortSignal.timeout()` または SDK のタイムアウトオプション
2. **リトライは Infra 層ではなく Service 層で制御**: Infra は単発呼び出しに徹する
3. **レート制限を考慮した直列化**: 記事単位の処理は Orchestrator で順次 `await`

### 生成物の品質ガード

- **記事の再構成テキスト**: プロンプトに「実在人物の名誉毀損を避ける」「元記事の著作権を尊重し大量引用しない」旨を明示
- **画像生成プロンプト**: LLM側で「実在人物の顔の生成を要求しない」ルールを組み込む
- 生成画像が不適切だった場合の手動削除手順を README に追記（Post-MVP）

### Post-MVP で追加予定の品質施策

| 施策 | 優先度 |
|------|-------|
| CI ワークフロー (`ci.yml`) 追加 | 高 |
| `gitleaks` による secrets スキャン | 高 |
| `madge --circular` による循環依存検出 | 中 |
| ESLint `import/no-restricted-paths` でレイヤー依存を機械検査 | 中 |
| Dependabot による依存更新自動PR | 中 |
| `generated-images` ブランチの古い画像自動削除ワークフロー | 低 |
