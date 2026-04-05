# mini-tools システム構成概要

このメモは、`mini-tools` 全体を俯瞰するときの入口です。  
画面、認証、データ取得、外部依存、ローカル保存の役割分担を大づかみに整理します。

## 全体像

`mini-tools` は、Next.js App Router を使った単一アプリです。  
大きく分けると、次の 5 層で構成されています。

1. UI 層
2. アプリケーション層
3. データ取得層
4. 永続化 / 保存層
5. 外部依存層

## 構成イメージ

```text
Browser
  ├─ React Client Components
  ├─ localStorage を使うローカル保存系 tool
  └─ 一部ツールは internal route を fetch

mini-tools (Next.js App Router)
  ├─ app/* page.tsx
  │   ├─ server component で初回表示を組み立てる
  │   └─ client component に初期データを渡す
  ├─ app/**/route.ts
  │   ├─ premium login/logout API
  │   └─ 日付別 JSON を返す internal data route
  ├─ components/*
  │   ├─ Header
  │   ├─ ShareButtons
  │   └─ 各種 UI 部品
  ├─ lib/*
  │   └─ premium 認証などの共通ロジック
  └─ app/tools/**/data-loader.ts
      ├─ 外部 API / ローカル JSON fallback を切り替える
      └─ page / route から共有利用される

External / Storage
  ├─ market-info API
  ├─ repo 同梱 JSON
  └─ Browser localStorage
```

## 1. UI 層

UI は主に `app/` と `components/` にあります。

- `app/layout.tsx`
  - 全ページ共通レイアウト
  - Header 読み込み
  - GA Script 読み込み
  - PWA manifest 指定
- `components/Header.tsx`
  - 全体ヘッダー
  - premium 導線の入口
- `components/ShareButtons.tsx`
  - 各 tool の共有導線

各 tool は `app/tools/<tool>/page.tsx` を起点に持ち、必要に応じて `ToolClient.tsx` に client-side UI を分けています。

## 2. アプリケーション層

アプリケーション層は、ページごとの組み立てと画面遷移制御を担当します。

### server component の役割

- 初回表示に必要なデータをロードする
- クライアントに初期データを渡す
- premium などのアクセス制御を行う

例:

- [app/tools/topix33/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/page.tsx)
- [app/tools/stock-ranking/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-ranking/page.tsx)
- [app/premium/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/premium/page.tsx)

### client component の役割

- 日付切替
- 月切替
- hover / tooltip
- local state 管理
- localStorage を使う入力系 tool の操作

## 3. データ取得層

データ取得の中心は各 tool の `data-loader.ts` です。

例:

- [app/tools/topix33/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data-loader.ts)
- [app/tools/nikkei-contribution/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/nikkei-contribution/data-loader.ts)
- [app/tools/stock-ranking/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-ranking/data-loader.ts)
- [app/tools/yutai-candidates/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/data-loader.ts)

責務は次の通りです。

- 環境変数を読んで取得先を決める
- 外部 API / ローカル JSON fallback の切替を行う
- fetch 失敗時の fallback を吸収する
- `page.tsx` と `route.ts` で同じ取得ロジックを共有する

詳細は [Market Tools データ取得経路一覧](./market-tools-data-fetch-paths.md) を参照します。

## 4. 永続化 / 保存層

この repo には、保存方法が大きく 3 種類あります。

### 1. repo 同梱 JSON

`app/tools/**/data/*.json` に配置される静的データです。

用途:

- fallback
- 開発時のローカル確認
- 外部 API がなくても最低限動かすための同梱データ

### 2. Browser localStorage

入力系・個人用管理系 tool はブラウザ内保存を使います。

例:

- yutai-memo
- yutai-expiry
- total
- charcount

これらはサーバー側 DB を持たず、端末ローカル保存が前提です。

### 3. Cookie

premium 仮ログインは Cookie ベースです。

- Cookie 名: `mini_tools_premium`
- 署名 / 検証ロジック: [lib/premium-auth.ts](/c:/Users/yutaz/dev/mini-tools/lib/premium-auth.ts)
- login route: [app/api/premium/login/route.ts](/c:/Users/yutaz/dev/mini-tools/app/api/premium/login/route.ts)
- logout route: [app/api/premium/logout/route.ts](/c:/Users/yutaz/dev/mini-tools/app/api/premium/logout/route.ts)

## 5. 外部依存層

主な外部依存は次の通りです。

### Next.js / React

- App Router ベース
- server component と client component を併用

### Google Analytics

- `NEXT_PUBLIC_GA_ID` を [app/layout.tsx](/c:/Users/yutaz/dev/mini-tools/app/layout.tsx) で読む
- 設定があるときだけ Script を埋め込む

### market-info API

- `MARKET_INFO_API_BASE_URL` を使う tool が参照
- 主に market tools の日次データ取得に使う
- 実体がどのインフラかは、この repo 単体では断定しない

### PWA / Service Worker

- `next-pwa` を利用
- `manifest.webmanifest` を公開
- build 時に `public/sw.js` が生成される

## premium 機能の位置づけ

premium は現時点では「仮ログイン + preview 画面」です。

- 認証は簡易 Cookie セッション
- ユーザー管理 DB は未導入
- 課金 / 会員管理 / 権限テーブルは未実装

そのため、現状の premium は「保護された preview 導線」であり、本格的な会員システムではありません。

## このシステムで今わかること / わからないこと

### わかること

- `mini-tools` は Next.js 単一アプリで動いている
- tool ごとに server component と client component を使い分けている
- market tools は外部 API またはローカル JSON fallback を使う
- premium は Cookie ベースの簡易認証

### この repo だけでは断定できないこと

- `MARKET_INFO_API_BASE_URL` の upstream 実体
- 外部 API が upstream の JSON をそのまま返しているか
- 外部 API の裏で Cloud Run / R2 / DB / Worker のどれを使っているか

## 現状の整理ポイント

- market tools のデータ取得経路が少しずつ異なる
- `MARKET_INFO_API_BASE_URL` に寄せつつ、fallback との役割分担を引き続き明確化したい
- premium は preview 段階で、会員システムとしては未完成
- docs を入口別に見ないと全体像が掴みにくい

## 関連 docs

- [Market Tools データ取得経路一覧](./market-tools-data-fetch-paths.md)
- [2026-04-04 premium ログイン導線の暫定実装方針](./decision-log/2026-04-04-premium-login-placeholder-flow.md)
- [2026-04-04 TOPIX33 premium 可視化の見せ方方針](./decision-log/2026-04-04-topix33-premium-visualization-plan.md)
- [2026-03-12 SSR / Hydration / localStorage 運用ガイド](./decision-log/2026-03-12-ssr-localstorage-hydration-guidelines.md)
