# mini-tools

サクッと使えるミニツール集です。`Next.js (App Router)` で実装されています。

## 現在のツール

- 合計計算: `/tools/total`
  - 1行ごとの数字入力から合計を計算
- 文字数カウント: `/tools/charcount`
  - 文字数、スペース/改行除外文字数、X 140/280 残りを表示
- 株主優待期限帳: `/tools/yutai-expiry`
  - 優待期限・使用済み状態・検索・並び替え・JSON入出力
- 優待銘柄メモ帳: `/tools/yutai-memo`
  - 権利月、タグ、任期条件、優先度、メモ管理

実装参照:

- `app/page.tsx`
- `app/tools/total/page.tsx`
- `app/tools/charcount/page.tsx`
- `app/tools/yutai-expiry/ToolClient.tsx`
- `app/tools/yutai-memo/ToolClient.tsx`

## 技術スタック

- Next.js
- React
- TypeScript
- next-pwa
- qrcode.react

参照: `package.json`, `next.config.js`, `public/manifest.webmanifest`

## セットアップ

```bash
npm install
npm run dev
```

開発サーバー起動後、`http://localhost:3000` を開いて確認します。

## npm scripts

- `npm run dev`: 開発サーバー起動（webpack）
- `npm run build`: 本番ビルド
- `npm run start`: 本番モード起動
- `npm run lint`: ESLint 実行

参照: `package.json`

## 実行環境の基準（確認済み）

- CI（GitHub Actions）は `Node.js 20` を使用
- 参照: `.github/workflows/ci.yml`

## 環境変数

コード上で参照している公開環境変数:

- `NEXT_PUBLIC_GA_ID`
  - GA 設定に使用
  - 参照: `app/layout.tsx`
- `NEXT_PUBLIC_SITE_URL`
  - 共有URL（QR/コピー/SNS）の基準URLに使用
  - 参照: `components/ShareButtons.tsx`
- `STOCK_RANKING_DATA_BASE_URL`
  - `stock-ranking` が外部配信の `manifest.json` / 日次JSON を読むときの基準URL
  - 通常は `https://<public-base-url>` のように prefix なしで指定する
  - loader 側で `/stock-ranking` を補うため、`.../stock-ranking` を入れても二重にはならない
  - 未設定時は repo 内の `app/tools/stock-ranking/data/` を読む
  - 参照: `app/tools/stock-ranking/data-loader.ts`

`.env.local.example` に値なしの雛形キーを置いています。必要に応じて `.env.local` を作成して値を設定してください。

## データ保存（ローカル）

このプロジェクトの主要データはブラウザ `localStorage` に保存されます。

- 合計計算: `mini_tools_total_lines_v1`
- 文字数カウント: `mini_tools_charcount_text_v1`
- 株主優待期限帳: `mini-tools:benefits:v2`
  - 旧キー互換あり: `benefits-tracker-items-v1`, `benefits-tracker-items`, `mini-tools:benefits`
- 優待銘柄メモ帳:
  - `yutai_memo_items_v1`
  - `yutai_memo_tags_v1`
  - `yutai_memo_migrated_tags_v1`

参照:

- `app/tools/total/page.tsx`
- `app/tools/charcount/page.tsx`
- `app/tools/yutai-expiry/benefits/store.ts`
- `app/tools/yutai-memo/storage.ts`

## 共有と計測

- 共有ボタン（X / Facebook / Email / Copy / QR）
- `NEXT_PUBLIC_GA_ID` が設定されている場合に Google Analytics を有効化

参照:

- `components/ShareButtons.tsx`
- `lib/analytics.ts`
- `app/layout.tsx`

## docs

- docs 全体案内: `docs/index.md`
- QR共有URL仕様: `docs/share-url-spec.md`
- 意思決定ログ: `docs/decision-log/`
- 作業ログ: `docs/devlog/`

## To verify

### Entry points / CLI behavior

- ホスティング環境での実運用コマンド（`npm run start` を使うか、プラットフォーム既定か）
  - 確認先: デプロイ設定（ホスティング側設定）
