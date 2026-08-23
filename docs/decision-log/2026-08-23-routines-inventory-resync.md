# 2026-08-23 ルーティン一覧の棚卸しズレを直す

## 背景

- `/premium/routines` は棚卸し時点の設定を静的にハードコードする方式
  （[2026-08-08 決定](./2026-08-08-routines-static-inventory.md)）。
- 2026-08-08 の棚卸し後、実機のタスクスケジューラ登録が変わり、
  `data/routines.ts` と実態がズレた。
  - `credit_inventory_reminder_nikko` / `credit_inventory_reminder_sbi` /
    `monthly_rankings_reminder` の 3 リマインダータスクを削除。
    このうち nikko は `msg.exe`（Windows Home 非搭載）を呼んでいて数か月前から
    サイレントに失敗していた。
  - 該当のリマインダー起点の作業は `pc-saas-health-monitor` 側の新しい実行画面に
    移り、その画面からタスク名で起動するためだけの **トリガーなしタスク**が
    `\market_info\` 配下に 4 件（`manual_run_naito_and_backup` /
    `manual_run_sbi_credit_inventory` / `manual_run_nikko_credit_inventory` /
    `manual_run_monthly_rankings`）登録された。
  - `yutai_stock_prices_daily`（既存の自動タスク）が 2026-08-08 の棚卸しから
    単純に漏れていたことも判明（今回の変更とは無関係）。

## 今回決めたこと

- 削除: `credit-inventory-nikko` / `credit-inventory-sbi` / `monthly-rankings`
  （semi モードのリマインダー起点エントリ）。
- `naito-daily-run` は **新規追加ではなく既存エントリの `source` を更新**。
  `scripts/run_naito_and_backup.ps1` → `manual_run_naito_and_backup`。
  実体（内藤証券ログイン＋2FA の日次運用）は変わっておらず、実行画面から
  起動できるようになっただけなので、別エントリにすると同じ作業を二重計上
  してしまう。
- 新規追加（3件、mode: `manual`）:
  `sbi-credit-inventory` / `nikko-credit-inventory` / `monthly-rankings`
  （source をそれぞれ `manual_run_sbi_credit_inventory` /
  `manual_run_nikko_credit_inventory` / `manual_run_monthly_rankings` に変更）。
  旧リマインダーが廃止された以上、実質的に別物の運用として扱う。
- 新規追加（1件）: `yutai-stock-prices-daily`（mode: `auto`、時刻未確認のため
  `schedule.times` は空＝時刻未定行に表示）。
- `ROUTINES_SURVEYED_ON` を `2026-08-23` に更新。

## 判断理由

### トリガーなしタスクの mode を `manual` にした理由

既存語彙は `auto`（無人実行前提）/ `semi`（リマインダー起点）/
`manual`（完全に自分の意思で起動）の 3 分類。

- `auto` は不適合: トリガーが無いので無人実行されない。SBI・日興の 2 件は
  パスキー認証待ちがあり、そもそも無人完走できない。
- `semi` は不適合: この分類は「リマインダーが飛んできて実行する」を指すが、
  該当のリマインダータスクは今回廃止された。何かに促されて動くのではなく、
  実行画面のボタンを押すという本人の能動的な操作が起点になる。
- `manual` の定義文「完全に自分の意思で起動する」に文字どおり一致する。
  実行画面からタスク名で起動する、という手段が変わっただけで、
  起動判断が本人にある点は他の manual エントリ（X 投稿スキルなど）と同じ。

新しい mode を追加する必要はないと判断した。

### naito を新規エントリにしなかった理由

このツールの目的は「作業総量と偏りの把握」（[2026-08-08 決定](./2026-08-08-routines-static-inventory.md)背景）。
`manual_run_naito_and_backup` は既存の `naito-daily-run`（平日20時、
run_naito_and_backup.ps1）と完全に同一の作業を指しており、
別エントリとして追加すると平日20時の作業を二重計上し、
週あたり実行回数のサマリーが実態より多く出る。目的に反するため、
実体が同じものは統合し、traceable な識別子（タスク名）に更新するに留めた。

## 影響範囲

- `app/premium/routines/data/routines.ts` のみ。型定義・集計ロジック・UI は変更なし。
- 既存テスト（`app/premium/routines/__tests__/timetable.test.ts`）はハードコードされた
  ルーティンではなくヘルパーで組み立てているため影響なし。全16件パス確認済み。

## 残課題

- `yutai-stock-prices-daily` の実行時刻が未確認。本人確認のうえ
  `schedule.times` を埋める。
- この棚卸しが「今回の変更を人が言わなければ気付かれず、実機とズレたまま
  静止していた」ことが判明した。目的（作業総量の可視化）にとって
  ズレたままの表示は実害があるため、[2026-08-08 決定](./2026-08-08-routines-static-inventory.md)
  の「今後の選択肢」に挙げられている実行実績の自動取り込みや、
  最低限「最終棚卸し日から N 日経過したら画面に警告を出す」程度の
  鮮度チェックを検討する価値がある（今回は未着手）。

## 関連

- Issue:
- PR:
- 参照 docs: [2026-08-08 ルーティン可視化を静的棚卸しにする](./2026-08-08-routines-static-inventory.md)
