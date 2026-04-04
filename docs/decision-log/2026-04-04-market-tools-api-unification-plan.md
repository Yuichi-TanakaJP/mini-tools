# 2026-04-04 market tools の API 統一方針

## 背景

- `mini-tools` では market tools の取得経路が混在している
  - `MARKET_INFO_API_BASE_URL` を使う loader
  - 公開 JSON base URL を前提にした env
  - repo 同梱 JSON fallback
- 特に次の env は役割が揺れている
  - `STOCK_RANKING_DATA_BASE_URL`
  - `NIKKEI_CONTRIBUTION_DATA_BASE_URL`
  - `MONTHLY_YUTAI_DATA_BASE_URL`
- 将来的な保守性、拡張性、取得経路の説明しやすさを考えると、market tools は API 経由へ寄せた方が整理しやすい

## 今回決めたこと

- market tools の標準取得入口は `MARKET_INFO_API_BASE_URL` に統一する
- 既存の公開 JSON base URL 系 env は、今回の整理では削除側で進める
- 削除前提の env に依存していた取得経路は、`market_info API` 側に必要エンドポイントを追加して吸収する
- `mini-tools` から `market_info API` への依頼は、「実装してほしい endpoint 一覧」「response contract」「移行順」を明記して出す

## 判断理由

### 1. 入口を一本化したい

- `mini-tools` 側で「この tool は API、これは公開 JSON、これは local fallback」と説明が分かれると、運用判断が難しくなる
- env の意味も増えすぎると、設定ミスや放置される名残設定が増える

### 2. 将来の拡張に備えたい

- API 経由に寄せると、将来 response を加工しやすい
- 認可、キャッシュ、監視、versioning を足しやすい
- upstream の保存先をアプリ側から切り離しやすい

### 3. 公開 URL はセキュリティ改善には直結しない

- 公開データをクライアントに返す以上、JSON 自体は取得可能
- ただし API に集約すると「どこから取るか」「何を返すか」の責務は整理しやすい

## 削除対象として扱う env

- `STOCK_RANKING_DATA_BASE_URL`
- `NIKKEI_CONTRIBUTION_DATA_BASE_URL`
- `MONTHLY_YUTAI_DATA_BASE_URL`

補足:

- すぐに `.env.local.example` から消すかどうかは、移行完了タイミングに合わせる
- 先に `market_info API` 側で必要 endpoint を揃え、その後 `mini-tools` 側から参照を外す順が安全

## market_info API 側で必要になる endpoint

### 既存前提として維持したいもの

- `GET /topix33/manifest`
- `GET /topix33/{date}`
- `GET /nikkei/manifest`
- `GET /nikkei/{date}`
- `GET /ranking/manifest`
- `GET /ranking/{date}`
- `GET /yutai/manifest`
- `GET /yutai/monthly/{yearMonth}`
- `GET /nikko/credit`

### 公開 JSON 依存を外すために追加したいもの

- `GET /market-calendar/jpx-closed`
  - 返すもの:
    - `jpx_market_closed_20260101_to_20271231.json` と同等 shape
  - 用途:
    - `stock-ranking`
    - `topix33`
    - `nikkei-contribution`
    - 将来的な market tools 共通利用

補足:

- endpoint 名は例であり、`/holidays/jpx-market-closed` などでもよい
- 重要なのは「休場日 JSON を API から一貫して取得できる」こと

## mini-tools 側の整理方針

### 1. 優先して揃えるもの

- `topix33`
- `nikkei-contribution`
- `stock-ranking`
- `yutai-candidates`

### 2. 後追いで整理するもの

- `earnings-calendar` の API 化
  - 現時点ではローカル JSON 読みで動いているため、今回の最小移行スコープからは外してよい

### 3. fallback の扱い

- API 未設定時 / fetch 失敗時のローカル fallback は当面残してよい
- ただし fallback の役割は「開発・緊急退避」に限定し、本番の主経路は API に固定する

## market_info API への依頼の出し方

次の 4 点を必ずセットで伝える。

1. 目的
2. 必要 endpoint 一覧
3. response contract
4. mini-tools 側の移行順

### 依頼テンプレート

```text
件名:
feat(api): unify market tools endpoints for mini-tools

背景:
- mini-tools で market tools の取得経路を MARKET_INFO_API_BASE_URL に統一したい
- 公開 JSON base URL 依存を減らし、API 経由へ寄せたい

依頼したいこと:
1. 次の endpoint を提供したい / 維持したい
   - GET /topix33/manifest
   - GET /topix33/{date}
   - GET /nikkei/manifest
   - GET /nikkei/{date}
   - GET /ranking/manifest
   - GET /ranking/{date}
   - GET /yutai/manifest
   - GET /yutai/monthly/{yearMonth}
   - GET /nikko/credit
   - GET /market-calendar/jpx-closed

2. response は mini-tools の既存 contract と互換を保ちたい

3. /market-calendar/jpx-closed は、現在 mini-tools が参照している
   jpx_market_closed_20260101_to_20271231.json と同等 shape を返したい

4. mini-tools 側では endpoint 提供確認後に
   - 公開 JSON base URL 依存を削除
   - env 整理
   - docs 更新
   を進める

補足:
- endpoint 名は相談可能
- まずは response shape を確定したい
```

## 移行の推奨順

1. `market_info API` 側で endpoint 一覧を確認する
2. 不足 endpoint を追加する
3. `mini-tools` 側で API 経由に寄せる
4. 旧 env 参照を削除する
5. `.env.local.example` と docs を更新する

## 影響範囲

- `mini-tools` の market tools loader
- `.env.local.example`
- docs の構成説明
- `market_info API` の endpoint 設計

## 残課題

- `earnings-calendar` も API 化するか
- fallback をどこまで残すか
- API の versioning を先に切るか
- `market_info API` 側で contract テストを持つか

## 関連

- [Market Tools データ取得経路一覧](../market-tools-data-fetch-paths.md)
- [mini-tools システム構成概要](../system-architecture-overview.md)
- [2026-03-26 株価ランキングのデータ連携手順メモ](./2026-03-26-stock-ranking-data-update-ops.md)
