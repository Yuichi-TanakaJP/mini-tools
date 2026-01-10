# Git 学びログ（2026-01-10）

## 今日やったこと（要約）

- 混在ブランチから PWA / yutai-memo / yutai-expiry(UI) を cherry-pick で分離
- “取り逃し” を小 PR で救出（例：ホームの yutai-memo アイコン）
- decision log を docs として残す運用を開始
- rebase / cherry-pick / revert / ブランチ削除の一連を体験
- 誤って main に混入した変更を revert PR で安全に巻き戻し

## 起きたトラブルと原因

### 1) docs PR に UI 変更が混入して main に入った

- 事象：docs のつもりが `ToolClient.tsx / YutaiRow.tsx / YutaiTable.tsx / notes/` まで一緒に main にマージされた
- 原因：PR 作成前に「差分に含まれるファイル」を確認せず、ブランチ上に別変更が乗ったまま PR 化していた

### 2) cherry-pick でコンフリクト

- 事象：`app/page.tsx` などで conflict
- 対処：`Accept Current/Incoming` の意味を理解して選択 → `git add` → `git cherry-pick --continue`

### 3) rebase でコンフリクト

- 事象：`ToolClient.tsx` で conflict
- 対処：main 側の仕様を優先して解消 → `git add` → `git rebase --continue`
- 学び：rebase 後は履歴が変わるので `--force-with-lease` が必要になることがある

## 今日覚えたコマンド（実戦で効いた順）

- 状態確認
  - `git status`
  - `git diff --name-only origin/main...HEAD`
  - `git diff --cached`
- 分離
  - `git cherry-pick <hash...>`
- コンフリクト解消
  - `git add <file>`
  - `git cherry-pick --continue`
  - `git rebase --continue`
  - （戻す）`git cherry-pick --abort` / `git rebase --abort`
- 巻き戻し
  - `git revert <commit>`
- “消していいか” 判定
  - `git cherry -v main <branch>`
- ブランチ整理
  - `git branch -a`
  - `git fetch --prune`
  - `git branch -d <branch>`
  - `git push origin --delete <branch>`

## 今日の判断ルール（再発防止）

### PR を出す前チェック（必須）

- `git status` が clean
- `git diff --name-only origin/main...HEAD` の一覧が “意図したファイルだけ” になっている

### docs PR の鉄則

- docs 以外が混ざっていたら **その PR は作らない**
- 必要なら「救出用の小 PR」に分ける

## 次回やること

- decision log（commit ID 入り版）を作成して追記する
- feature/yutai-table-ui-clean の位置づけを明確化（WIP 保管庫として main に入れない）
