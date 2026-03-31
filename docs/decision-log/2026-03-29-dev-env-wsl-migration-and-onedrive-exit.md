# 2026-03-29 dev 環境の WSL 移行方針と OneDrive 運用解消

## 背景

- Windows ネイティブ環境では `codex review` 実行時に policy / language mode 系の不安定さがあり、恒久的には WSL 側へ dev 環境を寄せる方向を検討する必要が出た
- `todo-app` は `C:\Users\yutaz\OneDrive\projects\todo-app` を参照しており、`todo-app-backend` は `C:\Users\yutaz\dev\todo-app-backend` にある
- フロントとバックエンドの配置が分かれているため、環境移行時の切り分けがしにくい
- 関連 Issue: `mini-tools#171` `ops(codex): investigate Windows native codex review policy errors`

## 今回決めたこと

- dev 環境の恒久方針は、最終的に WSL 側へ寄せる前提で検討する
- ただし、いきなり `mini-tools` を移行対象にせず、`todo-app` と `todo-app-backend` を検証用の組み合わせとして使う
- `todo-app` は OneDrive 配下での運用を続けず、まず Windows ローカルの `dev` 配下へ寄せる方針を採る
- 移行順は `OneDrive -> local dev -> WSL` の段階移行とする

## 判断理由

- Windows ネイティブの review 不安定さは、作業運用だけで吸収し続けるより、開発基盤を WSL に寄せた方が再発を減らしやすい
- `mini-tools` は現時点で作業中の差分や運用ルールも多く、最初の移行検証対象としては重い
- `todo-app` と `todo-app-backend` なら、frontend / backend / 環境変数 / Git / dev server / build の一連の確認ができる
- OneDrive 配下のままでは、同期・パス・監視挙動の問題が混ざりやすく、WSL 検証のノイズになる
- 先に `OneDrive -> local` を済ませると、問題が移設由来か WSL 由来かを切り分けやすい

## 影響範囲

- `mini-tools` 側の dev 環境検討メモ
- `todo-app` の配置方針
- `todo-app-backend` と合わせたローカル開発手順
- 今後の WSL 導入手順、Git / CLI / エディタ運用

## 残課題

- `todo-app` を `C:\Users\yutaz\dev\todo-app` へ移した後の起動・lint・build・API 接続確認
- WSL2 上での Node / Git / GitHub CLI / Codex CLI のセットアップ手順整理
- `todo-app` と `todo-app-backend` を WSL の Linux filesystem 側へ置く最終配置の決定
- WSL を dev 標準にした後、Windows ネイティブをどこまで補助用途として残すかの整理
- この方針を追跡する専用 Issue の作成

## 関連

- Issue: `#171`
- PR:
- 参照 docs: `docs/docs-writing-workflow.md`
