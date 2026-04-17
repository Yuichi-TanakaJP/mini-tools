# 2026-04-18 Git ブランチ整理のガードレール追加

## 背景

- PR マージ後にローカル branch delete まで実施できず、feature ブランチが残りやすい
- AGENTS.md には手順があるが、会話や作業の流れの中で最後の整理が抜けることがあった

## 今回決めたこと

- マージ後のローカル整理は、`scripts/git-branch-cleanup.ps1` を共通入口として使えるようにする
- スクリプトは `main` 上でのみ動かし、`origin/main` への fast-forward と merged local branch 一覧表示をまとめて行う
- 実削除は `-DeleteMerged` 指定時だけ行い、デフォルトはプレビューにする

## 判断理由

- 「覚えておく」運用だけでは抜けやすく、確認と削除の入口を固定した方が継続しやすい
- merged branch の確認だけ先に見えると、削除対象を誤認しにくい
- local branch cleanup に絞ることで、安全性を保ちながら日常運用に乗せやすい

## 影響範囲

- `scripts/git-branch-cleanup.ps1`
- `AGENTS.md` の merge 後手順
- docs index / decision log

## 残課題

- remote branch delete を自動化するかは未決定
- 将来的に `npm` / `just` / `Makefile` などから呼べる入口を追加する余地がある

## 関連

- Issue:
- PR:
- 参照 docs:
  - `AGENTS.md`
  - `docs/docs-writing-workflow.md`
