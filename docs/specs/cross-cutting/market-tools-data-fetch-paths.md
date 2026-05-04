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
| `stock-ranking` | サーバーで `loadRankingManifest()` / `loadRankingDayData()` と共通休場日 loader を呼ぶ | クライアントは `/tools/stock-ranking/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | あり。未設定時 / fetch 失敗時は `app/tools/stock-ranking/data` とローカル休場日 JSON を使う | fallback は開発・緊急退避用。repo 同梱 JSON は履歴保管の主用途にしない |
| `us-stock-ranking` | サーバーで `loadUsRankingManifest()` を読み、`manifest.dates` を最大 5 件試して最初に取得できた日次データを初期表示に使う | クライアントは `/tools/us-stock-ranking/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | なし。未設定時 / fetch 失敗時は「データ取得不可」表示 | API パスは `/us-stock-ranking/*` ではなく `/us-ranking/*` |
| `market-rankings` | サーバーで `loadMarketRankingManifest()` / `loadMarketRankingMonthData()` を呼び、`type` / `month` を正規化して初期表示を決める | クライアント再 fetch は基本なし。`type` / `month` の変更は query string を更新して server を再評価する | `MARKET_INFO_API_BASE_URL` | なし。未設定時は「API 未接続」表示、対象月 fetch 失敗時は error card 表示 | 月次 API 前提。repo 同梱 JSON は持たない |
| `yutai-candidates` | サーバーで `loadMonthlyYutaiPageData()` | クライアント再 fetch は基本なし。月切替は route 遷移でサーバー再評価 | `MARKET_INFO_API_BASE_URL` | あり。manifest / month data はローカル JSON fallback。`nikko/credit` は API 未設定時のみ sample fallback | SBI は `is_short=true` の扱い有無だけを表示し、在庫状態では除外しない |
| `earnings-calendar` | サーバーで `loadEarningsCalendarPageData()` を呼ぶ | クライアント再 fetch なし | `MARKET_INFO_API_BASE_URL` | あり。国内・海外ともに API 失敗時フォールバック（国内のみ同梱 JSON へ）、海外は API 未設定/失敗時は非表示 | 国内・海外ともに `earnings-calendar/{domestic\|overseas}/*` API を優先取得し、国内は API 失敗時のみ repo 同梱 JSON にフォールバック |

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

- `topix33` / `nikkei-contribution` / `stock-ranking` / `us-stock-ranking` の日次 route は `_shared/`（`buildDateDataRoute`）、営業日 helper は `lib/`（`market-trading-dates.ts`）に PR #221 で整理済み
- ただし月次系（`market-rankings`）・ローカル保存系（`yutai-candidates`）は取得パターンが異なり、`_shared/` の恩恵を受けない
- `MARKET_INFO_API_BASE_URL` の upstream 実体は repo 単体では見えないが、mini-tools 側の入口は endpoint 単位で固定される
- fallback ポリシーは「JP market tools は repo 同梱 JSON あり」「`us-stock-ranking` / `market-rankings` は API 専用」と tool ごとの差分が明示的に残っている
- 月次系は query string ベース、日次系は internal route ベースで、操作後の再取得経路が 2 パターンある（設計判断は decision-log 参照）

## 今後そろえたい観点

- 初回表示と画面操作後で、取得経路をどこまで統一するか
- **internal route を置く tool / 置かない tool の基準**（現状: 日次データを client 側で切り替える tool は internal route を持つ。月次系は query string + server 再評価で代替）
- fallback の原則（現状: JP 日次系は同梱 JSON あり、US・月次系は API 専用）
- **cache-control / `revalidate` の原則**（現状: `fetchJson` は 300 秒 revalidate、`buildDateDataRoute` は `Cache-Control: s-maxage=300` を設定済み）
- 「外部 API の JSON をそのまま返す route」と「加工して返す route」の区別

## fallback 方針の補足

- market tools の本番主経路は `MARKET_INFO_API_BASE_URL`
- repo 同梱 JSON fallback は当面残すが、役割は `開発` と `緊急退避`
- 特に `stock-ranking` は、repo 同梱 JSON を履歴アーカイブとして増やし続けない
- `public/data/jpx_listed_companies.json` は現時点では repo 同梱維持でよい

## 関連ファイル

- [app/tools/topix33/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data-loader.ts)
- [app/tools/topix33/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/page.tsx)
- [app/tools/topix33/data/[date]/route.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data/[date]/route.ts)
- [app/tools/topix33/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/ToolClient.tsx)
- [app/tools/nikkei-contribution/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/nikkei-contribution/data-loader.ts)
- [app/tools/stock-ranking/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-ranking/data-loader.ts)
- [app/tools/us-stock-ranking/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/us-stock-ranking/data-loader.ts)
- [app/tools/market-rankings/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/market-rankings/data-loader.ts)
- [app/tools/yutai-candidates/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/data-loader.ts)
- [app/tools/earnings-calendar/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/earnings-calendar/page.tsx)
- [.env.local.example](/c:/Users/yutaz/dev/mini-tools/.env.local.example)
