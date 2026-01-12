# QR 共有 UI 改善ログ（2026-01-11）

## 作業概要

- トップ画面の共有用 QR コード表示を改善
- Header / Footer に重複していた共有 UI を整理
- 小画面でのモーダル見切れ問題を修正

## 技術的ポイント

- React Portal を使ったモーダルの外出し
- URL 生成ロジックの集約（QR / Copy 共通化）
- Google Lens 対策として絶対 URL を使用

## 詰まった点

- position: sticky + z-index による stacking context
- lint の react-hooks/exhaustive-deps 警告対応
- local 環境と本番 URL の扱いの違い

## 学び

- UI の問題は CSS だけでなく「DOM の階層」が原因のことがある
- 「1 関数 + オプション」設計は後から効いてくる
- lint 警告は設計の粗に気づくヒントになる

## 状態

- PR 作成 → merge → deploy 完了
- 関連 Issue #10 #11 #12 を close
