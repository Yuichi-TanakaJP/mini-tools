# 2026-10-31 Workstream正本の古い案内を訂正

## 背景

infra/workspace-core READMEは9月の旧mini-tools案件表をcanonicalとする説明を現行案内に残していた。10/25のCore切替と旧938行の削除後には当てはまらない。

## 今回決めたこと

現行案内を既存Workspace Core統合readerへ訂正する。同名案件を新設しない。旧5表・handoff・停止guardは空の構造として保持し、物理削除を今回の作業には含めない。

## 判断理由

旧938行はCoreに保存され、R2の保存原文2表を隔離DBへ実復元して5群の件数・全文hashが一致した。追加の行DELETEは不要。物理削除には現行台帳の廃止契約変更が必要であり、データ整理の目的に対して今回は行わない。既知の台帳表記差異を理由に確認を繰り返さない。

## 影響範囲

READMEの現行案内のみ。日時付きの9月devlog・過去SQLは歴史記録として残す。runtime、認証、権限、本番DB、定期実行は変更しない。

## 残課題

今回の調査は終了。台帳のlifecycle/authority契約の改修や空構造の物理廃止を将来行う場合は対象限定の別変更とする。これはSchema Parity全体の完了ではない。

## 関連

- [Workspace Coreの調査・復元証拠と判断](https://github.com/Yuichi-TanakaJP/workspace-core/pull/136)
- [修正したREADME](../../infra/workspace-core/README.md)
