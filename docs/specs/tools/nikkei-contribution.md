# 日経225寄与度 仕様

## 概要

- URL: `/tools/nikkei-contribution`
- 分類: 国内市場データ系ツール
- 主な用途: 日経225の上昇・下落寄与ランキング、全銘柄テーブル、影響度マップを日付別に確認する

## 対象ユーザー

- 日経平均の上下に寄与した銘柄を確認したいユーザー
- 銘柄ごとの寄与度、騰落率、ウェイトを一覧で見たいユーザー
- 指数の変動要因を短時間で把握したいユーザー

## 画面仕様

### 主な画面要素

- 日付セレクタ
- 上昇寄与ランキング
- 下落寄与ランキング
- 全銘柄テーブル
- 影響度マップ
- データなし表示

### 入力

- 日付選択

### 出力

- 銘柄コード
- 銘柄名
- セクター
- 株価
- みなし額面
- ウェイト
- 前日比
- 騰落率
- 寄与度
- 上昇 / 下落 / 変わらず件数
- 合計寄与度

## データ仕様

### 取得元

| データ | 取得元 |
|---|---|
| 寄与度 manifest | `MARKET_INFO_API_BASE_URL/nikkei/manifest` を優先。失敗時は repo 同梱 JSON |
| 日別寄与度 | `MARKET_INFO_API_BASE_URL/nikkei/<date>` を優先。失敗時は repo 同梱 JSON |
| JPX 休場日 | `MARKET_INFO_API_BASE_URL/market-calendar/jpx-closed` を優先。失敗時は同梱 JSON |

### 保存先

- ユーザー入力データは保存しない
- 日付選択は画面操作中の UI state として扱う
- LocalStorage やサーバー DB には保存しない

### fallback

- `MARKET_INFO_API_BASE_URL` が未設定の場合は repo 同梱 JSON を使う
- API 取得に失敗した場合は repo 同梱 JSON に fallback する
- manifest が取得できない場合は空の manifest として扱う
- 日別データが取得できない場合はデータなしとして扱う

## 日付仕様

- manifest の日付一覧から、週末と JPX 休場日を除外する
- 初期表示日は、除外後の日付一覧から最初に使えるデータを探して決める
- 全銘柄の `chg`、`chg_pct`、`contribution` がすべて 0 の日は市場クローズ扱いとして初期表示候補から除外する
- 初期表示候補から除外された先頭日付は、日付セレクタからも除外する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | Server Component で manifest、JPX 休場日、最初に使える日別データを取得する |
| manifest 空 | 日付セレクタを空にし、データなしとして表示する |
| 日別データなし | ランキングとテーブルをデータなしとして表示する |
| 市場クローズ扱いの日 | 初期表示候補からスキップする |
| API 失敗 | 同梱 JSON に fallback し、raw error は表示しない |

## premium / 権限制御

- premium 制限なし
- ログイン不要で利用できる

## 関連実装

- [app/tools/nikkei-contribution/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/nikkei-contribution/page.tsx)
- [app/tools/nikkei-contribution/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/nikkei-contribution/ToolClient.tsx)
- [app/tools/nikkei-contribution/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/nikkei-contribution/data-loader.ts)
- [app/tools/nikkei-contribution/types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/nikkei-contribution/types.ts)

## 関連 docs

- UAT: [日経225寄与度 UAT](../../uat/nikkei-contribution.md)
- Decision Log:
  - [日経225寄与度ツールのデータ連携と UI 判断](../../decision-log/2026-03-28-nikkei-contribution-data-and-ui.md)
  - [market tools の日付 UI と休場日扱いの整理](../../decision-log/2026-03-29-market-tools-date-ui-and-holiday-handling.md)
  - [market tools の API 統一方針](../../decision-log/2026-04-04-market-tools-api-unification-plan.md)
