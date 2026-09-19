# 2026-09-07 ポートフォリオ構成分析とExposureの分離

## 背景

- `/premium/portfolio` では総資産とデータ管理scopeの内訳は確認できるが、資産・口座・企業分類の構成を切り替えて確認できなかった。
- 最新の正式snapshotには複数口座・現金・年金・海外資産等が統合されており、`official` / `external_reference` だけでは投資上の構成を説明できない。
- 関連 Issue は #586。

## 今回決めたこと

- 最新readyの公式snapshotを対象に、評価額ベースのAllocation分析を追加する。
- 資産クラス、口座種別、業種、景気感応度、インカム特性、時価総額帯、銘柄別を同じ集計基盤で扱う。
- 全資産と個別株のみを切り替え、未分類は分母に残す。
- 分類が少ない場合はドーナツ、多い場合は横棒へ自動的に切り替える。
- role、theme、industry map、corporate groupは重複可能なExposureとして、合計100%のAllocationから分離する。

## 判断理由

- データ取得scopeと投資分析軸を混ぜると、どの資産を持っているかを把握しづらい。
- 投資信託・現金等を株式分類から消すと、全資産に対する割合を誤認するため、全資産では未分類を明示する必要がある。
- 個別株だけを見たい場合は分母自体を明示的に切り替える方が、未分類を隠すより意味が明確である。
- V1は既存のSupabase本人データ読み取り経路を拡張し、DBスキーマや保存経路を増やさない。

## 影響範囲

- MiniToolsのポートフォリオ保有一覧、データローダー、型、集計関数、テスト、UAT。
- 既存scope内訳、商品別構成、外部資産明細は維持する。
- classification取得失敗は分析表示内に隔離し、総額や保有一覧を壊さない。

## 残課題

- stock-notesの共有decision-contextをMiniToolsの正式な共通読み取り契約として利用すること。
- 投資信託look-through、地域、引出制約、policy目標との比較。
- role/theme等の重複Exposureの拡張。

## 関連

- Issue: #586
- 参照 docs: `docs/specs/tools/portfolio.md`, `docs/plans/portfolio-decision-workspace-plan.md`
