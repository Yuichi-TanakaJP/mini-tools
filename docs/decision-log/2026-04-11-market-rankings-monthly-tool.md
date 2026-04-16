# 2026-04-11 市場ランキング月次ツールの追加方針

## 背景

- `market-info-api` に月次の市場ランキング API が追加された。
- 既存の `stock-ranking` は日次の値上がり率・値下がり率・売買高ランキング用であり、時価総額 / 配当利回りの月次ランキングとは用途が異なる。

## 決めたこと

- `mini-tools` には `/tools/market-rankings` を新設する。
- 画面内で `type=market-cap | dividend-yield` を切り替え、各 type ごとに `manifest` -> `monthly/{latest or selected month}` の順で取得する。
- 市場区分は `prime / standard / growth` を client-side で切り替えて表示する。
- `month` と `type` は query string で表現し、無効な `month` が来た場合は `manifest.latest` にフォールバックする。
- このツールは同梱 JSON fallback を持たず、`MARKET_INFO_API_BASE_URL` が未設定または fetch 失敗時は「未接続」表示にする。

## 理由

- 既存 `stock-ranking` に混ぜると、日次ランキングと月次ランキングで日付軸・API 契約・用途がぶつかり、UI も複雑になる。
- 月次ランキング API は `months` の manifest を正として存在月だけ取得できるため、server-side で month を正規化しておくと 404 を避けやすい。
- このデータは API 提供前提で、repo に月次アーカイブ JSON を持ち込まない方が運用を増やしにくい。

## 影響範囲

- `app/tools/market-rankings/`
- ホームの tool 一覧
- `sitemap`
- `.env.local.example`

## URL パラメータ方式の設計判断

### なぜ internal route（`data/[date]/route.ts`）を持たないか

他の日次ツール（`stock-ranking` / `topix33` / `nikkei-contribution`）は、日付切り替えのために `data/[date]/route.ts` + クライアント fetch の 2 段構成を持つ。
`market-rankings` はこのパターンを採用せず、月切り替えを **URL パラメータ（`?type=...&month=...`）+ `router.push()`** で実現している。

理由：
- 月次データであるため `useDailyMarketData` hook（日次前提）は合わない
- `router.push()` により query string が変わると Next.js がサーバー再評価するため、internal route を別途用意しなくてもサーバー側で月を正規化できる
- URL パラメータ方式により、ブラウザバック・URL シェアで月・type の選択状態が自然に保持される
- `manifest.months` は数件程度であり、全件を SSR で渡しても問題ない規模感

### 月・type の正規化ルール

- 無効な `month` クエリが来た場合は `manifest.latest` にフォールバックする
- 無効な `type` クエリが来た場合は `market-cap` にフォールバックする
- 正規化は `page.tsx`（Server Component）側で行う
