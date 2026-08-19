# 2026-08-18 ポートフォリオDB確認ビュー

## 背景

MiniToolsの `/premium/portfolio` は、保存済みの保有状況とreviewを利用する画面だが、DBに保存された結果を簡単に点検するための情報が散在していた。今回の目的は、意思決定画面を先回りして完成扱いにすることではなく、ChatGPTで保存した結果がMiniToolsへ届いているかを確認できるようにすることである。

## 決めたこと

- 既存の `/premium/portfolio` に「DB確認」タブを追加する
- MiniToolsの取得クエリが返したportfolio、snapshot、position、review、review itemの生行数と主要ID・基準日を表示する
- 最新ポジションの読み取り結果も同じ画面で確認できるようにする
- DB確認タブは読み取り専用とし、保存・更新・削除操作を置かない
- 未取込、認証必須、ready snapshotなしを、正常な空データと区別する

## 影響範囲

- MiniToolsのポートフォリオ画面のみを変更する
- Supabaseのスキーマ、stock-notes API、Custom GPT、銘柄分析ダッシュボードは変更しない
- 既存の「表示」「記録」「方針」タブは残す

## 関連

- 仕様: [ポートフォリオ仕様](../specs/tools/portfolio.md)
- UAT: [ポートフォリオ UAT](../uat/portfolio.md)
- 実装計画: [ポートフォリオ意思決定ワークスペース実装計画](../plans/portfolio-decision-workspace-plan.md)
