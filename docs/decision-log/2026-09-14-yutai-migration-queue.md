# Yutai Reward Model v2 — migration queue separation

## Decision

Legacy Rewardの未割当は、全件を同じ「移行待ち」として扱わない。

- **要整理**: `archived_at is null AND remaining_value > 0`
- **過去履歴**: `archived_at is not null OR remaining_value = 0`
- **状態未確定権利**: Entitlement `status=unknown`

## Rationale

使用済み・残高0・archivedの旧データは、通常の移行作業対象ではない。これらを未割当件数へ混在させると、実際に判断が必要なU-NEXT旧count形式やmajica旧anchor不明が埋もれる。

`status=unknown` は権利の存在は確認できるがlifecycle状態を旧履歴から証明できないケースであり、自動推測せずユーザーが根拠確認後に状態を確定する。

## Current state at decision time

- Reward 34
- Reward Event 34
- Account 19
- Entitlement 5
- Unassigned 10
  - actionable 2
  - historical 8
- actionable blockers: U-NEXT legacy count / majica legacy unknown grant anchor

## Non-goals

- U-NEXT 14 countを14 pointへ換算しない。
- majica expires_onから最後の付与日を逆算しない。
- cross_strategyを変更しない。
- 過去履歴を削除しない。
