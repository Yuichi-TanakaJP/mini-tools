# yutai-memo #74 銘柄マスタ JSON 更新運用メモ

## 対象 Issue

- #74 `ops(yutai-memo): 銘柄マスタ JSON の更新運用を整理する`
- 関連: `market_info` 側の `output/final/reference/jpx_listed_companies/latest.json`

## 現状

- `yutai-memo` は [`public/data/jpx_listed_companies.json`](../../public/data/jpx_listed_companies.json) を参照して候補表示している。
- `market_info` 側では `latest.csv` / `latest.json` が生成される。
- `mini-tools` 側では `ETF・ETN` 除外などの用途別フィルタだけを担当し、マスタ自体の生成は担当しない。

## 運用方針

### 1. 更新方式

- 当面は **手動更新** とする。
- `market_info` の成果物 `latest.json` を `mini-tools/public/data/jpx_listed_companies.json` に反映する。
- 自動同期はこの時点では入れない。

理由:

- いまの用途では更新頻度が低く、手動でも十分追える。
- `mini-tools` 側に同期ロジックや依存を増やさずに済む。
- データ生成責務を `market_info` に寄せたまま、利用側は静的ファイル参照だけで運用できる。

### 2. 更新頻度

- 基本は **月1回**。
- 追加で、銘柄マスタ更新が必要だと判断したタイミングで随時反映してよい。

### 3. 責務分担

- `market_info`
  - JPX 銘柄マスタの取得
  - `latest.csv` / `latest.json` の生成
- `mini-tools`
  - `public/data/jpx_listed_companies.json` の保持
  - `yutai-memo` での利用
  - `ETF・ETN` など用途別フィルタ

## 手順

1. `market_info` 側で `output/final/reference/jpx_listed_companies/latest.json` が最新になっていることを確認する。
2. その `latest.json` を `mini-tools/public/data/jpx_listed_companies.json` へコピーする。
3. `mini-tools` で以下を確認する。
   - `npm run lint`
   - `npm run build`
   - `yutai-memo` の銘柄候補検索が動くこと
4. 反映内容を PR に含めてマージする。

## 更新漏れの見方

- 月次で `market_info` 更新後に、`mini-tools` 側のマスタ反映が必要か確認する。
- JSON の `as_of_date` を差分確認して、反映漏れを見つけやすくする。
- 大きなコード変更を伴わない更新は、データ更新 PR として単独で出してよい。

## 今回見送ること

- `market_info` からの自動同期
- GitHub Actions での定期更新
- `mini-tools` 側での更新日表示 UI

## 今後

- 手動更新の負担が高くなったら、自動同期を別Issueで検討する。
- 自動化する場合も、生成責務は `market_info`、配布/取り込み責務は `mini-tools` のままにする。
