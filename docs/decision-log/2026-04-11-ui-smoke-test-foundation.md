# 2026-04-11 dev 環境 UI スモークテスト基盤

## 結論

- local 専用の最小 UI スモークテスト基盤として Playwright を導入する
- 実行入口は `npm run test:ui`
- 初期対象は `charcount` / `total` / `yutai-memo` / `yutai-expiry` / `stock-ranking` / `topix33` / `nikkei-contribution`
- artifact は `.tmp/ui-smoke-artifacts/` と `.tmp/ui-smoke-report/` に出力する

## 背景

- 共通化や refactor が進み、lint だけでは UI 退行を拾いにくくなってきた
- 特に「ページが開くか」「console error がないか」「failed request がないか」「主要ページの見た目を残せるか」をまとめて確認したい

## 決めたこと

- まずは CI ではなく local 専用で始める
- 最初の判定軸は次の 4 つに絞る
  - ページが開く
  - H1 が表示される
  - console error がない
  - request failure がない
- `charcount` と `total` だけは簡単な入力操作も smoke に含める
- screenshot と json artifact を保存して、Codex からも追いやすくする

## 理由

- 最小のセットでも、共通化時の明確な崩れをかなり拾える
- local 専用なら導入コストを抑えつつ、必要になったら CI へ広げやすい
- baseline 比較や visual regression は後から追加できる

## 補足

- market tools のデータ状態により表示内容は変わるため、初期版では厳密な文面比較より「到達」「主要見出し」「エラーなし」を優先する
- artifact の保存先は `.gitignore` 済みの `.tmp/` 配下に寄せる
