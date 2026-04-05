# 2026-04-05 jpx-closed endpoint の確定事項

## 背景

- market tools の休場日取得は `MARKET_INFO_API_BASE_URL` に寄せる方針で整理している
- 直前までは `JPX_CLOSED_OBJECT_KEY` や period 付き filename 前提の運用確認が必要という前提が混ざっていた
- `market-info-api` 側で内部実装が stable alias 方式に切り替わり、mini-tools からは内部キーや filename を意識しなくてよくなった

## 今回決めたこと

- mini-tools は `GET /market-calendar/jpx-closed` をそのまま使ってよい
- `JPX_CLOSED_OBJECT_KEY` の設定有無を mini-tools 側で意識しない
- period 付き filename を mini-tools 側の docs や code に持ち込まない
- response shape は従来の thin JSON と互換を前提にする
  - `as_of_date`
  - `from`
  - `to`
  - `days[]`
  - `days[]` の各要素は `date`, `market_closed`, `label`

## 判断理由

### 1. 入口を一本化したい

- market tools の説明を endpoint 単位で統一できる
- upstream の保存方式変更が mini-tools の docs や code に漏れにくくなる

### 2. 休場日だけ別運用にしない

- `topix33` / `nikkei` / `ranking` / `yutai` / `nikko` と同じく、`MARKET_INFO_API_BASE_URL` 配下の endpoint として扱える
- 「休場日だけ direct JSON filename を知っている必要がある」状態を避けられる

## mini-tools 側の実装方針

- `lib/jpx-market-closed.ts` は API を主経路にし、失敗時のみローカル JSON fallback を使う
- docs から `JPX_CLOSED_OBJECT_KEY` や direct filename 前提の説明は外す
- fallback は開発・緊急退避用途としてのみ残し、本番の標準入口は `/market-calendar/jpx-closed` とする

## 影響範囲

- `lib/jpx-market-closed.ts`
- `README.md`
- `docs/market-tools-data-fetch-paths.md`
- `docs/system-architecture-overview.md`

## 関連

- [2026-04-04 market tools の API 統一方針](./2026-04-04-market-tools-api-unification-plan.md)
- [Market Tools データ取得経路一覧](../market-tools-data-fetch-paths.md)
