# Yutai Reward Model v2 cross-cutting contract

## 責務境界

- stock-notes / Supabase: Reward v2 SoT、RLS、revision、idempotency、allocation、expiry validation。
- mini-tools `RewardV2Repository`: auth owner pinning、wire validation、timeout、uncertain retry、UI snapshot。
- v1 `YutaiRepository`: 従来workspace/restore/calendar連携の正本。v2は置換しない。
- UI: Account/Grant/Entitlementの意味を表示し、計算や期限配賦をブラウザ独自に再実装しない。

## Owner同期

v2 Repositoryはv1 `YutaiRepository.getIdentity()` の `ownerId/sessionRevision` を監視する。

- owner/revisionが変わったらv2 ledger/error/uncertain commandを即時破棄。
- load/saveのRPC前後にSupabase `getSession()` のuser idを再確認。
- Aの遅延responseをBへpublishしない。

## Refresh

- mount / owner change / today change
- window focus
- online復帰
- visible復帰
- successful command後

で再読込する。

## Write retry

書込timeout/network errorだけ `uncertain` とし、wire全体（request_id含む）を保持する。同じrequest_idでのみ手動retryする。validation/RLS/revision errorはuncertain扱いにしない。

## v1 coexistence

v1 Rewardは引き続き同じ `stock_notes_yutai_rewards` を更新するため、AccountにlinkされたGrant Lotの現在残高はv2 readへ反映される。ただしv2移行中はAccount linkを明示操作に限定し、v1/v2同時編集の競合をUATで確認してから全面切替する。

## 禁止

- account/title文字列だけで暗黙linkしない。
- `initial_value` を生涯取得総額と表示しない。
- expired rolling balanceを利用可能として表示しない。
- service roleをclientへ渡さない。
- v2 read failure時にlegacy LocalStorageへfallbackしない。
