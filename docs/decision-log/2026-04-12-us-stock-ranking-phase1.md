# 2026-04-12 米国株ランキングツール phase 1 のデータ contract と実装方針

## 背景

- market_info 側で US株ランキングの raw / cleaned / UI 向け JSON 生成が整備されることになり、mini-tools 側の表示ツールが必要になった
- phase 1 として 値上り率・値下り率・売買代金 の3種を先行表示する

## 今回決めたこと

### 表示対象ランキング（phase 1）

- 表示する: 値上り率 / 値下り率 / 売買代金
- 表示しない（raw/cleaned には残る）: 売買高 / 低PER / 低PBR

### UI 向け JSON の配置と shape

| 項目 | 内容 |
|------|------|
| manifest | `output/final/ranking/us_ui/manifest.json` → `{ dates, latest }` |
| day data | `output/final/ranking/us_ui/YYYYMMDD.json` → `{ date, records[] }` |
| records 1件 | `exchange, ranking, rank, ticker, listingExchange, handlingFlag, name, nameEn, price, time, change, changeRate, volume, tradedValue, per, pbr` |
| 1日あたり件数 | 約300件（各ランキング100件ずつ） |

### ranking フィールドの値

実データのラベルに合わせて `値上り率` / `値下り率` / `売買代金`（「が」なし）。

### exchange

現時点では `all` のみを想定。市場タブは設けない。

### APIパス（mini-tools → market_info API）

- manifest: `{MARKET_INFO_API_BASE_URL}/us-ranking/manifest`
- day data: `{MARKET_INFO_API_BASE_URL}/us-ranking/{YYYY-MM-DD}`

### tradedValue の単位

千USD単位。UI 表示時に `×1000` して B / M / USD に換算。

### manifest.latest フォールバック方針

manifest 更新とデータファイル publish のタイミングずれを考慮し、`manifest.dates` を最大5件順に試して最初に取得できた日付を initialDayData と latest に使う。JP株ランキングにはない US 固有の対応。

## 判断理由

- 売買高 / 低PER / 低PBR は phase 1 スコープ外。raw/cleaned には保持するが UI JSON は絞ることで publish コストを下げる
- exchange=all 固定で市場タブなしにすることで、JP 株ランキングとの UI 差分を最小化
- フォールバック方針は Codex review P2 指摘を受けて追加

## 影響範囲

- `app/tools/us-stock-ranking/` 以下の全ファイル
- `app/page.tsx`（ツール一覧に追加）

## 残課題

- exchange が `all` 以外（NYSE 単体など）を追加するか否かは未定
- UAT チェックリストの作成（`docs/uat/us-stock-ranking.md`）

## 関連

- PR: Yuichi-TanakaJP/mini-tools#232
- 参照 docs: [Market Tools データ取得経路一覧](../market-tools-data-fetch-paths.md)
