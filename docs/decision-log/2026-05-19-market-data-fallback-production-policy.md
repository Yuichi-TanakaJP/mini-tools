# 2026-05-19 market data fallback の production 運用方針

## 背景

- market-info と mini-tools の責務境界を整理した。
- market-info は市場データの正本・生成・更新・配信 API を担当する。
- mini-tools は API から受け取ったデータの表示、操作、短期キャッシュ、エラー表示を担当する。
- これまで一部 market tools は API 未設定時や fetch 失敗時に repo 同梱 JSON を自動 fallback 表示していた。

## 今回決めたこと

- production では、market API の取得失敗時に repo 同梱 JSON を自動表示しない。
- repo 同梱 JSON は、非 production の開発確認・テスト・緊急退避用に限定する。
- production で repo 同梱 JSON fallback を使う必要がある場合は、`MINI_TOOLS_ENABLE_LOCAL_DATA_FALLBACK=1` を明示的に設定したときだけ許可する。
- API 未設定または API 取得失敗時は、画面側ではデータなし・API 未接続・取得失敗として扱う。
- `jpx_listed_companies.json` のような低頻度マスタは、この判断の主対象外とする。

## 判断理由

- mini-tools 側が古い同梱 JSON を正常データのように表示すると、ユーザーが鮮度の低い市場データを現在情報と誤認するリスクがある。
- ランキング、信用在庫、決算予定、開示情報などは鮮度が価値の中心であり、古い fallback 表示より明示的な取得失敗表示の方が安全。
- repo 同梱 JSON は開発時の取り回しや API 障害時の手動退避には有用なので、完全削除ではなく production 自動 fallback だけを止める。

## 影響範囲

- `topix33`
- `nikkei-contribution`
- `stock-ranking`
- `yutai-candidates`
- `earnings-calendar` 国内データ
- JPX 休場日 loader

## 残課題

- fallback が無効な場合の各 tool のエラー文言や空状態表示を、必要に応じて tool spec / UAT で細かく見直す。
- repo 同梱 JSON をどこまで削減するかは、別のデータ整理 PR で扱う。

## 関連

- 参照 docs:
  - [Market Tools データ取得経路一覧](../specs/cross-cutting/market-tools-data-fetch-paths.md)
  - [mini-tools システム構成概要](../specs/cross-cutting/system-architecture-overview.md)
