# 2026-04-11 JSON 同梱データと fallback 方針整理

## 結論

- market tools の本番主経路は引き続き `MARKET_INFO_API_BASE_URL` とする
- repo 同梱 JSON fallback は当面残すが、役割は `開発` と `緊急退避` に限定する
- `stock-ranking` の日次 JSON は履歴アーカイブ置き場として repo を使わず、fallback 用に最小限だけ残す前提で運用する
- `public/data/jpx_listed_companies.json` は、サイズと更新頻度の観点から当面 repo 同梱維持とする
- テストは本番フル JSON を参照せず、小さい fixture を基本にする

## 背景

- `stock-ranking` の日次 JSON が repo 規模と差分ノイズの大半を占めている
- 一方で market tools の標準入口はすでに `MARKET_INFO_API_BASE_URL` に寄せる方針が決まっている
- JSON を一律に扱うのではなく、更新頻度、サイズ、fallback の必要性で扱いを分けた方が運用しやすい

## 決めたこと

### 1. `stock-ranking` 日次 JSON

- `mini-tools` の標準取得は `GET /ranking/manifest` と `GET /ranking/{date}` を使う
- repo 同梱 JSON は fallback 用であり、履歴保存の主置き場ではない
- 今後のデータ更新では、repo に置く日次 JSON は `manifest` と開発・緊急退避に必要な最小限の期間に絞る
- 大きい JSON 更新はコード変更 PR と分離する

### 2. `jpx_listed_companies.json`

- 当面は `public/data/jpx_listed_companies.json` を repo 同梱で維持する
- 理由は、`stock-ranking` 日次データほどサイズが大きくなく、更新頻度も高くないため
- ただし、将来的にサイズ増加や更新運用が重くなったら API 化を再検討する

### 3. テストデータ

- loader / parser テストは本番フル JSON ではなく、小さい fixture を使う
- フルデータ相当の fixture は、本当に必要なケースだけ限定して追加する
- まず `stock-ranking` の loader テストから小さい fixture ベースを明示する

### 4. docs / 調査運用

- repo 規模や LOC を見るときは、JSON を除いた数値も併記する
- fallback の役割は docs 上でも `開発・緊急退避` と明示する

## 理由

- 本番主経路を API に寄せる方針と、repo 容量の抑制を両立できる
- fallback をゼロにはしないので、ローカル開発や API 障害時の保険を維持できる
- `jpx_listed_companies.json` は現時点では運用コストより repo 同梱の単純さの利点が大きい
- テストが本番データに引っ張られなくなると、レビューと保守がしやすい

## 今回の影響範囲

- `stock-ranking` の test fixture 運用
- docs の fallback 説明
- 今後のデータ更新 PR の分け方

## 補足

- `stock-ranking` の既存同梱 JSON をどの時点で何日分まで prune するかは、データ更新 PR と切り分けて進める
- 今回は「削減方針の明文化」と「テストの本番 JSON 非依存化」を優先する
