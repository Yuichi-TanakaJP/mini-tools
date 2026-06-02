# 投資主体別売買動向 仕様

## 概要

- URL: `/tools/investor-flow`
- 分類: market tool
- 主な用途: JPX 公式データ由来の週次投資主体別売買動向から、買い主体の割合、買い越し/売り越し金額、前週からの反転を確認する

## 画面仕様

### 主な画面要素

- 週選択
- 主要主体カード（海外投資家、個人、信託銀行、総計）
- 表示タブ
  - サマリー
  - 構造
  - 詳細
- JPX 元データリンク

### 出力

- サマリーは分析 API が取得できる場合、次を優先表示する
  - 最大買い越し
  - 最大売り越し
  - 海外投資家 / 個人の買い構成比
  - 主体別・週次ヒートマップ
  - 差引金額ランキング
  - 前週から買い越し/売り越しが反転した主体
  - 同方向が継続している主体
- 分析 API が取得できない場合も、raw investor-flow payload から計算できる範囲で同じサマリー枠を表示する
- raw のみの場合、反転・継続は比較データ待ちとして表示する
- 構造タブは `総計 -> 自己計 / 委託計 -> 委託内訳` の関係を表示する
- 詳細タブは各内訳テーブルを表示する

## データ仕様

### 取得元

- `MARKET_INFO_API_BASE_URL/investor-flow/manifest`
- `MARKET_INFO_API_BASE_URL/investor-flow/latest`
- `MARKET_INFO_API_BASE_URL/investor-flow/weeks/{start_date}/{end_date}`
- `MARKET_INFO_API_BASE_URL/investor-flow/analysis/manifest`
- `MARKET_INFO_API_BASE_URL/investor-flow/analysis/latest`
- `MARKET_INFO_API_BASE_URL/investor-flow/analysis/weeks/{start_date}/{end_date}`

### 保存先

- repo 同梱 JSON は持たない
- ユーザー入力やローカル保存はない

### fallback

- `MARKET_INFO_API_BASE_URL` 未設定時は「データ取得先が未接続です」表示
- raw payload が取得できない場合は対象週の error card を表示する
- analysis payload が取得できない場合でも、raw payload があれば画面表示は継続する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | manifest の最新週を選択し、raw payload と analysis payload を取得する |
| 週切替 | query string を更新し、server component を再評価する |
| API 未設定 | データ取得先が未接続 |
| raw payload 取得失敗 | 選択週のデータ取得失敗 card |
| analysis payload 取得失敗 | 注意表示を出し、raw payload から計算できるサマリーに fallback |

## premium / 権限制御

- なし

## 関連実装

- [data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/investor-flow/data-loader.ts)
- [ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/investor-flow/ToolClient.tsx)
- [types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/investor-flow/types.ts)

## 関連 docs

- UAT: [investor-flow.md](../../uat/investor-flow.md)
- Decision Log: [2026-06-01 投資主体別売買動向の分析API優先表示](../../decision-log/2026-06-01-investor-flow-analysis-api-view.md)
- Cross-cutting: [Market Tools データ取得経路一覧](../cross-cutting/market-tools-data-fetch-paths.md)
