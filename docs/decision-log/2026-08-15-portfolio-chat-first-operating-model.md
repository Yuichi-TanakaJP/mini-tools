# 2026-08-15 ポートフォリオはChatGPT起点の意思決定ワークスペースとする

## 背景

`/premium/portfolio` に実データの保有・損益・履歴・保存済みreviewを表示する画面を追加したが、
元の目的である「ChatGPTでポートフォリオ全体を相談し、方針を保存し、継続運用する」経路が
実装計画と完成条件に固定されていなかった。

その結果、現行画面は保有表と保存済みデータの閲覧に留まり、ChatGPTが全体文脈を取得するAPI、
相談結果の保存運用、銘柄ダッシュボード連携がない状態でも完成したように扱われた。

## 決めたこと

- ポートフォリオ機能の主入力はMiniToolsの手入力フォームではなく、ChatGPTとの会話とする
- ChatGPTが最新snapshot、個別分析、thesis、action、前回reviewをAPIで一括取得する
- ChatGPTが提示した全体方針、銘柄別判断、新規資金配分を確認後に保存する
- MiniToolsは保存結果を「次に何をするか」の順序で表示する意思決定ワークスペースとする
- 個別銘柄ダッシュボードとportfolio role・stance・priority・条件を双方向連携する
- 現行の読み取り画面はPhase 0の基盤であり、プラットフォーム完成とは扱わない

## 理由

ユーザーが求める価値は、保有データの閲覧そのものではなく、個別分析を全体配分へ接続し、
新しく投じる資金の優先順位と次の行動を決めることにある。MiniToolsへ同じ内容を再入力すると、
ChatGPTとの相談結果が分断され、二重管理になる。

## 影響範囲

- `/premium/portfolio` の情報設計
- stock-notesのportfolio context/review/action API
- カスタムGPTのActionsとInstructions
- `/tools/stock-notes` の銘柄詳細
- portfolio UATと完成条件

## 関連

- [実装計画](../plans/portfolio-decision-workspace-plan.md)
- [現行仕様](../specs/tools/portfolio.md)
- [2026-08-14の判断](./2026-08-14-portfolio-record-display-policy.md)
