# 株価ランキング Phase 1 CLI 仕様メモ

Last-Updated: 2026-03-26 JST

## 目的

`market_info` 側で、`cleaned_final.csv` から `mini-tools` 向けの UI 用 JSON を安定生成する。  
この段階では公開ストレージ連携や `mini-tools` 側の外部URL切り替えはまだ行わない。

## 対象フェーズ

- [`株価ランキング 外部データ公開 移行計画`](./stock-ranking-external-data-plan.md)
- Phase 1: `market_info` で UI用JSONを安定生成する

## 想定する入出力

### 入力

- `output/final/ranking/naito_9tables_YYYYMMDD_cleaned_final.csv`

### 出力

- `output/final/ranking/ui/manifest.json`
- `output/final/ranking/ui/YYYYMMDD.json`

## CLI の役割

`market_info` 側で用意する CLI は、次を担当する。

- 指定CSVを読み込む
- `mini-tools` の現行 `stock-ranking` 型に合う JSON を生成する
- 日次JSONを書き出す
- `manifest.json` を更新する

この CLI はまず単体で安定化させ、`naito_daily_run.py` への組み込みは後段で行う。

## JSON contract

### manifest.json

```json
{
  "dates": ["2026-03-25", "2026-03-24"],
  "latest": "2026-03-25"
}
```

ルール:

- `dates` は `YYYY-MM-DD` 文字列配列
- 新しい日付順で並べる
- `latest` は `dates[0]`

### YYYYMMDD.json

```json
{
  "date": "2026-03-25",
  "records": [
    {
      "market": "プライム",
      "ranking": "値上がり率",
      "rank": 1,
      "name": "xxx",
      "code": "1234",
      "marketLabel": "東証P",
      "industry": "情報・通信業",
      "price": 1234,
      "time": "15:30",
      "change": 80,
      "changeRate": 6.93,
      "volume": 123.4,
      "value": 4567.8
    }
  ]
}
```

ルール:

- `date` は `YYYY-MM-DD`
- `records` は配列
- 各 record は `mini-tools` の現行型に合わせる

参照:

- [`app/tools/stock-ranking/types.ts`](../app/tools/stock-ranking/types.ts)

## 想定 CLI 仕様

CLI 名は仮でよい。たとえば:

```powershell
python src/cli/build_stock_ranking_ui_json.py --in output/final/ranking/naito_9tables_20260325_cleaned_final.csv
```

最低限ほしい引数:

- `--in`
  - 入力CSVパス
- `--out-dir`
  - 省略時は `output/final/ranking/ui`

任意であるとよい引数:

- `--date`
  - CSV から取れない場合の補助
- `--manifest-only`
  - 必須ではないので後回し可

## 実装ルール

- 同じ日付で再実行しても壊れないこと
- 既存 `manifest.json` があれば読み込んで追記更新すること
- 同一日付は重複追加しないこと
- JSON は UTF-8 で保存すること
- 出力ディレクトリがなければ作成すること

## 完了条件

- 単体 CLI 実行で `manifest.json` と当日JSONが生成される
- 同日再実行で `manifest` が重複しない
- JSON shape が `mini-tools` 側の現行型と一致する

## 今はやらないこと

- 公開ストレージアップロード
- `naito_daily_run.py` への組み込み
- `mini-tools` 側の `data-loader` 切り替え
- キャッシュや CDN 設計

## market_info 側への伝達用メモ

`market_info` 側では、まず Phase 1 として UI 向け JSON 生成だけを切り出して安定化してほしいです。入力は `output/final/ranking/naito_9tables_YYYYMMDD_cleaned_final.csv`、出力は `output/final/ranking/ui/manifest.json` と `output/final/ranking/ui/YYYYMMDD.json`。`naito_daily_run.py` とは分離した単体 CLI で進め、JSON shape は `mini-tools` 現行 `stock-ranking` 型に合わせる前提です。ここが固まったら、次に `mini-tools` 側の外部URL化と `data-loader` 切り替えに進みます。
