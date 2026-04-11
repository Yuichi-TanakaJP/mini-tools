# 2026-04-11 共通化 Issue の着手順メモ

## 背景

- repo 規模感の調査の中で、完全重複と構造重複が複数見つかった。
- その結果をもとに、共通化候補を次の Issue に分割した。
  - `#215` `ops(ui): localStorage系 ClientOnly ラッパーを共通化する`
  - `#216` `ops(market-tools): 日付別 data route の共通化と検証ポイントを整理する`
  - `#217` `ops(market-tools): visibleDates と初期日データ選定ロジックを整理する`
  - `#218` `ops(market-tools): ToolClient の日次データ取得 state を hook 化する`
  - `#219` `UI(small-tools): charcount と total の共通ページ shell を整理する`
- 進め方は後で見直す可能性があるため、現時点の推奨順だけでも docs に残しておく。

## 今回決めたこと

- 共通化は、次の順で進めるのを基本方針とする。

1. `#215` `ClientOnly` 共通化
2. `#216` market tools の date route 共通化
3. `#217` visibleDates / 初期日選定ロジック整理
4. `#218` ToolClient の日次取得 state hook 化
5. `#219` `charcount` / `total` の page shell 共通化

- この順番は固定ではなく、途中で前提や優先度が変わったら見直してよい。
- ただし、見直した場合も「なぜ順番を変えたか」が追えるように docs か Issue に残す。

## 判断理由

- `#215` は完全重複で、変更範囲が狭く、効果に対してリスクが小さい。
- `#216` と `#217` は market tools の基盤整理で、後続の `#218` より先にそろえた方が安全。
- `#218` は loading / error / cache の見え方に直結するため、route と SSR 側の共通化後に着手する。
- `#219` は整理価値はあるが影響範囲が限定的で、前半 4 件より優先度は低い。

## UI確認の基本タイミング

- `#215`
  - 共通ラッパー導入直後
  - `charcount` / `total` の入力と再読み込み確認後
  - `yutai-memo` / `yutai-expiry` の hydration warning 確認時
- `#216`
  - route helper 導入直後
  - `stock-ranking` / `topix33` / `nikkei-contribution` の日付切替確認時
- `#217`
  - helper 導入直後
  - 各ページの初回表示日と表示対象日一覧確認時
- `#218`
  - hook 抽出直後
  - 初回ロード、日付切替、エラー時の UI 確認時
- `#219`
  - shell 化直後
  - モバイル / デスクトップ両方のレイアウト確認時

## 影響範囲

- `docs/decision-log/`
- `docs/index.md`
- 共通化候補の優先順位づけ
- 今後の PR 分割方針

## 残課題

- 実際の着手時に、Issue の分け方をさらに細かくするかは未確定。
- `#214` の JSON / fallback 方針整理との兼ね合いで、market tools 側の優先順位が変わる可能性はある。
- 各 Issue の実装前に、必要なら UAT 観点を追加で整理する。

## 関連

- Issue:
  - `#214`
  - `#215`
  - `#216`
  - `#217`
  - `#218`
  - `#219`
- PR:
  - なし
- 参照 docs:
  - `docs/docs-writing-workflow.md`
  - `docs/system-architecture-overview.md`
  - `docs/market-tools-data-fetch-paths.md`
  - `docs/decision-log/2026-03-12-ssr-localstorage-hydration-guidelines.md`
  - `docs/decision-log/2026-04-07-loading-ui-and-parallel-fetch.md`
  - `docs/decision-log/2026-04-11-loading-spinner-pattern.md`
