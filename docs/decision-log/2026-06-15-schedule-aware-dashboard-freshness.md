# 2026-06-15 管理ダッシュボードのスケジュール連動鮮度判定

## 背景

管理ダッシュボードの freshness pill は全データを一律7日で `STALE` にしていた。
そのため、月次更新が正常に完了していても月の途中から `STALE` と表示された。

## 決定

- `FRESH` は従来どおり更新から2日以内とする。
- `RECENT` の上限は各行の `schedule.expectedMaxDays` とする。
- `expectedMaxDays` を超えた場合に `STALE` とする。
- SLA対象外の行は、freshness表示に限り従来の7日を上限として維持する。

## 理由

鮮度表示とSLAが異なる更新周期を使うと、正常運用中の月次データが `STALE` になる。
同じスケジュール上限を使うことで、表示と運用判断を一致させる。

## 影響範囲

- `app/admin/freshness.ts`
- `app/admin/page.tsx`
- `docs/specs/tools/admin-dashboard.md`
