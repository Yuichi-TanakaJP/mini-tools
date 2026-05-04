# docs 直下ファイルの分類方針

## 結論

`docs/` 直下には、新しい恒久ドキュメントを原則置かない。
直下に残すのは、docs 全体の入口と運用中核に限る。

- `docs/index.md`
- `docs/product-spec.md`
- `docs/docs-writing-workflow.md`

既存の直下ファイルは、内容を確認したうえで次の分類へ移動する。

- 横断仕様: `docs/specs/cross-cutting/`
- 計画・検証・移行プラン: `docs/plans/`
- 未着手候補・PR 候補: `docs/backlog/`

## 背景

仕様書整備により `docs/specs/` が追加された一方で、`docs/` 直下には横断仕様、計画、バックログ、運用ルールが混在していた。
この状態のままだと、今後 docs が増えたときに「どこに置くべきか」が再び不透明になる。

## 決めたこと

- `system-architecture-overview`、`market-tools-data-fetch-paths`、`react-server-client`、`share-url`、`ui-color-palette` は横断仕様として `docs/specs/cross-cutting/` に置く
- `stock-ranking-phase1-cli-spec` は CLI 入出力 contract なので、計画ではなく横断仕様へ置き、`stock-ranking-ui-json-cli-spec.md` にリネームする
- 月100円関連と stock-ranking 外部データ移行計画は `docs/plans/` に置く
- yutai-expiry の将来候補は `docs/backlog/` に置く
- 各分類に `index.md` を追加し、`docs/index.md` から辿れるようにする
- `docs/docs-writing-workflow.md` に、直下へ新規恒久 docs を置かないルールを明記する

## 理由

- `docs/` 直下を入口に限定すると、全体構造を把握しやすい
- 横断仕様、計画、未確定候補を分けることで、現在仕様と将来案を混同しにくい
- index を分類ごとに置くことで、新規 docs の孤立を防げる
- ファイル名を内容に合わせてリネームすると、一覧だけで用途を判断しやすい

## 影響範囲

- 既存 docs のパスが変わるため、関連リンクを新しい配置に更新する
- 今後の docs 追加時は、まず既存分類の index に載せる
- 判断理由がある再分類やリネームは decision-log に残す
