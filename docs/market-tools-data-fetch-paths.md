# Market Tools データ取得経路一覧

このメモは、`mini-tools` 内の各 market tool が

- 初回表示でどこからデータを読むか
- 画面操作後にどこからデータを読むか
- どの環境変数を参照するか
- fallback があるか

を一覧で把握するための参照用 spec です。

## 前提

- 「サーバー側」は `mini-tools` の Next.js サーバーを指す
  - ローカル開発では手元の Next.js
  - デプロイ時は Vercel 上の Next.js
- `process.env.*` は `mini-tools` 実行環境の環境変数を見る
- `MARKET_INFO_API_BASE_URL` は market tools の標準 API 入口
  - mini-tools は upstream の内部実装や period 付き filename を意識しない
  - `jpx-closed` も `GET {baseUrl}/market-calendar/jpx-closed` に統一する
- `res.json()` で受けているため、HTTP レスポンス形式は JSON
  - ただし、その JSON が upstream の保存ファイルそのものか、API が加工して返した JSON かは、この repo だけでは分からない

## 一覧

| Tool | 初回表示 | 画面操作後 | 設定 | Fallback | 備考 |
| --- | --- | --- | --- | --- | --- |
| `topix33` | サーバーで `loadTopix33Manifest()` / `loadTopix33DayData()` | クライアントは `/tools/topix33/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | あり。未設定時 / fetch 失敗時は `app/tools/topix33/data` のローカル JSON | 同じデータソースを、SSR と client route の 2 入口で使っている |
| `nikkei-contribution` | サーバーで `loadContributionManifest()` / `loadContributionDayData()` | クライアントは `/tools/nikkei-contribution/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | あり。未設定時 / fetch 失敗時は `app/tools/nikkei-contribution/data` のローカル JSON | `topix33` とほぼ同じ構成 |
| `stock-ranking` | サーバーで `loadRankingManifest()` / `loadRankingDayData()` と共通休場日 loader を呼ぶ | クライアントは `/tools/stock-ranking/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | あり。未設定時 / fetch 失敗時は `app/tools/stock-ranking/data` とローカル休場日 JSON を使う | 休場日 API は `GET /market-calendar/jpx-closed` を使う |
| `yutai-candidates` | サーバーで `loadMonthlyYutaiPageData()` | クライアント再 fetch は基本なし。月切替は route 遷移でサーバー再評価 | `MARKET_INFO_API_BASE_URL` | あり。manifest / month data はローカル JSON fallback。`nikko/credit` は API 未設定時のみ sample fallback | SBI は `is_short=true` の扱い有無だけを表示し、在庫状態では除外しない |
| `earnings-calendar` | サーバーで `app/tools/earnings-calendar/data` のローカル JSON を直接読む | クライアント再 fetch なし | なし | ローカルデータ前提 | 現時点では外部 API を直接読まない |

## `topix33` の具体的な流れ

### 初回表示

1. [page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/page.tsx) がサーバー上で実行される
2. [data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data-loader.ts) の `loadTopix33Manifest()` / `loadTopix33DayData()` を呼ぶ
3. `MARKET_INFO_API_BASE_URL` があれば `GET {baseUrl}/topix33/...`
4. 失敗したら `app/tools/topix33/data/*.json` を読む

### 日付切り替え

1. [ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/ToolClient.tsx) がブラウザから `GET /tools/topix33/data/{date}` を呼ぶ
2. [route.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data/[date]/route.ts) が受ける
3. route 内で `loadTopix33DayData(date)` を呼ぶ
4. その内部では初回表示時と同じく `MARKET_INFO_API_BASE_URL` またはローカル JSON を使う

つまり `topix33` は、

- 初回表示: `mini-tools server -> external API or local JSON`
- 日付切替: `browser -> mini-tools route -> external API or local JSON`

という 2 段構成です。

## なぜ route 経由と server fetch が混在しているか

現在の構成では、SSR の初回表示と、ブラウザ上の操作後レスポンスを両立するために入口が分かれています。

- SSR にしたい初回表示は server component から loader を直接呼ぶ
- ブラウザ操作で差し替えたい日付データは internal route を用意して fetch する

このため、同じデータでも「取り方が違って見える」状態になっています。  
実際には最終的に参照する loader は同一で、入口だけが分かれています。

## 現状の課題

- tool ごとに「server 直読」「internal route 経由」「ローカル固定」が混在していて把握しづらい
- `MARKET_INFO_API_BASE_URL` の upstream 実体は repo 単体では見えないが、mini-tools 側の入口は endpoint 単位で固定される
- fallback ポリシーが tool ごとに少しずつ異なる

## 今後そろえたい観点

- 初回表示と画面操作後で、取得経路をどこまで統一するか
- internal route を置く tool / 置かない tool の基準
- fallback の原則
- cache-control / `revalidate` の原則
- 「外部 API の JSON をそのまま返す route」と「加工して返す route」の区別

## 関連ファイル

- [app/tools/topix33/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data-loader.ts)
- [app/tools/topix33/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/page.tsx)
- [app/tools/topix33/data/[date]/route.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data/[date]/route.ts)
- [app/tools/topix33/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/ToolClient.tsx)
- [app/tools/nikkei-contribution/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/nikkei-contribution/data-loader.ts)
- [app/tools/stock-ranking/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-ranking/data-loader.ts)
- [app/tools/yutai-candidates/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/data-loader.ts)
- [app/tools/earnings-calendar/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/earnings-calendar/page.tsx)
- [.env.local.example](/c:/Users/yutaz/dev/mini-tools/.env.local.example)
