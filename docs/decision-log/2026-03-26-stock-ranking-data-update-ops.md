# 2026-03-26 株価ランキングのデータ連携手順メモ

> Note
> このメモは 2026-03-26 時点の運用整理です。
> 現行の標準取得入口は `STOCK_RANKING_DATA_BASE_URL` ではなく `MARKET_INFO_API_BASE_URL` です。
> 最新方針は [2026-04-04 market tools の API 統一方針](./2026-04-04-market-tools-api-unification-plan.md) と
> [2026-04-05 jpx-closed endpoint の確定事項](./2026-04-05-jpx-closed-endpoint-finalization.md) を参照します。

## 背景

`stock-ranking` は、`mini-tools` 側で [`app/tools/stock-ranking/data/manifest.json`](../../../app/tools/stock-ranking/data/manifest.json) を起点に利用可能日を判断し、各日付の JSON を読み込んで表示している。  
一方で、日次ランキングの元データ取得や整形は `market_info` 側で行う方が責務分離として自然。

このため、ランキングも `yutai-memo` や `earnings-calendar` と同様に、

- 生成責務: `market_info`
- 外部公開責務: `market_info`
- 取り込み・表示責務: `mini-tools`

で運用する前提を整理する。

## 現状の `mini-tools` 前提

### UI が期待しているもの

- `manifest.json`
  - `dates`: 利用可能日一覧
  - `latest`: 初期表示日
- `YYYYMMDD.json`
  - その日のランキング本体
  - `date`
  - `records[]`

参照:

- [`app/tools/stock-ranking/data-loader.ts`](../../../app/tools/stock-ranking/data-loader.ts)
- [`app/tools/stock-ranking/types.ts`](../../../app/tools/stock-ranking/types.ts)
- [`app/tools/stock-ranking/ToolClient.tsx`](../../../app/tools/stock-ranking/ToolClient.tsx)

### いまの変換フロー

現状は `mini-tools` 側に [`scripts/convert-ranking-csv.mjs`](../../../scripts/convert-ranking-csv.mjs) があり、内藤形式 CSV を日次 JSON と `manifest.json` に変換している。

つまり、**必要な成果物フォーマットはすでに決まっている**。  
`market_info` から渡すべきものも、このフォーマットに合わせればよい。

## 推奨する連携方針

### 1. `market_info` 側でやること

- 日次ランキング元データを取得する
- `mini-tools` がそのまま読める JSON 形式へ整形する
- 少なくとも以下を出力する
  - `manifest.json`
  - `YYYYMMDD.json`
- 出力先の候補
  - `output/final/stock_ranking/manifest.json`
  - `output/final/stock_ranking/YYYYMMDD.json`

### 2. `mini-tools` 側でやること

- `STOCK_RANKING_DATA_BASE_URL` で公開 base URL を指定する
- 必要なら `.../stock-ranking` のような JSON 配信ディレクトリ URL を直接指定してもよい
- loader が外部の `stock-ranking/manifest.json` と `stock-ranking/YYYYMMDD.json` を読む
- 取得失敗時だけ [`app/tools/stock-ranking/data/`](../../../app/tools/stock-ranking/data/) を fallback として使う
- `stock-ranking` UI が崩れないことを確認する

### 3. 責務を混ぜない

- `market_info`
  - 収集
  - 整形
  - 日付ごとの JSON 生成
  - `manifest.json` 更新
  - 公開ストレージへの upload
- `mini-tools`
  - 外部 JSON の取得
  - 画面表示
  - fallback 用ローカルファイルの保持
  - 軽い動作確認

`mini-tools` 側で CSV から再変換し続ける運用も可能だが、長期的には `market_info` 側で JSON 完成物まで出した方が手順がぶれにくい。

## 外部公開運用の最小手順

当面は `market_info` 側で publish された JSON を `mini-tools` が読む構成で十分。

1. `market_info` 側で当日分のランキングデータを更新する。
2. `market_info` 側で `manifest.json` と `YYYYMMDD.json` が公開 URL に upload されていることを確認する。
3. `mini-tools` 側で `STOCK_RANKING_DATA_BASE_URL` を公開 base URL に設定する。
   - 既存の配信先が `manifest.json` を直下に持つなら、その data-root URL をそのまま設定してよい。
4. `mini-tools` で `/tools/stock-ranking` を開き、公開 `manifest.json` の `latest` と `dates` が反映されていることを確認する。
5. `mini-tools` で以下を確認する。
   - `npm run lint`
   - `npm run build`
   - `/tools/stock-ranking` 初期表示
   - 追加日の選択
   - プライム / スタンダード / グロース 切り替え
   - 値上がり率 / 値下がり率 / 売買高 切り替え
6. docs / env 設定に変更があればコード PR として反映する。

## `market_info` から `mini-tools` へ渡す contract

最低限、日次 JSON は次の項目を満たす必要がある。

- `date`: `YYYY-MM-DD`
- `records[].market`: `プライム | スタンダード | グロース`
- `records[].ranking`: `値上がり率 | 値下がり率 | 売買高`
- `records[].rank`: number
- `records[].name`: string
- `records[].code`: string
- `records[].marketLabel`: string
- `records[].industry`: string
- `records[].price`: number
- `records[].time`: string
- `records[].change`: number
- `records[].changeRate`: number
- `records[].volume`: number
- `records[].value`: number

`mini-tools` 側はこの shape をそのまま描画に使っているため、ここを変える場合は `types.ts` と UI の同時更新が必要になる。

## 判断メモ

採用推奨:

- `market_info` で JSON 完成物を出して公開する
- `mini-tools` は外部 JSON の取得と表示に専念する
- 取得失敗時だけ local fallback を使う
- コード変更 PR とデータ更新運用は分ける

今回は見送ってよい:

- repo 間の自動同期
- GitHub Actions による自動 PR 作成
- `mini-tools` 側での再変換処理の常用

## 次の一歩

実務上は次の順で進めるのがよい。

1. `market_info` 側にランキング JSON 出力先を固定する。
2. その出力をこの `mini-tools` の `stock-ranking/data` と同じ shape にそろえる。
3. 公開 base URL を `mini-tools` の環境変数に設定して動作確認する。
4. local fallback をどこまで残すかを別 Issue で判断する。
