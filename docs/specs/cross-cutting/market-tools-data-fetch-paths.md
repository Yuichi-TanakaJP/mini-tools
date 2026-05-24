# Market Tools データ取得経路一覧

このメモは、`mini-tools` 内の各 market tool が

- 初回表示でどこからデータを読むか
- 画面操作後にどこからデータを読むか
- どの環境変数を参照するか
- fallback があるか

を一覧で把握するための参照用 spec です。

## 横断参照入口

market tools の API 取得経路や fallback を変更する前に、次の docs を確認する。

| 参照先 | 確認すること |
|---|---|
| [`market_info/docs/architecture.md`](https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/architecture.md) | 3 repo 全体のデータフローと関連 docs |
| [`market_info/docs/reference/policy_decision_rules.md`](https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/reference/policy_decision_rules.md) | API / publish / UI の責務分担ルール |
| [`market_info/docs/reference/publish_contract_inventory.md`](https://github.com/Yuichi-TanakaJP/market_info/blob/main/docs/reference/publish_contract_inventory.md) | R2 published family、object path、schema source、compact artifact 候補 |
| [`market-info-api/docs/api-contract.md`](https://github.com/Yuichi-TanakaJP/market-info-api/blob/main/docs/api-contract.md) | API endpoint、TTL、range/search cache contract、fallback/error contract |
| [`market-info-api/docs/resource-usage.md`](https://github.com/Yuichi-TanakaJP/market-info-api/blob/main/docs/resource-usage.md) | Cloud Run / R2 の無料枠、現行データサイズ、cache / compact publish 判断材料 |

`mini-tools` は UI state、入力、表示整形、API query construction を担当する。R2 object path や publish timing を UI に直接持ち込まず、`MARKET_INFO_API_BASE_URL` と API contract を入口にする。

## 前提

- 「サーバー側」は `mini-tools` の Next.js サーバーを指す
  - ローカル開発では手元の Next.js
  - デプロイ時は Vercel 上の Next.js
- `process.env.*` は `mini-tools` 実行環境の環境変数を見る
- `MARKET_INFO_API_BASE_URL` は market tools の標準 API 入口
  - mini-tools は upstream の内部実装や period 付き filename を意識しない
  - `jpx-closed` も `GET {baseUrl}/market-calendar/jpx-closed` に統一する
- production では、API 未設定 / fetch 失敗時に repo 同梱 JSON を自動表示しない
  - repo 同梱 JSON fallback は非 production の開発確認・テスト・緊急退避用
  - production で明示的に有効化する場合のみ `MINI_TOOLS_ENABLE_LOCAL_DATA_FALLBACK=1` を設定する
- `res.json()` で受けているため、HTTP レスポンス形式は JSON
  - ただし、その JSON が upstream の保存ファイルそのものか、API が加工して返した JSON かは、この repo だけでは分からない

## 一覧

| Tool | 初回表示 | 画面操作後 | 設定 | Fallback | 備考 |
| --- | --- | --- | --- | --- | --- |
| `topix33` | サーバーで `loadTopix33Manifest()` / `loadTopix33DayData()` | クライアントは `/tools/topix33/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | production ではなし。非 production / 明示 env のみ `app/tools/topix33/data` のローカル JSON | 同じデータソースを、SSR と client route の 2 入口で使っている |
| `nikkei-contribution` | サーバーで `loadContributionManifest()` / `loadContributionDayData()` | クライアントは `/tools/nikkei-contribution/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | production ではなし。非 production / 明示 env のみ `app/tools/nikkei-contribution/data` のローカル JSON | `topix33` とほぼ同じ構成 |
| `stock-ranking` | サーバーで `loadRankingManifest()` / `loadRankingDayData()` と共通休場日 loader を呼ぶ | クライアントは `/tools/stock-ranking/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | production ではなし。非 production / 明示 env のみ `app/tools/stock-ranking/data` とローカル休場日 JSON | repo 同梱 JSON は履歴保管の主用途にしない |
| `us-stock-ranking` | サーバーで `loadUsRankingManifest()` を読み、`manifest.dates` を最大 5 件試して最初に取得できた日次データを初期表示に使う | クライアントは `/tools/us-stock-ranking/data/[date]` を叩き、route 内で同じ loader を呼ぶ | `MARKET_INFO_API_BASE_URL` | なし。未設定時 / fetch 失敗時は「データ取得不可」表示 | API パスは `/us-stock-ranking/*` ではなく `/us-ranking/*` |
| `market-rankings` | サーバーで `loadMarketRankingManifest()` / `loadMarketRankingMonthData()` を呼び、`type` / `month` を正規化して初期表示を決める | クライアント再 fetch は基本なし。`type` / `month` の変更は query string を更新して server を再評価する | `MARKET_INFO_API_BASE_URL` | なし。未設定時は「API 未接続」表示、対象月 fetch 失敗時は error card 表示 | 月次 API 前提。repo 同梱 JSON は持たない |
| `yutai-candidates` | サーバーで `loadMonthlyYutaiPageData()` | クライアント再 fetch は基本なし。月切替は route 遷移でサーバー再評価 | `MARKET_INFO_API_BASE_URL` | production ではなし。非 production / 明示 env のみ manifest / month data / sample を使用 | SBI は `is_short=true` の扱い有無だけを表示し、在庫状態では除外しない |
| `earnings-calendar` | サーバーで `loadEarningsCalendarPageData()` を呼ぶ | クライアント再 fetch なし | `MARKET_INFO_API_BASE_URL` | production ではなし。非 production / 明示 env のみ国内同梱 JSON を使用。海外は API 未設定/失敗時は非表示 | 国内・海外ともに `earnings-calendar/{domestic\|overseas}/*` API を優先取得する |

## `topix33` の具体的な流れ

### 初回表示

1. [page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/page.tsx) がサーバー上で実行される
2. [data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data-loader.ts) の `loadTopix33Manifest()` / `loadTopix33DayData()` を呼ぶ
3. `MARKET_INFO_API_BASE_URL` があれば `GET {baseUrl}/topix33/...`
4. 失敗時は production ではデータなしとして扱い、非 production / 明示 env のみ `app/tools/topix33/data/*.json` を読む

### 日付切り替え

1. [ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/ToolClient.tsx) がブラウザから `GET /tools/topix33/data/{date}` を呼ぶ
2. [route.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data/[date]/route.ts) が受ける
3. route 内で `loadTopix33DayData(date)` を呼ぶ
4. その内部では初回表示時と同じく `MARKET_INFO_API_BASE_URL` を優先し、production ではローカル JSON へ自動 fallback しない

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
- fallback ポリシーは「production では repo 同梱 JSON を自動表示しない」「非 production / 明示 env では開発・緊急退避用に fallback 可」に寄せている
- 月次系は query string ベース、日次系は internal route ベースで、操作後の再取得経路が 2 パターンある（設計判断は decision-log 参照）

## 今後そろえたい観点

- 初回表示と画面操作後で、取得経路をどこまで統一するか
- **internal route を置く tool / 置かない tool の基準**（現状: 日次データを client 側で切り替える tool は internal route を持つ。月次系は query string + server 再評価で代替）
- fallback の原則（production では古い同梱 JSON を自動表示しない。非 production / 明示 env のみ許可）
- **cache-control / `revalidate` の原則**（現状: `fetchJson` は 300 秒 revalidate、`buildDateDataRoute` は `Cache-Control: s-maxage=300` を設定済み）
- 「外部 API の JSON をそのまま返す route」と「加工して返す route」の区別

## fallback 方針の補足

- market tools の本番主経路は `MARKET_INFO_API_BASE_URL`
- repo 同梱 JSON fallback は当面残すが、役割は `開発` と `緊急退避`
- production では API 未設定 / fetch 失敗時に repo 同梱 JSON を自動表示しない
- production で repo 同梱 JSON fallback を使う場合は `MINI_TOOLS_ENABLE_LOCAL_DATA_FALLBACK=1` を明示する
- 特に `stock-ranking` は、repo 同梱 JSON を履歴アーカイブとして増やし続けない
- `public/data/jpx_listed_companies.json` は現時点では repo 同梱維持でよい

## `GET /nikko/credit` response contract

日興信用情報は `yutai-candidates` の信用バッジ、クロス可否フィルタ、一般売建可能数量ソートで使う。
規制情報を含める判断理由は [2026-05-14 日興信用 JSON contract](../../decision-log/2026-05-14-nikko-credit-json-contract.md) を参照。

トップレベル:

| field | 型 | 内容 |
|---|---|---|
| `date` | string | データ日付。`YYYY-MM-DD` |
| `generated_at` | string | JSON 生成時刻。ISO 文字列 |
| `record_count` | number | `by_code` の銘柄数 |
| `by_code` | object | 銘柄コードを key にした辞書 |

各銘柄レコード:

| field | 型 | 内容 |
|---|---|---|
| `institutional_buy` | boolean | 制度信用買い可否 |
| `institutional_short` | boolean | 制度信用売り可否 |
| `general_buy` | boolean | 一般信用買い可否 |
| `general_short` | boolean | 一般信用売り可否 |
| `available_shares` | number \| null | 一般信用売り可能数量。未取得・空欄は `null` |
| `has_exchange_regulation` | boolean | 公的規制あり |
| `has_internal_regulation` | boolean | 社内規制あり |
| `regulation_sources` | array | 規制ソース配列。値は `exchange` / `internal` |
| `regulation_details` | string[] | 規制明細配列 |

`regulation_details` は次の文字列形式にする。

```text
source|market|restriction|effective_date
```

日興の現行社内規制ページのように市場列がない場合は、`market` を省略して次の形式にする。

```text
source|restriction|effective_date
```

例:

```json
[
  "exchange|日証金（東証）|新規売建規制 取引停止|2022/07/06",
  "internal|新規売建規制 取引停止|2011/12/05"
]
```

### `yutai-candidates` の日興信用 badge 判定

UI は「今、一般信用売りでクロス可能か」と「監視継続すべきか」を分けて扱う。
一般信用の表示は `一般売可` / `一般注意` / `一般規制` の 3 種類に限定し、`一般在庫?` は表示しない。
制度信用は一般クロス可否とは別表示として `制度売可` を出す。

| ケース | Before 表示 | After 表示 | クロス対象 | 監視継続 |
|---|---|---|---|---|
| `general_short=true` かつ `available_shares>0` | 一般売可 | 一般売可 | Yes | Yes |
| 上記 + 貸株注意喚起 | 一般売可 | 一般注意 | Yes | Yes |
| 新規売建規制 + 取引停止 | 表示なし | 一般規制 | No | Yes |
| `general_short=false` かつ `available_shares>0`、売建規制なし | 表示なし | 表示なし | No | Yes |
| `general_short=false` かつ `available_shares=0/null`、売建規制なし | 表示なし | 表示なし | No | 低頻度 |
| `institutional_short=true` | 制度売可 | 制度売可 | 一般クロス判定には使わない | 任意 |
| `institutional_short=true` かつ一般は不可 | 制度売可 | 制度売可 のみ | No | 任意 |
| 一般・制度どちらも不可 | 表示なし | 表示なし | No | 低頻度 |

判定順:

```ts
if (hasSellStop) show "一般規制";
else if (canCrossNow && hasLendingCaution) show "一般注意";
else if (canCrossNow) show "一般売可";

if (institutional_short) show "制度売可";
```

- `hasSellStop`: `regulation_details` に `新規売建規制` と `取引停止` を含む明細がある
- `hasLendingCaution`: `regulation_details` に `貸株注意喚起` を含む明細がある
- `canCrossNow`: `general_short=true` かつ `available_shares>0` かつ売建停止なし
- `3549` は After 表示で `一般規制` として扱う

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
- [app/tools/yutai-candidates/types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/types.ts)
- [app/tools/earnings-calendar/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/earnings-calendar/page.tsx)
- [.env.local.example](/c:/Users/yutaz/dev/mini-tools/.env.local.example)
