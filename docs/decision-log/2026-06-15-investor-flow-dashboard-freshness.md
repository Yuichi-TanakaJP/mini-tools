# 2026-06-15 投資主体別売買動向のダッシュボード鮮度基準

## 背景

投資主体別売買動向は対象週の翌週にJPXから公表される。管理ダッシュボードが
`latest.start_date` から経過日数を計算すると、正常に公開された直後でも `STALE` になる。

## 決定

- 投資主体別売買動向の freshness / SLA は manifest の `generated_at_jst` を基準にする。
- 最終更新週と履歴の表示には、引き続き `latest.start_date` と `weeks[].start_date` を使う。
- SLA 一覧では対象週と公開日時をそれぞれ `Latest week` / `Published` として表示する。
- 他データソースの鮮度基準は変更しない。

## 理由

対象期間と公開日時は異なる意味を持つ。運用監視では公開処理が最後に成功した日時を使う方が、
実際の更新障害とJPXの通常の公表待ちを区別できる。

## 影響範囲

- `app/admin/page.tsx`
- `app/admin/freshness.ts`
- `docs/specs/tools/admin-dashboard.md`
