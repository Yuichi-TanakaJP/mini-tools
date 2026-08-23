# ポートフォリオreviewの現行表示と履歴表示を分離する

## 決定

MiniToolsでは、保存済みreviewを「現行判断」と「履歴」に分けて表示する。

- `draft` / `finalized`: 現行reviewの候補として表示する
- `superseded`: 現行判断から除外し、履歴にだけ表示する
- `superseded`は、未確定のreviewを新しい方針・snapshot・reviewへ置き換えた履歴を意味する

旧draftを履歴化するためだけに`finalized`へ変更すると、未確定の判断を正式確定したように見せるためである。stock-notes側で`superseded`にしたreviewは削除せず、review IDから履歴として参照できる状態を保つ。

## 画面の責務

MiniToolsは読み取り専用の意思決定ワークスペースであり、reviewの状態変更は行わない。ChatGPT/APIで保存された状態を次のように表示する。

- 「方針」: 現在操作できるreview、active policy、最新reflection
- 「履歴」: `superseded`を含むreview履歴とsnapshot取込履歴
- 現行reviewがない場合: 置換済み履歴を示し、ChatGPTで新しいreviewを作成する運用を案内

## データと根拠

review履歴はSupabaseの`stock_notes_portfolio_reviews`から、portfolio単位で最大20件を基準日降順で取得する。MiniToolsは`superseded`を派生生成せず、stock-notesの保存済みstatusをそのまま表示する。現行reviewの明細・recommendationは`superseded`を除いたreviewに対してだけ取得する。

## 未完了の後続

この変更はUI-3の初回範囲であり、前回reviewとの差分、銘柄ダッシュボードとの双方向リンク、外部口座・iDeCo・暗号資産等の正式資産統合は別PRで実装する。外部資産はポートフォリオ全体の中核データであり、優先度を下げるのではなく、二重計上を防ぐ最小データモデル/APIを先に確定してから登録・集計へ進む。
