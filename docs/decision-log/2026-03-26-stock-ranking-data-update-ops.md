# 2026-03-26 株価ランキングのデータ連携手順メモ

## 背景

`stock-ranking` は、`mini-tools` 側で [`app/tools/stock-ranking/data/manifest.json`](../../../app/tools/stock-ranking/data/manifest.json) を起点に利用可能日を判断し、各日付の JSON を読み込んで表示している。  
一方で、日次ランキングの元データ取得や整形は `market_info` 側で行う方が責務分離として自然。

このため、ランキングも `yutai-memo` や `earnings-calendar` と同様に、

- 生成責務: `market_info`
- 取り込み・配布責務: `mini-tools`

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

- `market_info` 側の生成物を [`app/tools/stock-ranking/data/`](../../../app/tools/stock-ranking/data/) へコピーする
- `stock-ranking` UI が崩れないことを確認する
- データ更新 PR として反映する

### 3. 責務を混ぜない

- `market_info`
  - 収集
  - 整形
  - 日付ごとの JSON 生成
  - `manifest.json` 更新
- `mini-tools`
  - 静的ファイルの保持
  - 画面表示
  - 軽い動作確認

`mini-tools` 側で CSV から再変換し続ける運用も可能だが、長期的には `market_info` 側で JSON 完成物まで出した方が手順がぶれにくい。

## 手動連携の最小手順

当面は手動運用で十分。

1. `market_info` 側で当日分のランキングデータを更新する。
2. `market_info` 側で `manifest.json` と `YYYYMMDD.json` が生成されていることを確認する。
3. `mini-tools` 側の [`app/tools/stock-ranking/data/`](../../../app/tools/stock-ranking/data/) に必要ファイルをコピーする。
4. `mini-tools` で `manifest.json` の `latest` と `dates` が追加日付を含んでいることを確認する。
5. `mini-tools` で以下を確認する。
   - `npm run lint`
   - `npm run build`
   - `/tools/stock-ranking` 初期表示
   - 追加日の選択
   - プライム / スタンダード / グロース 切り替え
   - 値上がり率 / 値下がり率 / 売買高 切り替え
6. データ更新 PR として反映する。

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

- まずは手動コピー運用
- `market_info` で JSON 完成物を出す
- `mini-tools` は静的配布に専念する
- コード変更 PR とデータ更新 PR は分ける

今回は見送ってよい:

- repo 間の自動同期
- GitHub Actions による自動 PR 作成
- `mini-tools` 側での再変換処理の常用

## 次の一歩

実務上は次の順で進めるのがよい。

1. `market_info` 側にランキング JSON 出力先を固定する。
2. その出力をこの `mini-tools` の `stock-ranking/data` と同じ shape にそろえる。
3. まずは手動コピーで 1 日分更新して動作確認する。
4. 手間が大きくなった時点で自動同期を別 Issue で検討する。
