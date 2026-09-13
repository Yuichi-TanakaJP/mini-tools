# 株主優待期限帳 Reward Model v2

## 1. 目的

期限帳を単一Rewardの残高/期限だけでなく、同種価値のAccount集計、取得単位のGrant Lot、申込/選択/サービス権利のEntitlement、意味の異なるDeadlineまで扱えるようにする。

既存 `docs/specs/tools/yutai-expiry.md` のv1期限帳契約は互換維持し、本仕様はadditiveなv2契約として扱う。

## 2. UI構造

DB preview時:

1. 既存 `DatabaseRewards` (v1)
2. `RewardLedgerV2Panel` (v2)

を併設する。v2障害時にv1へ黙ってfallback保存しない。

## 3. 表示単位

### Account

- 現在残高 `recorded_balance_native`
- 利用可能 `available_balance_native`
- 期限切れ未処理 `expired_unprocessed_native`
- 次回期限 `nearest_expiry`
- 追跡開始時残高 `opening_balance_native`
- 追跡後取得 `tracked_granted_native`
- 追跡後利用 `tracked_consumed_native`
- 失効済 `tracked_expired_native`
- coverage

`opening_balance_native` は累計取得額と表示しない。

### Grant Lot

- 付与量 / 残量
- granted_at
- expires_on
- coverage
- Entitlement/Profile/Cycle参照

### Entitlement / Deadline

- benefit kind / status / native quantity
- selected option
- claim/activate/booking/use/service period deadline
- deadline completed state

## 4. 優待モデル例

- QUO: Account合計 + legacy opening + 新規Grant
- EDION: Account合計 + 期限別Grant Lot + FEFO
- U-NEXT: point Account + 月次1,800pt Grant + FEFO
- rolling point: rolling expiry days/months policy
- choice/catalog: Entitlement selected_option + claim_by
- service: Entitlement + activate/service start/end

## 5. 更新契約

Read: `stock_notes_get_yutai_reward_ledger_v2(p_today)`

Write: `stock_notes_record_yutai_v2_command(p_input)`

MiniToolsはschema_version=2、UUID request_id、occurred_at、expected_revision、source=`mini_tools`を送る。

対応command:
- create_account / create_entitlement / add_deadline / set_entitlement_status
- create_grant / link_legacy_reward
- consume_account / consume_lot
- expire_lot / expire_account / extend_account
- move_account_value
- select_entitlement_option / complete_deadline

## 6. セキュリティ / 競合

- v1 Repositoryのowner/sessionRevisionへv2 Repositoryを同期する。
- owner change時にv2 snapshotを即時破棄する。
- RPC前後にauth session ownerを再確認する。
- 15秒timeout。
- uncertain writeは元request_idを保持してretryする。
- 別request_idでの自動再送は禁止。

## 7. legacy移行

- 初回画面表示だけで自動Account linkしない。
- linkは `link_legacy_reward` を明示実行する。
- linkでremaining/initial/event historyを変更しない。
- 過去取得を推測分割しない。

## 8. Responsive

390pxではmetricsを1列、formを縦積みし、Account/Lot名は折返す。横スクロールを主要操作要件にしない。

## 9. 関連

- mini-tools#634
- stock-notes#200 / PR#201
- `docs/decision-log/2026-09-13-yutai-reward-model-v2.md`
- `docs/uat/yutai-reward-model-v2.md`
