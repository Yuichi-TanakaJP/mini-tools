# ポートフォリオ意思決定画面の初回実装

## 結論

`/premium/portfolio` に「意思決定」タブを追加し、ChatGPTで保存した review、金額なしの recommendation、portfolio action を読み取り専用で表示する。

## 背景

従来の画面は保有明細とreviewの表示が中心で、ChatGPTで整理した「次に調べるテーマ」「補強の論点」「次の確認Action」がMiniTools上で見えなかった。主入力をMiniToolsのフォームへ移すことは、stock-notesのポートフォリオ計画と異なるため採用しない。

## 決めたこと

- recommendation/actionはSupabaseの既存テーブルをRLS付きで読み取る
- MiniToolsから保存・更新・完了操作は行わない
- 金額未指定のrecommendationは、仮の金額や比率を生成せず「金額を仮定しない」と表示する
- 既存の保有状況、記録、方針、DB確認表示は残し、初期タブだけを意思決定へ変更する
- snapshotの基準日がreviewより新しい場合は「要再レビュー」と表示する

## 影響範囲

対象はMiniToolsの`/premium/portfolio`だけ。stock-notesのDB/API、既存の銘柄分析ダッシュボード、Custom GPTの設定は変更しない。decision-context APIとの共通化、銘柄詳細への双方向リンク、MiniToolsからのAction更新は後続PRで扱う。

## 関連

- [ポートフォリオ意思決定ワークスペース計画](../plans/portfolio-decision-workspace-plan.md)
- [ポートフォリオ仕様](../specs/tools/portfolio.md)
- [ポートフォリオUAT](../uat/portfolio.md)
