# 2026-04-25 国内決算カレンダーを API-first に切り替え

## 背景

`market_info` 側で国内決算カレンダーの最新データが R2 に publish 済みだが、
`mini-tools` では国内のみ同梱 JSON を読んでいたため、2026-05 分が表示されていなかった。
海外決算カレンダーは `market-info-api` 経由で取得済みで、国内だけが取り残されていた。

## 決めたこと

### 1. 国内決算カレンダーも API-first に切り替える

- `MARKET_INFO_API_BASE_URL` が設定されていれば、まず以下の endpoint を読む:
  - `GET /earnings-calendar/domestic/manifest`
  - `GET /earnings-calendar/domestic/monthly/{YYYY-MM}`
  - `GET /earnings-calendar/domestic/latest`
- API 取得に失敗した場合（未設定 / ネットワークエラー / 4xx）のみ、repo 同梱 JSON にフォールバックする

### 2. 同梱 JSON の役割

- 同梱 JSON（`app/tools/earnings-calendar/data/`）は「開発・緊急退避」用として継続して保持する
- 本番主経路は API とし、同梱 JSON は履歴アーカイブとして増やし続けない
- `jpx_market_closed_*.json` は同梱を維持する（更新頻度が低く、API 化の優先度が低い）

### 3. 海外との対称性を保つ

国内と海外で loader の構造を揃えることで、将来の統合や変更が局所化しやすくなる。

## 影響範囲

- `app/tools/earnings-calendar/data-loader.ts` — `loadDomesticData()` を API-first に変更
- `app/tools/earnings-calendar/__tests__/data-loader.test.ts` — テストケースを更新
- `app/tools/earnings-calendar/ToolClient.tsx` — 空状態テキストを修正
- `docs/market-tools-data-fetch-paths.md` — earnings-calendar 行を更新

## 結果

- 2026-05 分の国内決算カレンダーが表示されるようになった
- 過去の 2026-03 分も manifest に含まれる月として引き続き表示可能
- API 失敗時は従来通り同梱 JSON から表示される
