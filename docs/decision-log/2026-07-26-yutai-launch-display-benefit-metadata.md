# 2026-07-26 優待公式条件の割引率・長期保有メタデータ表示

## 背景

- market_info 側で優待JSONの正規化を進める中で、ANA などの割引率情報や長期保有条件を mini-tools でも落とさず扱う必要が出た
- 一方で、割引率は利用金額・利用条件に依存するため、簡易優待効率の円換算に自動算入すると過大評価になりやすい

## 今回決めたこと

- launch-display の優待 item は任意フィールドとして `discount_rate_pct` と `discount_terms` を受け取れるようにする
- 割引率メタデータは詳細パネルの公式条件に表示するが、簡易優待効率の優待価値には自動算入しない
- 長期保有条件は既存の tier `required_holding_months` を使って表示する

## 判断理由

- parser が先に受け口を持つことで、market_info 側の公開payload拡張を段階的に進められる
- 割引率を利回り計算に使うには、利用額・対象商品・併用条件などユーザー別の前提が必要になる
- 既存の `required_holding_months` はtier単位の条件としてすでに表示でき、現時点では新しい保存キーを増やさずに長期条件を確認できる

## 影響範囲

- `/tools/yutai-dashboard` の公式条件詳細表示
- `/api/yutai/launch-display` のpayload parser
- 簡易優待効率の計算式には影響しない

## 残課題

- `has_long_term_benefit` / `requires_long_term_holding` のような銘柄単位の集計表示をmini-toolsに出すかは後続で判断する
- `discount_terms` を複数条件で見やすく表示するUIは、実データ公開後の見え方を確認して必要なら調整する

## 関連

- Issue:
- PR:
- 参照 docs: [優待ダッシュボード 仕様](../specs/tools/yutai-dashboard.md)