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
# ドキュメント変更のみのPRは、必要に応じてスキップ可
codex review --base main
gh pr view <PR番号> --comments
gh api repos/Yuichi-TanakaJP/mini-tools/pulls/<PR番号>/reviews
gh api repos/Yuichi-TanakaJP/mini-tools/pulls/<PR番号>/comments
```

- Codex review は、コード変更を含むPRでは原則1回実施する。
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

## 10. トラブル時

- `index.lock` が残っている場合:
  - 別 Git プロセスが無いことを確認して `\.git\index.lock` を削除。
- 無関係差分がある場合:
  - そのファイルは add しない。
  - 必要なら `git stash push -- <file>` で一時退避して作業する。
