# 2026-10-31 Workstream正本の案内をCoreへ統一

## 背景

READMEに旧mini-tools案件表をcanonicalとする説明が残っていた。10/25のCore切替・旧938行の削除後には当てはまらない。

## 決定と本番状態

現行案件は既存Workspace Core統合readerから参照し、同名案件を新設しない。ユーザーの追加指示で空構造の保持案を廃止準備へ変更し、10/31に旧5表・handoff・専用停止処理の物理廃止を本番適用した。Core/sourceの台帳もretired/reference等へ更新した。

## 根拠と影響

原文938行はCoreに保存され、R2から実回収して全文hash一致。直前の変更対象14件も独立保全・再読戻しを行った。対象外source191表は不変、現役Core47案件を保持。別producerの並行監視更新は保持した。

MiniToolsの変更は案内文書のみ。MiniTools runtime・認証・定期実行を変更せず、日時付きの過去devlog・SQLは履歴として残す。31日の定期全量backup失敗を解決済みとは扱わない。PRmerge・appdeploy・本人ログインUI UATは別で、本件のDB適用完了と混同しない。

## 関連

- [Core operation・本番受入・復旧](https://github.com/Yuichi-TanakaJP/workspace-core/pull/136)
- [source migrationと本番受入](https://github.com/Yuichi-TanakaJP/stock-notes/pull/463)
- [修正したREADME](../../infra/workspace-core/README.md)
