# 2026-06-01 投資主体別売買動向の分析API優先表示

## 背景

- 投資主体別売買動向の raw table は情報量が多く、何を判断する画面か分かりにくかった。
- ユーザーの主な判断観点は「日本株を誰が買っているのかの割合」「大きい主体が買い越し/売り越しなのか」「前週から反転した主体はどれか」だった。
- `market_info` と `market-info-api` に investor-flow analysis JSON/API が追加された。

## 今回決めたこと

- mini-tools の `/tools/investor-flow` は raw payload に加えて analysis payload を取得する。
- サマリータブは analysis payload が取得できる場合、分析済みデータを主役にする。
- analysis payload が取得できない場合でも、raw payload があれば従来の表示に fallback する。
- raw payload が取得できない場合は、これまで通り選択週の取得失敗として扱う。

## 判断理由

- 買い構成比、差引ランキング、反転、継続は複数週比較やカテゴリ階層の扱いを含むため、UI 内で毎回計算するより `market_info` の分析 layer で生成した JSON を使う方が安定する。
- mini-tools 側は画面状態、表示整形、タブ切替に集中し、再利用可能な分析データの生成は upstream に寄せる。
- analysis API が未配置でも画面全体を止めないことで、raw data の確認導線を維持する。

## 影響範囲

- `app/tools/investor-flow/data-loader.ts`
- `app/tools/investor-flow/types.ts`
- `app/tools/investor-flow/ToolClient.tsx`
- `docs/specs/tools/investor-flow.md`
- `docs/uat/investor-flow.md`

## 残課題

- 表示デザインは実データで確認し、必要に応じて「サマリー」「構造」「詳細」の比重をさらに調整する。
- 反転や継続の表現は、利用者が見たい投資判断に合わせて文言や並び順を改善する余地がある。

## 関連

- Issue:
- PR:
- 参照 docs:
  - [投資主体別売買動向 仕様](../specs/tools/investor-flow.md)
  - [投資主体別売買動向 UAT](../uat/investor-flow.md)
  - [Market Tools データ取得経路一覧](../specs/cross-cutting/market-tools-data-fetch-paths.md)
