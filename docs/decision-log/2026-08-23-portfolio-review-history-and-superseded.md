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

## 2026-08-23 追補 — 現行reviewの優先順位と置換理由

外部監査で、基準日が新しい過去の`finalized` reviewが存在すると、単純な`as_of`順では現行の`draft`が隠れる可能性を確認した。現行reviewは`draft`を優先し、`draft`がない場合だけ最新の`finalized`を表示する。

また、履歴の監査性を保つため、`supersede_reason`を取得して`superseded` reviewのカードに表示する。理由が未設定のlegacy行でも履歴自体は表示し、理由欄だけを省略する。

## データと根拠

review履歴はSupabaseの`stock_notes_portfolio_reviews`から、portfolio単位で最大20件を基準日降順で取得する。現行reviewは`draft`を優先し、存在しない場合だけ`finalized`を基準日・更新日時順で1件取得する。MiniToolsは`superseded`を派生生成せず、stock-notesの保存済みstatusと`supersede_reason`をそのまま表示する。現行reviewの明細・recommendationは`superseded`を除いたreviewに対してだけ取得する。

## 未完了の後続

この変更はUI-3の初回範囲であり、前回reviewとの差分、銘柄ダッシュボードとの双方向リンク、外部口座・iDeCo・暗号資産等の正式資産統合は別PRで実装する。外部資産はポートフォリオ全体の中核データであり、優先度を下げるのではなく、二重計上を防ぐ最小データモデル/APIを先に確定してから登録・集計へ進む。
