# 株価ランキング 仕様

## 概要

- URL: `/tools/stock-ranking`
- 分類: 国内市場データ系ツール
- 主な用途: プライム・スタンダード・グロース市場の値上がり率、値下がり率、売買高ランキングを日付別に確認する

## 対象ユーザー

- 国内株の当日または過去営業日のランキングを素早く確認したいユーザー
- 市場区分ごとに値動きや売買高の大きい銘柄を見たいユーザー

## 画面仕様

### 主な画面要素

- 日付セレクタ
- 市場タブ
- ランキング種別
- ランキング一覧
- データなし表示

### 入力

- 日付選択
- 市場タブ選択
  - プライム
  - スタンダード
  - グロース
- ランキング種別選択
  - 値上がり率
  - 値下がり率
  - 売買高

### 出力

- 銘柄コード
- 銘柄名
- 市場ラベル
- 業種
- 株価
- 時刻
- 前日比
- 騰落率
- 売買高
- 売買代金

## データ仕様

### 取得元

| データ | 取得元 |
|---|---|
| ランキング manifest | `MARKET_INFO_API_BASE_URL/ranking/manifest` を優先。失敗時は repo 同梱 JSON |
| 日別ランキング | `MARKET_INFO_API_BASE_URL/ranking/<date>` を優先。失敗時は repo 同梱 JSON |
| JPX 休場日 | `MARKET_INFO_API_BASE_URL/market-calendar/jpx-closed` を優先。失敗時は同梱 JSON |

### 保存先

- ユーザー入力データは保存しない
- 日付・タブ選択は画面操作中の UI state として扱う
- LocalStorage やサーバー DB には保存しない

### fallback

- `MARKET_INFO_API_BASE_URL` が未設定の場合は repo 同梱 JSON を使う
- API 取得に失敗した場合は repo 同梱 JSON に fallback する
- manifest が取得できない場合は、データ取得不可メッセージを表示する
- 選択日の JSON が取得できない場合は、データなしとして扱う

## 日付仕様

- manifest の日付一覧から、週末と JPX 休場日を除外する
- 初期表示日は、除外後の日付一覧の先頭を使う
- JPX 休場日が取得できない場合は、同梱 JSON の休場日を使う

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | Server Component で manifest、JPX 休場日、最新日のランキングを取得する |
| manifest なし | データを取得できない旨を表示する |
| 選択日データなし | ランキングをデータなしとして表示する |
| API 失敗 | 同梱 JSON に fallback し、raw error は表示しない |

## premium / 権限制御

- premium 制限なし
- ログイン不要で利用できる

## 関連実装

- [app/tools/stock-ranking/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-ranking/page.tsx)
- [app/tools/stock-ranking/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-ranking/ToolClient.tsx)
- [app/tools/stock-ranking/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-ranking/data-loader.ts)
- [app/tools/stock-ranking/types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-ranking/types.ts)

## 関連 docs

- UAT: [株価ランキング UAT](../../uat/stock-ranking.md)
- Decision Log:
  - [株価ランキングのデータ連携手順メモ](../../decision-log/2026-03-26-stock-ranking-data-update-ops.md)
  - [market tools の日付 UI と休場日扱いの整理](../../decision-log/2026-03-29-market-tools-date-ui-and-holiday-handling.md)
  - [market tools の API 統一方針](../../decision-log/2026-04-04-market-tools-api-unification-plan.md)
