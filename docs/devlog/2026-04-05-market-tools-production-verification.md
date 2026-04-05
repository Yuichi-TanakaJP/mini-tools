# 2026-04-05 market tools 本番確認メモ

## 目的

- `MARKET_INFO_API_BASE_URL` 前提に寄せた market tools の本番疎通を確認する
- `/market-calendar/jpx-closed` を含む運用整理後に、`mini-tools` 側の実応答を残す

## 確認日時

- 2026-04-05 JST

## 確認対象

- 本番 URL: `https://mini-tools-rho.vercel.app`
- API URL: `https://market-info-api-619599800912.asia-northeast1.run.app`

## 確認内容

### 1. market-info-api の live fetch

- `GET /market-calendar/jpx-closed`
  - `as_of_date`: `2026-04-05`
  - `from`: `2026-01-01`
  - `to`: `2027-12-31`
  - `days` 先頭要素: `2026-01-01 / true / 元日`

### 2. mini-tools 本番ページ

- `GET /tools/topix33` -> `200`
- `GET /tools/nikkei-contribution` -> `200`
- `GET /tools/stock-ranking` -> `200`
- `GET /tools/yutai-candidates` -> `200`

### 3. mini-tools internal data route

- `GET /tools/topix33/data/2026-04-03` -> `200`
- `GET /tools/nikkei-contribution/data/2026-04-02` -> `200`
- `GET /tools/stock-ranking/data/2026-04-03` -> `200`

## メモ

- 実動作確認時点で、対象 market tools のページ応答と data route 応答は問題なし
- `jpx-closed` は `MARKET_INFO_API_BASE_URL/market-calendar/jpx-closed` で取得できることを確認済み
- 画面の人手目視は別途必要なら追加で行うが、少なくとも SSR / route 応答レベルでは運用可能
