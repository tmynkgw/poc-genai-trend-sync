# poc-genai-trend-sync

生成AI（GenAI）の最新トレンドを効率的に収集・同期するためのPoCプロジェクトです。

## セットアップ手順

このリポジトリをテンプレートから立ち上げる際、環境構築で時間を無駄にしないための最短手順です。

### 1. テンプレート資産の配置

テンプレートリポジトリ（`claude-code-book-chapter8` 等）から、以下の「AIの頭脳と開発の土台」をプロジェクトルートにコピーしてください。

| 分類 | コピー対象 |
|------|-----------|
| AI設定・スキル | `.claude/` フォルダ、`CLAUDE.md` |
| 開発コンテナ | `.devcontainer/` フォルダ |
| プロジェクト基盤 | `package.json`、`package-lock.json`、`tsconfig.json`、`vitest.config.ts`、`eslint.config.js`、`.prettierrc` |

### 2. プロジェクト名の修正

コピーした `package.json` を開き、名前を修正します。

```json
"name": "genai-trend-sync"
```

### 3. 開発環境の起動

VS Code でプロジェクトを開き、「**Reopen in Container**」を選択して Dev Container を立ち上げます。

Docker コンテナが自動構築され、`npm install` が実行されます。これにより、誰の PC でも、そして AI にとっても、不整合のない「完璧な仕事部屋」が完成します。

### 4. フォルダ構成の初期化

Claude Code を起動し、ターミナルで以下のコマンド（または指示）を実行して、ソースコードとドキュメントの置き場所を作らせます。

```bash
# フォルダがまだない場合、AIに指示
"src フォルダと docs/ideas フォルダを作成して"
```

## 🛠 開発の進め方（スペック駆動開発）

本プロジェクトでは「ノリでコードを書く（Vibe Coding）」を禁止し、以下のステップで進めます。

1. **アイデア出し**: `docs/ideas/initial-requirements.md` にアイデアを書き、Claude Code と壁打ちする。
2. **PRD作成**: `prd-writing` スキルを使い、`docs/prd.md` を作成・合意する。
3. **設計**: `architecture-design` スキル等で設計ドキュメントを `docs/` 配下に整備する。
4. **実装**: `/add-feature` コマンド等を用い、テスト駆動開発（TDD）で実装を進める。
