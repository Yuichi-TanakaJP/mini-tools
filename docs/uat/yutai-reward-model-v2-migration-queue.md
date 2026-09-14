# Yutai Reward Model v2 Migration Queue UAT

## Scope

旧Rewardの未割当を、現在判断が必要な「要整理」と使用済み・残高0・archivedの「過去履歴」に分ける。さらに `status=unknown` のEntitlementを根拠確認後に明示的な状態へ解決できることを確認する。

## UAT-01 未割当の分類

期待:
- `archived_at is null AND remaining_value > 0` は「要整理」。
- `archived_at is not null OR remaining_value = 0` は「過去履歴」。
- 過去履歴は折りたたみ表示で、通常の移行対象に見えない。
- DBのReward自体は分類表示だけで変更されない。

2026-09-14時点の実データ期待値:
- 要整理 2件: U-NEXT旧count形式、majica旧anchor不明。
- 過去履歴 8件。

## UAT-02 U-NEXT / majica blocker表示

期待:
- U-NEXTは旧14 countを14 pointへ推測換算しない旨を表示する。
- majicaはexpires_onから最後の付与日を逆算しない旨を表示する。
- 将来の正規付与はそれぞれ既存の `unext-points` / `majica-points` Accountへ記録する。

## UAT-03 unknown Entitlementの解決

期待:
- `status=unknown` のEntitlementだけが「状態未確定」に表示される。
- eligible / claim_required / claimed / activated / fulfilled / expired / waived / cancelled のいずれかをユーザーが選び、「状態を確定」できる。
- 選択前は書込ボタンが無効。
- status確定はcanonical v2 command `set_entitlement_status` を利用し、revision競合を維持する。
- 推測で自動確定しない。

## UAT-04 既存v2 Panel回帰

期待:
- Account / Grant Lot / Entitlement / Deadlineの既存表示・操作は維持する。
- 旧Panel内の未割当セクションだけをWorkspaceラッパーで非表示にし、新しい移行キューへ置き換える。
- DB preview以外の旧ToolClientには影響しない。
