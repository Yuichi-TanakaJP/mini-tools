# AGENTS.md

このリポジトリでの Git 運用手順を固定する。  
目的は「コミット、push、レビュー確認、マージ、pull/prune、branch delete」を毎回同じ手順で正確に実行すること。

## 0. 基本ルール

- `main` へ直接コミットしない。必ず feature ブランチで作業する。
- 1 PR = 1 目的。無関係な差分は混ぜない。
- コード変更 PR と生成データ更新 PR は分ける。大きい JSON / CSV 差分を実装差分と同じ PR に混ぜない。
- 変更前後で `git status --short` を確認する。
- スクショ確認やレビュー後に追加修正した場合、PRマージ前に `git status --short` を確認し、未コミット差分が残っていないことを必ず確認する。
- Issue はタイトルだけで「どの tool の、何の話か」が分かるように書く（例: `UI(yutai-memo): ...`, `feat(yutai-expiry): ...`, `TOP-UI: ...`）。
- `gh issue create` / `gh issue comment` / `gh pr create` / `gh pr comment` で複数行本文を渡すときは、CLI の `--body "..."` に直接改行を書かず、本文ファイル（例: 一時 `.md`）を作って `--body-file` で渡す。
- `next-env.d.ts` などの環境起因ファイルは、意図がない限りコミットしない。
- コミット前に最低 `npm run lint` を実行する。
- 会話・レビュー・実装中に仕様や運用判断が固まった場合は、コード変更だけで終わらせず docs に判断を残す。
- docs の残し方は `docs/docs-writing-workflow.md` を参照し、少なくとも `docs/decision-log/` への記録要否を毎回確認する。

## Task Request Format

- 新しい依頼は、可能な限り先頭に次のヘッダー形式を付ける。

```text
[repo:<repo_name>] [type:<report|fix|review|investigation|docs>] [target:<artifact_or_scope>] [action:<specific_work>]
```

- 例:
  - `[repo:mini-tools] [type:fix] [target:market calendar screen] [action:resolve loading flicker]`
  - `[repo:mini-tools] [type:review] [target:PR #123] [action:code review]`
- 依頼文がこの形式で始まっていない場合でも、作業前に内容をこの構造へ正規化して解釈する。
- 初回応答では、正規化したヘッダーを先頭に短く明示してから作業を進める。
- 日本語の簡略形式でもよいが、会話一覧で判別しやすくするため、`repo` / `type` / `target` / `action` が分かる形を優先する。

## 1. 作業開始

```powershell
git fetch --prune
git switch main
git merge --ff-only origin/main
git switch -c feature/<topic>
git status --short
```

## 2. 実装と確認

```powershell
# 実装
# 必要な確認
npm run lint
git status --short
```

## 3. コミット

```powershell
# コミット前に現在ブランチを必ず確認する
git branch --show-current
# `main` と表示されたらコミット禁止。feature ブランチへ切り直してからやり直す。
# 必要ファイルだけ add する（git add . は原則使わない）
git add <file1> <file2>
git commit -m "feat(scope): summary"
git status --short
```

## 4. push

```powershell
git push -u origin feature/<topic>
```

## 5. PR 作成

```powershell
gh pr create --base main --head feature/<topic> --title "<title>" --body "<body>"
```

PR 本文に必ず記載する項目:

- 概要
- 変更内容
- 確認項目（lint/test/動作確認）
- 関連 Issue（例: `Closes #xx`）

## 6. レビュー確認と対応

```powershell
# コード変更を含むPRは、PR作成後〜マージ前に Codex CLI review を1回実施する
# 通常差分は review-low、大きめ差分は review-medium を使う
# ドキュメント変更のみのPRは、必要に応じてスキップ可
codex --profile review-low review --base main
# 大きめ差分は必要に応じて:
codex --profile review-medium review --base main
gh pr view <PR番号> --comments
gh api repos/Yuichi-TanakaJP/mini-tools/pulls/<PR番号>/reviews
gh api repos/Yuichi-TanakaJP/mini-tools/pulls/<PR番号>/comments
```

- Codex review は、コード変更を含むPRでは原則1回実施する。
- 通常の差分レビューは `review-low` を使い、規模が大きいPRや慎重に見たい差分では `review-medium` を使う。
- ドキュメント変更のみのPRは、内容が明確で低リスクならスキップしてよい。
- P1/P0 指摘は優先対応する。
- 修正後は同じブランチで再コミットし push する。

```powershell
git add <files>
git commit -m "fix(scope): address review feedback"
git push
```

## 7. マージ

```powershell
git status --short
gh pr merge <PR番号> --merge --delete-branch=false
```

- 積み上げ PR は必ず順番を守る（下位PR -> 上位PR）。
- マージ後に状態確認する。
- マージ後は、必ず「8. ローカル同期」→「9. ブランチ削除」まで続けて実施する。

```powershell
gh pr view <PR番号> --json number,state,mergedAt,url
```

## 8. ローカル同期（pull/prune）

```powershell
git fetch --prune
git switch main
git merge --ff-only origin/main
```

- マージ後に branch 整理を抜け漏れしやすい場合は、`pwsh -File .\scripts\git-branch-cleanup.ps1` を実行して merged local branch の一覧を確認する。
- 実際に削除するときは `pwsh -File .\scripts\git-branch-cleanup.ps1 -DeleteMerged` を使う。

## 9. ブランチ削除（local / remote）

1. まず `main` にマージ済みか確認する。
```powershell
git branch --merged main
```

2. マージ済みのみローカル削除する。
```powershell
git branch -d feature/<topic>
```

3. 不要なリモートブランチも削除する場合。
```powershell
git push origin --delete feature/<topic>
```

- 日常運用では、まず `scripts/git-branch-cleanup.ps1` のプレビューで対象 branch を確認してから削除する。

## 10. トラブル時

- `index.lock` が残っている場合:
  - 別 Git プロセスが無いことを確認して `\.git\index.lock` を削除。
- 無関係差分がある場合:
  - そのファイルは add しない。
  - 必要なら `git stash push -- <file>` で一時退避して作業する。
