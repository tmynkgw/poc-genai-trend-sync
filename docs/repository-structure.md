# リポジトリ構造定義書 (Repository Structure Document)

本書は `docs/architecture.md` で定義された4レイヤーアーキテクチャを、具体的なディレクトリ・ファイル配置に落とし込む。

---

## プロジェクト構造

```
poc-genai-trend-sync/
├── .claude/                    # Claude Code 設定（skill / command / agent）
├── .devcontainer/              # Dev Container 設定
├── .github/
│   └── workflows/
│       └── weekly-sync.yml     # 週次実行 + 手動実行ワークフロー
├── config/
│   └── sources.json            # RSSソース定義
├── docs/                       # 永続ドキュメント（6点）
│   ├── ideas/                  # 壁打ち・アイデアメモ
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── development-guidelines.md
│   └── glossary.md
├── src/                        # ソースコード（4レイヤー）
│   ├── cli/                    # エントリーポイント・引数解釈
│   ├── orchestrator/           # フロー制御
│   ├── services/               # ドメインサービス
│   ├── infra/                  # 外部APIクライアント
│   ├── domain/                 # 型・定数（全レイヤーが参照可）
│   ├── config/                 # 環境変数・設定ファイルローダー
│   ├── utils/                  # 汎用ユーティリティ
│   └── index.ts                # パッケージ再エクスポート（必要な場合）
├── tests/
│   ├── unit/                   # ユニットテスト（src と対称）
│   ├── integration/            # 統合テスト
│   └── fixtures/               # 固定データ（RSS XML、LLMレスポンス等）
├── .steering/                  # 作業単位ドキュメント（Git管理外）
├── dist/                       # ビルド成果物（Git管理外）
├── coverage/                   # カバレッジレポート（Git管理外）
├── node_modules/               # 依存パッケージ（Git管理外）
├── .gitignore
├── .prettierignore
├── .prettierrc
├── CLAUDE.md                   # Claude Code 向けプロジェクトメモリ
├── README.md                   # 人間向けセットアップ手順
├── eslint.config.js
├── package.json
├── package-lock.json
├── tsconfig.json
└── vitest.config.ts
```

---

## ディレクトリ詳細

### src/ (ソースコード)

4レイヤーアーキテクチャ（CLI → Orchestrator → Services → Infra）と、全層から参照される `domain` / `config` / `utils` で構成する。

#### src/cli/

**役割**: プロセスのエントリーポイント。引数・環境変数を解釈して `ExecutionConfig` に変換し、Orchestrator を呼び出す

**配置ファイル**:
- `index.ts` — `node dist/cli/index.js` から起動される最上位エントリ
- `args.ts` — commander による引数定義とパース

**命名規則**:
- 関数ファイル = camelCase
- 1ファイル1責務

**依存関係**:
- 依存可能: `orchestrator/`, `config/`, `domain/`, `utils/`
- 依存禁止: `services/`, `infra/`

**例**:
```
src/cli/
├── index.ts
└── args.ts
```

---

#### src/orchestrator/

**役割**: 収集→フィルタ→再構成→画像生成→投稿の一連フローを制御し、`ExecutionSummary` を返す

**配置ファイル**:
- `orchestrator.ts` — `Orchestrator` クラス
- `summary.ts` — `ExecutionSummary` の集計・整形

**命名規則**:
- クラスファイル = PascalCase（例: `Orchestrator`）のエクスポートは camelCase のファイル名で OK（既存プロジェクトのESM規約に揃える）

**依存関係**:
- 依存可能: `services/`, `domain/`, `utils/`, `config/`
- 依存禁止: `cli/`, `infra/`（Service 経由で間接利用）

---

#### src/services/

**役割**: ドメインロジックの実装。各サービスは1つの責務を持つ

**配置ファイル**:
| ファイル | 主要クラス | 責務 |
|---------|----------|------|
| `article-collector.ts` | `ArticleCollector` | RSSから `RawArticle[]` 取得 |
| `article-filter.ts` | `ArticleFilter` | 日付範囲・重複・件数の絞り込み |
| `content-reconstructor.ts` | `ContentReconstructor` | Gemini 2.5 Pro による再構成 |
| `image-generator.ts` | `ImageGenerator` | Gemini 2.5 Flash Image による画像生成 |
| `notion-publisher.ts` | `NotionPublisher` | Notion ページ作成 |

**命名規則**:
- ファイル名 = kebab-case、クラス名 = PascalCase
- 1ファイル1サービス

**依存関係**:
- 依存可能: `infra/`, `domain/`, `utils/`
- 依存禁止: `cli/`, `orchestrator/`, 他の `services/` モジュール（横連携は Orchestrator 経由）

---

#### src/infra/

**役割**: 外部API・外部サービスへのアクセスを隠蔽する薄いクライアントラッパー。タイムアウト・型変換のみを担い、ビジネスロジックは持たない（リトライは Service 層で制御）

**配置ファイル**:
| ファイル | 主要クラス | 対象 |
|---------|----------|------|
| `rss-client.ts` | `RssClient` | rss-parser ラップ |
| `gemini-client.ts` | `GeminiClient` | @google/genai テキスト生成 |
| `image-gen-client.ts` | `ImageGenClient` | @google/genai 画像生成 |
| `notion-client.ts` | `NotionClient` | @notionhq/client ラップ + ブロック組立 |
| `image-host-client.ts` | `ImageHostClient` | @octokit/rest で `generated-images` ブランチに画像を配置 |

**依存関係**:
- 依存可能: 外部SDK、`domain/`（型）、`utils/`
- 依存禁止: `services/`, `orchestrator/`, `cli/`, `config/`

**設計ルール**:
- クライアントは**設定値・APIキーを引数で受け取る**（グローバル状態に依存しない）
- 例外は raw のまま投げず、ドメイン定義のエラー型（`InfraError` 等）でラップする

---

#### src/domain/

**役割**: 全レイヤーから参照されるドメイン型・定数・エラー型を定義する。実装ロジックは置かない

**配置ファイル**:
- `types.ts` — `RawArticle` / `ReconstructedContent` / `GeneratedImage` / `ExecutionConfig` / `ArticleResult` / `ExecutionSummary` / `RssSource` 等の interface
- `errors.ts` — `AppError` / `InfraError` / `ConfigError` 等のカスタムエラー
- `constants.ts` — デフォルト値（`DEFAULT_MAX_ARTICLES`, `DEFAULT_LOOKBACK_DAYS` 等）

**依存関係**:
- 依存可能: なし（純粋な型・定数モジュール）
- 依存禁止: すべての他ディレクトリ（依存先を持たない）

---

#### src/config/

**役割**: 環境変数・CLI引数・`config/sources.json` を読み込み、検証して `ExecutionConfig` および `RssSource[]` を返す

**配置ファイル**:
- `env-schema.ts` — zod による環境変数スキーマ
- `config-loader.ts` — `ConfigLoader` クラス

**依存関係**:
- 依存可能: `domain/`, `utils/`, zod, fs
- 依存禁止: `services/`, `orchestrator/`, `infra/`, `cli/`

---

#### src/utils/

**役割**: 特定ドメインに属さない汎用ユーティリティ

**配置ファイル**:
- `logger.ts` — pino ロガーのファクトリ
- `retry.ts` — 指数バックオフリトライ
- `date.ts` — 日付計算（`lookbackDays` から境界日時を算出）
- `slug.ts` — 記事タイトルや URL から articleId を生成

**依存関係**:
- 依存可能: `domain/`
- 依存禁止: `services/`, `infra/`, `orchestrator/`, `cli/`

---

### tests/

#### tests/unit/

**役割**: 外部API・ファイルI/Oをモックした単体テスト

**構造**: `src/` と対称な階層
```
tests/unit/
├── orchestrator/
│   └── orchestrator.test.ts
├── services/
│   ├── article-filter.test.ts
│   ├── content-reconstructor.test.ts
│   ├── image-generator.test.ts
│   └── notion-publisher.test.ts
├── config/
│   └── config-loader.test.ts
└── utils/
    ├── retry.test.ts
    └── date.test.ts
```

**命名規則**: `[対象ファイル名].test.ts`

---

#### tests/integration/

**役割**: Orchestrator 経由でフロー全体を検証する統合テスト。外部APIはスタブ化

**構造**: シナリオ単位
```
tests/integration/
├── happy-path.test.ts              # 全記事成功
├── partial-failure.test.ts         # LLM失敗の部分成功
├── image-failure.test.ts           # 画像生成失敗でもテキスト投稿継続
├── all-duplicates.test.ts          # 全件重複で投稿0
└── test-mode.test.ts               # --test で テストDBを使用
```

---

#### tests/fixtures/

**役割**: テストで使用する固定データ

**構造**:
```
tests/fixtures/
├── rss/
│   ├── openai.xml
│   ├── anthropic.xml
│   └── google-deepmind.xml
├── gemini/
│   ├── reconstruct-response.json
│   └── image-response.bin
└── notion/
    └── database-query-response.json
```

---

### docs/

永続ドキュメント6点 + `ideas/` の壁打ちメモを格納する。アプリ全体の「何を作るか／どう作るか」の真実源。

```
docs/
├── ideas/
│   └── initial-requirements.md     # 壁打ちメモ（PRD作成の元ネタ）
├── product-requirements.md         # プロダクト要求定義書
├── functional-design.md            # 機能設計書
├── architecture.md                 # アーキテクチャ設計書
├── repository-structure.md         # 本ドキュメント
├── development-guidelines.md       # 開発ガイドライン
└── glossary.md                     # 用語集
```

**配置ルール**:
- 永続ドキュメント6点は必ずこの名前・階層で置く（`/setup-project` コマンドの前提）
- `ideas/` 配下は自由形式（壁打ち・技術調査メモ）
- バージョン管理は Git 履歴で行う（別途 `docs/archive/` 等は作らない）

---

### config/

**役割**: コードに埋め込まず、設定として切り離したい値を JSON で管理する

**配置ファイル**:
- `sources.json` — RSSソース定義（id / name / feedUrl）

**例**:
```json
{
  "sources": [
    { "id": "openai", "name": "OpenAI", "feedUrl": "https://openai.com/blog/rss.xml" },
    { "id": "anthropic", "name": "Anthropic", "feedUrl": "https://www.anthropic.com/news/rss.xml" },
    { "id": "google-deepmind", "name": "Google DeepMind", "feedUrl": "https://deepmind.google/blog/rss.xml" }
  ]
}
```

**スキーマ検証**: `src/config/config-loader.ts` にて zod で検証。読み込み失敗時は起動時に `ConfigError` で exit(1)

**追加時の手順**:
1. `sources.json` に1エントリ追記
2. 必要に応じて `tests/fixtures/rss/` にダミーXMLを追加
3. PR レビュー

---

### .github/workflows/

**役割**: CI / 定期実行ワークフロー

**配置ファイル**:
- `weekly-sync.yml` — 週次スケジュール実行 + `workflow_dispatch` による手動実行

**将来的に追加が想定されるファイル**:
- `ci.yml` — PR 時の lint / typecheck / test
- `cleanup-images.yml` — `generated-images` ブランチの古い画像削除（Post-MVP）

---

### .claude/

**役割**: Claude Code のスキル・コマンド・エージェント定義（既存）

```
.claude/
├── agents/
├── commands/
├── skills/
├── settings.json
└── settings.local.json
```

**変更時の注意**: このディレクトリはテンプレート由来。プロジェクト固有のカスタマイズは `settings.local.json` またはプロジェクト内の skill 追加で対応する。

---

### .steering/

**役割**: 作業単位の要件・設計・タスク管理（一時ドキュメント）

**構造**:
```
.steering/
└── YYYYMMDD-[task-name]/
    ├── requirements.md
    ├── design.md
    └── tasklist.md
```

**Git管理**: `.gitignore` で除外（作業は Claude Code 内のみで参照）

**命名規則**: `20260420-add-slack-notify` のような形式

---

### dist/ / coverage/ / node_modules/

すべて Git 管理外。`.gitignore` で除外済み。

---

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| エントリーポイント | `src/cli/` | camelCase.ts | `index.ts` |
| ドメインサービス | `src/services/` | kebab-case.ts | `article-filter.ts` |
| 外部APIクライアント | `src/infra/` | kebab-case-client.ts | `gemini-client.ts` |
| 型定義 | `src/domain/` | camelCase.ts | `types.ts` |
| ユーティリティ関数 | `src/utils/` | camelCase.ts | `retry.ts` |
| 設定ローダー | `src/config/` | kebab-case.ts | `config-loader.ts` |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニット | `tests/unit/` | `[対象].test.ts` | `article-filter.test.ts` |
| 統合 | `tests/integration/` | `[シナリオ].test.ts` | `partial-failure.test.ts` |
| フィクスチャ | `tests/fixtures/` | 任意 | `openai.xml` |

### 設定ファイル

| ファイル種別 | 配置先 |
|------------|--------|
| ビルド設定 | プロジェクトルート（`tsconfig.json`, `vitest.config.ts` 等） |
| Lint/Format | プロジェクトルート（`eslint.config.js`, `.prettierrc`） |
| ランタイム設定 | `config/`（`sources.json`） |
| CI/CD | `.github/workflows/` |

---

## 命名規則

### ディレクトリ名

- **レイヤー・カテゴリディレクトリ**: 単数形 or 複数形を統一、kebab-case
  - 採用: `services/` `infra/` `cli/` `orchestrator/` `domain/` `config/` `utils/`
  - レイヤーは複数形、ドメイン/設定系は単数形の慣習に従う
- **機能ディレクトリ**（サブディレクトリが必要な規模まで拡大した場合）: kebab-case
  - 例: `services/notion-publisher/` のように責務が分割されたらディレクトリ化

### ファイル名

| 種別 | 規則 | 例 |
|------|------|-----|
| TypeScript ソース | kebab-case.ts or camelCase.ts（内部で統一） | `article-filter.ts` |
| テスト | `[対象].test.ts` | `article-filter.test.ts` |
| 型定義のみ | `types.ts`, `*.d.ts` | `domain/types.ts` |
| エクスポート集約 | `index.ts` | 各ディレクトリ任意 |

**本プロジェクトの採用**: ファイル名は **kebab-case** を基本とする（エクスポートするクラス/関数名は PascalCase / camelCase で区別）。理由: ESM インポートパスの小文字統一により、macOS/Linux での大文字小文字差異トラブルを回避。

### クラス・関数・定数

| 種別 | 規則 | 例 |
|------|------|-----|
| クラス | PascalCase | `ContentReconstructor` |
| 関数 | camelCase | `calculateLookbackDate` |
| 型・インターフェース | PascalCase | `RawArticle` |
| 定数 | UPPER_SNAKE_CASE | `DEFAULT_MAX_ARTICLES` |
| 列挙値 | PascalCase | `ArticleStatus.Published` |

---

## 依存関係のルール

### レイヤー間の依存方向

```
cli  ──→ orchestrator  ──→ services  ──→ infra
 │            │               │             │
 └────────────┴───────────────┼─────────────┴──→ domain / utils
                              │
                              └──→ config
```

**許可されている依存**:
- `cli` → `orchestrator` / `config` / `domain` / `utils`
- `orchestrator` → `services` / `domain` / `utils`
- `services` → `infra` / `domain` / `utils`
- `infra` → `domain` / `utils`（＋外部SDK）
- `config` → `domain` / `utils`
- `domain` → なし（孤立）

**禁止されている依存**:
- `infra` → `services` / `orchestrator` / `cli`（逆流）
- `services` → 他の `services`（横連携は Orchestrator 経由）
- `services` → `orchestrator` / `cli`（逆流）
- `domain` → すべて（型の島として独立）

**強制方法**（段階的に導入）:
- フェーズ1（MVP）: ディレクトリとコードレビューで遵守
- フェーズ2（Post-MVP）: ESLint の `import/no-restricted-paths` で機械的検知

### 循環依存の禁止

- サービス間で相互参照が必要になった場合は、共通ロジックを `utils/` または新しい抽象型を `domain/` に抽出する
- CI（将来導入）で `madge --circular` による検出を行う

---

## スケーリング戦略

### 機能追加時の判断フロー

```
新しい機能は既存サービスの責務か?
├─ Yes → 既存サービスを拡張（`services/content-reconstructor.ts` 等に追記）
└─ No
   ├─ サービスレベルの新責務か?
   │   └─ Yes → `src/services/` に新ファイル追加（例: `slack-notifier.ts`）
   └─ 外部API連携か?
       └─ Yes → `src/infra/` にクライアント追加 + 対応サービスを `src/services/` に新設
```

### ファイルサイズの目安

| サイズ | 方針 |
|--------|------|
| 〜300行 | 問題なし |
| 300〜500行 | リファクタリング検討（責務分割の余地を確認） |
| 500行〜 | 強く分割推奨（サブディレクトリ化も検討） |

**分割例**: `notion-publisher.ts` が肥大化した場合
```
services/
└── notion-publisher/
    ├── index.ts                   # NotionPublisher クラス
    ├── block-builder.ts           # Notion ブロック組み立て専用
    └── dedup-checker.ts           # 重複判定専用
```

### 新規RSSソース追加（最頻出の拡張）

1. `config/sources.json` に1エントリ追加
2. `tests/fixtures/rss/` にサンプルXML追加（テスト用）
3. Notion DB の `Source` プロパティに新しい select オプションを追加
4. PR レビュー → マージ

コード変更不要で追加できることが設計上の狙い。

---

## 除外設定

### .gitignore（主要項目）

```
# 依存 / ビルド成果物
node_modules/
dist/
coverage/

# 環境
.env
.env.local

# 作業用一時ドキュメント
.steering/

# ログ・OSファイル
*.log
.DS_Store
Thumbs.db

# 生成物の一時保存先（Contents API アップロード前の中間ファイル）
tmp/
```

### .prettierignore / ESLint ignores

- `dist/`
- `coverage/`
- `node_modules/`
- `*.lock`

（既存 `.prettierignore` は上記を網羅済み。ESLint は `eslint.config.js` の `ignores` で同等設定）

---

## プロジェクトルートの既存ファイル一覧

| ファイル | 役割 |
|---------|------|
| `package.json` | 依存・スクリプト定義 |
| `package-lock.json` | 依存バージョン固定 |
| `tsconfig.json` | TypeScript 設定 |
| `vitest.config.ts` | Vitest 設定 |
| `eslint.config.js` | ESLint flat config |
| `.prettierrc` / `.prettierignore` | Prettier 設定 |
| `.gitignore` | Git 除外設定 |
| `CLAUDE.md` | Claude Code 向けプロジェクトメモリ |
| `README.md` | 人間向けセットアップ手順 |

これら以外のルート直下ファイルは原則追加しない（増える場合は `config/` や `scripts/` 等のディレクトリに整理する）。
