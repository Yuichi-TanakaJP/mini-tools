# TOPIX33業種 仕様

## 概要

- URL: `/tools/topix33`
- 分類: 国内市場データ系ツール
- 主な用途: TOPIX33業種の上昇・下落ランキング、全33業種一覧、premium preview 表示を日付別に確認する

## 対象ユーザー

- 国内市場の業種別騰落を確認したいユーザー
- 上昇業種・下落業種を短時間で把握したいユーザー
- premium preview の表示導線を確認したい開発・運用者

## 画面仕様

### 主な画面要素

- 日付セレクタ
- 上昇業種ランキング
- 下落業種ランキング
- 全33業種一覧テーブル
- premium 機能プレースホルダー
- データなし表示

### 入力

- 日付選択
- premium preview のログイン導線操作

### 出力

- 業種コード
- 業種名
- 前日比
- 騰落率
- 上昇 / 下落 / 変わらず業種数
- premium preview の表示枠

## データ仕様

### 取得元

| データ | 取得元 |
|---|---|
| TOPIX33 manifest | `MARKET_INFO_API_BASE_URL/topix33/manifest` を優先。失敗時は repo 同梱 JSON |
| 日別 TOPIX33 | `MARKET_INFO_API_BASE_URL/topix33/<date>` を優先。失敗時は repo 同梱 JSON |
| JPX 休場日 | `MARKET_INFO_API_BASE_URL/market-calendar/jpx-closed` を優先。失敗時は同梱 JSON |

### 保存先

- ユーザー入力データは保存しない
- 日付選択や preview 表示状態は画面操作中の UI state として扱う
- premium 仮ログインは共通の Cookie 仕様に従う

### fallback

- `MARKET_INFO_API_BASE_URL` が未設定の場合は repo 同梱 JSON を使う
- API 取得に失敗した場合は repo 同梱 JSON に fallback する
- manifest が取得できない場合は空の manifest として扱う
- 日別データが取得できない場合はデータなしとして扱う

## 日付仕様

- manifest の日付一覧から、週末と JPX 休場日を除外する
- 初期表示日は、除外後の日付一覧から最初に使えるデータを探して決める
- `sectors.length === 0` の日は初期表示候補から除外する
- 初期表示候補から除外された先頭日付は、日付セレクタからも除外する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | Server Component で manifest、JPX 休場日、最初に使える日別データを取得する |
| manifest 空 | 日付セレクタを空にし、データなしとして表示する |
| 日別データなし | ランキングと一覧をデータなしとして表示する |
| sectors 空の日 | 初期表示候補からスキップする |
| API 失敗 | 同梱 JSON に fallback し、raw error は表示しない |

## premium / 権限制御

- 通常の TOPIX33 表示はログイン不要
- premium 機能は現時点では preview / プレースホルダー
- 本格的な会員 DB、課金、権限テーブルは未実装
- premium 仮ログインの扱いは [premium ログイン導線の暫定実装方針](../../decision-log/2026-04-04-premium-login-placeholder-flow.md) を参照する

## 関連実装

- [app/tools/topix33/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/page.tsx)
- [app/tools/topix33/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/ToolClient.tsx)
- [app/tools/topix33/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/data-loader.ts)
- [app/tools/topix33/types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/topix33/types.ts)

## 関連 docs

- UAT: [TOPIX33業種 UAT](../../uat/topix33.md)
- Decision Log:
  - [TOPIX33業種データ追加と market tools 導線の方針](../../decision-log/2026-03-31-topix33-market-tool-plan.md)
  - [TOPIX33 premium 可視化の見せ方方針](../../decision-log/2026-04-04-topix33-premium-visualization-plan.md)
  - [premium ログイン導線の暫定実装方針](../../decision-log/2026-04-04-premium-login-placeholder-flow.md)
  - [market tools の API 統一方針](../../decision-log/2026-04-04-market-tools-api-unification-plan.md)
