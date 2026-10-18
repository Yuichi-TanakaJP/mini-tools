# Conditional operation notes

Read only the relevant section for browser verification, review execution, or branch cleanup. Repository-relative paths are used below.

## Branch cleanup (read when cleanup is requested/approved)

- Preserve the stacked-PR order (lower PR before upper PR); merge commits remain the repository's documented merge strategy, with remote branch deletion separate.
- Confirm the PR merged, fetch/prune, and fast-forward local main without overwriting unrelated work. Use scripts/git-branch-cleanup.ps1 as the local cleanup entrypoint, not repeated manual cleanup plus the same script.
- Preview merged local branches first. Only after explicit deletion approval use -DeleteMerged. The script attempts git branch -d; unresolved rebase/squash cases require manual integration verification, never automatic force deletion. Remote deletion is separate and requires approval.
- The script includes fetch/merge/branch mutations and needs scoped execution access. Do not run it twice for the same synchronization. Check active Git processes before any approved index.lock removal; do not stash unrelated work without a need.

## 11. トークン効率と品質維持

- 検証項目を省くのではなく、作業中と PR 前で段階化する。
  - 作業中: 変更箇所の lint、関連テスト、`git diff --check` を優先する。
  - PR 前: ルートAGENTS.mdの「Behavior validation」にあるTier定義に従い、Tier 2以上で影響範囲テストと必要なbuild、Tier 3で関連フルスイートを実施する。
  - Tier 0のドキュメントのみのPR: `git diff --check` と必要なリンク・構文確認を基本とし、コード向けlint・test・buildは原則省略する。
- 検索は対象ディレクトリ・拡張子・語句を絞る。大量ヒット時は全量を出さず、件数確認後に必要な範囲だけ読む。
- ビルドやテストの成功ログは要点だけ確認し、失敗時のみ該当エラー周辺を追加取得する。
- GitHub の PR コメント・reviews・inline comments・checks は、PR 作成後とマージ直前を基本にまとめて確認し、同じ情報を短時間に重複取得しない。
- Cursor 拡張環境では Codex の in-app browser (`iab`) を利用できないため、ブラウザー接続診断や実画面操作を自動実行しない。
  - ユーザーが実画面確認を明示した場合、または利用可能なブラウザーが事前に確認できている場合だけ実行する。
  - `Browser is not available: iab` または利用可能ブラウザー `[]` を確認したら、その作業中は再診断しない。
  - ブラウザー確認を行えない場合は、lint・テスト・build・Preview CI を確認し、実画面未確認であることを報告する。
- `codex review` は 1 PR につき原則 1 プロセスだけ起動する。
  - 最初からバックグラウンド実行し、PID と出力先を保持して同じプロセスを追跡する。
  - 呼び出し側のタイムアウトだけを理由に再実行しない。既存プロセスの終了状態と出力を確認する。
  - 既存プロセスの終了を確認するまで、同じ差分への review を重複起動しない。
  - review 自体が失敗した場合は原因を確認し、無条件に再実行しない。
- 小さな修正のたびに lint・全テスト・build を一式で繰り返さない。作業中は関連確認に絞り、commit / PR 前の最終ゲートで全体確認する。
