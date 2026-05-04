# mini-tools 仕様書構成の初期方針

## 結論

`mini-tools` の仕様は、巨大な単一ドキュメントではなく、次の 3 層で管理する。

1. `docs/product-spec.md`: プロダクト全体の現在仕様
2. `docs/specs/tools/*.md`: ツール別の現在仕様
3. `docs/decision-log/*.md`: 仕様判断や運用判断の理由

UAT は既存どおり `docs/uat/` に置き、仕様書とは役割を分ける。

## 背景

`mini-tools` はアジャイル的に機能追加されており、仕様がコード、UAT、decision-log に分散している。
一方で、既存 docs にはすでに次の資産がある。

- `docs/specs/cross-cutting/system-architecture-overview.md`: 全体構成
- `docs/uat/`: ツール別の確認観点
- `docs/decision-log/`: 仕様判断の履歴
- `docs/docs-writing-workflow.md`: docs 更新の運用ルール

そのため、既存 docs を置き換えるのではなく、「現在仕様の正本」を追加する。

## 決めたこと

- 全体仕様の入口として `docs/product-spec.md` を作る
- ツール別仕様は `docs/specs/tools/` に置く
- 新規ツール別仕様は `docs/specs/tools/_template.md` を使う
- 代表例として `yutai-memo` と `earnings-calendar` の仕様から整備する
- `docs/uat/` はリリース前の確認手順として維持する
- 仕様変更 PR では、対象ツールの仕様書更新要否を確認する
- docs 間リンクの向きを `docs/docs-writing-workflow.md` に明記し、ファイル乱立を防ぐ

## 理由

- 単一の大きな仕様書は更新負荷が高く、アジャイルな拡張と相性が悪い
- ツールごとに保存方式、API 依存、fallback が異なるため、ツール別に分けるほうが差分を追いやすい
- UAT と仕様書を分けることで、「どう動くべきか」と「何を確認するか」を混同しにくい
- decision-log を残すことで、現在仕様だけでなく判断理由も後から追える
- index と相互リンクのルールを固定すると、新規 docs が孤立しにくい

## 影響範囲

- docs の構成に `docs/specs/` が追加される
- 今後の新規ツール追加・仕様変更時は、ツール別仕様の更新要否を確認する
- 既存 UAT の内容は削除せず、仕様書からリンクする
- 新規 docs 追加時は、作成前に既存 docs への追記で足りるか確認する

## 今後の進め方

1. 代表 2 ツールの仕様を叩き台にする
2. market tools、LocalStorage 系ツール、premium preview の順に横展開する
3. 仕様と UAT のズレが見つかったら、仕様書を現在仕様として更新し、UAT は確認手順として補正する
