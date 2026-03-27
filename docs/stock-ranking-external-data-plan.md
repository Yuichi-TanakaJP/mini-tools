# 株価ランキング 外部データ公開 移行計画

Last-Updated: 2026-03-26 JST

## 目的

`stock-ranking` を、`mini-tools` リポジトリ内の静的JSON更新運用から、`market_info` が生成した外部公開JSONを読む運用へ移行する。  
これにより、毎日のデータ更新で `mini-tools` に PR / merge を発生させず、外部ユーザーに対して最新データを安定配信できる状態を目指す。

## 背景

現状の `mini-tools` は以下の前提で動いている。

- [`app/tools/stock-ranking/data/manifest.json`](../app/tools/stock-ranking/data/manifest.json) を読む
- [`app/tools/stock-ranking/data/YYYYMMDD.json`](../app/tools/stock-ranking/data/20260325.json) を読む
- repo 内の静的ファイルをそのまま画面表示する

この方式は実装が単純な一方で、日次更新を続けると `mini-tools` の履歴がデータ更新コミット中心になりやすい。

## 方針

最終形は次の責務分担にする。

- `market_info`
  - 日次ランキングデータ取得
  - UI向けJSON生成
  - 公開ストレージへの配置
- `mini-tools`
  - 公開JSONの取得
  - キャッシュ制御
  - エラー時の fallback
  - UI表示

## 推奨アーキテクチャ

```text
market_info
  -> manifest.json / YYYYMMDD.json を生成
  -> 公開ストレージへ配置

公開ストレージ + CDN
  -> manifest.json を配信
  -> 日次JSONを配信

mini-tools
  -> サーバー側で公開JSONを取得
  -> UIに表示
```

## 公開先の推奨

第一候補は `Cloudflare R2` 相当の静的オブジェクトストレージ + CDN。

理由:

- 小さなJSON配信と相性がよい
- 日次データ更新の運用が軽い
- repo を汚さずに済む
- 画面表示の応答性を保ちやすい

代替候補:

- `S3 + CloudFront`
- `Vercel Blob`
- `GitHub Pages`

ただし、初手としては「静的JSONを安定公開できること」を優先し、サービス選定は実装を複雑にしすぎない。

## データ contract

### manifest.json

最低限必要な項目:

- `dates`: `YYYY-MM-DD[]`
- `latest`: `YYYY-MM-DD`

### YYYYMMDD.json

最低限必要な項目:

- `date`: `YYYY-MM-DD`
- `records[]`
  - `market`
  - `ranking`
  - `rank`
  - `name`
  - `code`
  - `marketLabel`
  - `industry`
  - `price`
  - `time`
  - `change`
  - `changeRate`
  - `volume`
  - `value`

`mini-tools` 側の現行 shape は [`app/tools/stock-ranking/types.ts`](../app/tools/stock-ranking/types.ts) を正とする。

## 段階移行プラン

### Phase 1: market_info で UI用JSONを安定生成する

目的:

- `mini-tools` に渡す JSON shape を固定する
- CSV 依存を `market_info` 側に閉じ込める

`market_info` 側でやること:

- `naito_9tables_*_cleaned_final.csv` から `manifest.json` と `YYYYMMDD.json` を生成する処理を追加
- 出力先を固定する
  - 例: `output/final/ranking_ui/manifest.json`
  - 例: `output/final/ranking_ui/YYYYMMDD.json`
- 当日分の再実行で壊れないように冪等にする

完了条件:

- 日次実行後に `manifest.json` と当日JSONが必ず生成される
- JSON shape が `mini-tools` の現行型と一致する

### Phase 2: 公開ストレージへ配置する

目的:

- `mini-tools` repo へのデータコミットをなくす

`market_info` 側でやること:

- 日次実行フローの最後で公開先へ `manifest.json` と日次JSONを配置する
- 配置先のパスを固定する
  - 例: `/stock-ranking/manifest.json`
  - 例: `/stock-ranking/20260326.json`

考慮事項:

- 先に日次JSONを置き、最後に `manifest.json` を更新する
- これで `manifest.latest` が未反映ファイルを指す事故を減らせる

完了条件:

- 外部URLから `manifest.json` と当日JSONを取得できる
- 日次更新後、最新日付が外部公開JSONに反映される

### Phase 3: mini-tools を外部JSON参照に切り替える

目的:

- 公開アプリとして最新データ配信に対応する

`mini-tools` 側でやること:

- [`app/tools/stock-ranking/data-loader.ts`](../app/tools/stock-ranking/data-loader.ts) をローカルファイル読み込みから外部JSON取得へ切り替える
- `STOCK_RANKING_DATA_BASE_URL` には公開 base URL を設定する
- loader は `https://<public-base-url>` と `.../stock-ranking` の両方を受けられるようにする
- 可能なら `fetch` をサーバー側で行う
- 失敗時の挙動を決める
  - manifest 取得失敗時はエラー表示
  - 日次JSON取得失敗時は既存の load error 表示

完了条件:

- repo 内に日次JSONを持たなくても `/tools/stock-ranking` が表示できる
- 最新日と過去日の切り替えが外部JSONで動作する

## キャッシュ / 応答性方針

応答性を落とさないため、次のキャッシュを基本とする。

- `manifest.json`
  - 60〜300秒程度
- 日次JSON
  - 1時間〜24時間程度

理由:

- `manifest` は最新日判定に使うため短め
- 日次JSONは更新頻度が低いため長めでもよい

画面の初期表示では `manifest` と `latest` の日次JSONだけを取得し、日付切り替え時に必要な日次JSONを追加取得する。

## 費用の考え方

この計画は基本的に「少量JSONの静的配信」なので、初期段階では低コストで始めやすい。  
重要なのは厳密な最安値よりも、次の3点。

- 配置処理が簡単
- 外部公開URLが安定している
- キャッシュ制御がしやすい

## なぜこの方針がよいか

- `mini-tools` の git 履歴を日次データ更新で埋めない
- `market_info` の生成責務が明確になる
- 外部ユーザーへ最新データをそのまま配信できる
- 将来的にランキング以外の外部データにも横展開しやすい

## 当面の実装優先度

1. `market_info` で UI用JSON生成
2. 公開ストレージへの日次配置
3. `mini-tools` の外部JSON参照切り替え

## market_info 側の着手メモ

まず着手すべきなのは Phase 1。

開始タスク:

- `cleaned_final.csv` から `mini-tools` 用 JSON を作る CLI / スクリプトを追加
- 出力先を `output/final/ranking_ui/` に固定
- `run_naito_and_backup.ps1` とは分離して、まず単体で成功させる

この段階では、まだ公開ストレージ連携は入れなくてよい。  
先に JSON contract を安定させる方が安全。

## mini-tools 側の着手メモ

`market_info` 側の Phase 1 完了後に着手する。

開始タスク:

- 外部JSON URL を環境変数化する
- `data-loader.ts` の読み込み元を差し替えられるようにする
- fallback 方針を決める

運用メモ:

- 2026-03-28 時点では `STOCK_RANKING_DATA_BASE_URL=https://<public-base-url>` を推奨する
- 既存の配信先が data-root URL をそのまま公開している場合は `.../stock-ranking` を直接指定してよい

## 保留事項

- 公開ストレージの最終選定
- キャッシュTTLの最終値
- 障害時の fallback をどこまで持つか
- 旧ローカルJSON運用をどの時点で廃止するか
