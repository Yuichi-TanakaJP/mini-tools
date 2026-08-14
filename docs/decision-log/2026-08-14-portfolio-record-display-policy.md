# 2026-08-14 ポートフォリオの「表示・記録・方針」構成

> **更新:** この判断は、実データ表示の初期基盤としては有効だが、製品全体の情報設計・運用・
> 完成条件としては不十分だった。2026-08-15以降は
> [ChatGPT起点の意思決定ワークスペース](./2026-08-15-portfolio-chat-first-operating-model.md) と
> [実装計画](../plans/portfolio-decision-workspace-plan.md) を優先する。

## 背景

stock-notes側に、証券会社CSVを口座別ポジションと不変スナップショットとして保存する基盤を追加した。
一方、mini-toolsの既存 `/premium/portfolio` はリポジトリ内のサンプルデータを表示しており、実際の保有記録・全体配分・新規資金の方針を同じ画面で扱えなかった。

## 今回決めたこと

- `/premium/portfolio` を「表示」「記録」「方針」の3タブ構成にする
- 表示は最新readyスナップショットを商品単位に集約する
- 記録は口座別ポジションと取込履歴をそのまま確認できるようにする
- 方針は最新portfolio reviewの全体メモと銘柄別review itemを優先順位順に表示する
- Supabaseのログインユーザーをデータの境界とし、mini-toolsはRLS付きの直接読み取りだけを行う
- DBにデータがない場合はサンプルへfallbackせず、未取込状態を明示する

## 判断理由

買値との比較だけでは新規資金の投入先を判断しにくいため、過去の事実（記録）と現在の集計（表示）と将来の判断（方針）を分離して並べる必要がある。
保有を口座単位で残すことで、NISA・課税口座の重複保有を失わずに済む。商品単位の集約は全体配分を読みやすくするための表示上の処理であり、元の記録を上書きしない。

stock-notes APIのBearerトークンをブラウザへ渡さず、既存のmini-tools SupabaseセッションとRLSを使う。これまでのstock-notesダッシュボードと同じ認証境界を利用できるためである。

## 影響範囲

- `/premium/portfolio` のサンプル表示を実データ表示へ置き換えた
- 取込・分析データの正本はstock-notes/Supabaseにあり、mini-toolsは読み取り専用である
- Premium Cookie認証とSupabase Authの2つが必要になる

## 残課題

- portfolio context API
- ChatGPTでの取得・相談・保存・確定のE2E
- 意思決定中心の画面構成
- portfolio actionとreview差分
- 銘柄ダッシュボードとの双方向連携
- CSV取込後の実データを使った本番UAT

## 関連

- Issue: stock-notes#16 / mini-tools portfolio dashboard
- PR: 実装PRに追記
- 参照 docs: [ポートフォリオ仕様](../specs/tools/portfolio.md)、[UAT](../uat/portfolio.md)
