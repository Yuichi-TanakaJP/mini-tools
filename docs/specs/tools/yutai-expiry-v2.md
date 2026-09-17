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
- 未分類増減 `unclassified_adjustment_native`
- 未分類増加 `unclassified_increase_native`
- 未分類減少 `unclassified_decrease_native`
- coverage

`opening_balance_native` は累計取得額と表示しない。
旧 `adjusted` eventは、取得・利用・訂正のどれかを確定できないため `unclassified_*` へ投影し、`tracked_granted_native` / `tracked_consumed_native` へ推測分類しない。

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

## 4. 期限ポリシー

- `none`: Account自体に期限なし。
- `fixed_per_grant`: Grant Lotごとに固定期限を持つ。EDION/U-NEXT月次ポイント等。
- `rolling_inactivity`: 最終活動をanchorに期限を更新する。receive/consume/transfer/convert/adjust/extendが活動となる。
- `rolling_on_grant`: 最後の付与（`receive`）だけをanchorに期限を更新する。consume/transfer等では延長しない。majicaポイント等に使う。
- `external_managed`: 外部サービス側が期限を管理し、StockNoteでは独自期限計算をしない。

`rolling_inactivity` / `rolling_on_grant` はdaysまたはcalendar monthsのどちらか一方を持つ。12か月ルールを365日へ丸めない。
日本の優待期限判定では、操作timestampを **Asia/Tokyoの暦日**へ変換して比較する。UTC日付への単純castを使わない。

UIでは、`rolling_inactivity` は「最終活動から」、`rolling_on_grant` は「最後の付与から」と明示する。

## 5. 優待モデル例

- QUO: Account合計 + legacy opening + 未分類の旧adjusted増減 + 新規Grant
- EDION: Account合計 + 期限別Grant Lot + FEFO。旧adjustedの使用実績は未分類減少のまま保持
- U-NEXT: point Account + 月次1,800pt Grant + FEFO。旧「1,800pt相当×個数」のcount行はpointへ推測換算しない
- majicaポイント: points Account + `rolling_on_grant` 12か月。利用では期限を延長せず、新しいポイント付与だけで更新
- rolling wallet: `rolling_inactivity` days/months。利用や残高増減が活動になる制度に使用
- 三越伊勢丹割引: Accountなし discount Entitlement + use_by。購入限度額が未記録なら推測しない
- 博物館会員権: Accountなし service_access Entitlement + use_by
- choice/catalog: Accountなし Entitlement + selected_option + claim_by
- service: Accountなしまたは必要なAccount付きEntitlement + activate/service start/end

## 6. 更新契約

Read: `stock_notes_get_yutai_reward_ledger_v2(p_today)`

Write: `stock_notes_record_yutai_v2_command(p_input)`

MiniToolsはschema_version=2、UUID request_id、occurred_at、expected_revision、source=`mini_tools`を送る。

対応command:
- create_account / create_entitlement / add_deadline / set_entitlement_status
- create_grant / link_legacy_reward / link_legacy_entitlement
- consume_account / consume_lot
- expire_lot / expire_account / extend_account
- move_account_value
- select_entitlement_option / complete_deadline
- record_entitlement_usage（Accountなしの固定額でないEntitlementの利用実績）

履歴タブの利用実績はv2 Repositoryから保存する。保存結果が不明な場合は新しい要求を送らず、同じrequest_idとoccurred_atで再確認する。保存後はv2台帳を再取得し、ページ全体は再読み込みしない。

`link_legacy_reward` は残高型legacyをAccountへ所属させる。
`link_legacy_entitlement` は割引・サービス・選択型などのlegacyを **AccountなしEntitlement** へ所属させる。どちらもlegacy Rewardの残高・期限・event historyを移行操作だけで変更しない。

`extend_account` は `rolling_inactivity` 専用。`rolling_on_grant` は手動延長せず、新しいGrant/receiveだけで期限が更新される。

## 7. セキュリティ / 競合

- v1 Repositoryのowner/sessionRevisionへv2 Repositoryを同期する。
- owner change時にv2 snapshotを即時破棄する。
- RPC前後にauth session ownerを再確認する。
- 15秒timeout。
- uncertain writeは元request_idとoccurred_atを保持してretryする。
- uncertain中は別writeを禁止し、通常readをしてもuncertain状態を消さない。
- DBが明示エラーを返した要求は未保存、transport失敗/timeout/成功応答破損は結果不明として扱う。

## 8. legacy移行

- 初回画面表示だけで自動linkしない。
- 残高型は `link_legacy_reward` でAccountへ明示linkする。
- Accountを持たない割引・サービス・選択型は `link_legacy_entitlement` で standalone Entitlementへ明示linkする。
- Entitlement link先は `account_id = null` に限定する。Account所属済みRewardや既にEntitlement所属済みRewardは二重linkしない。
- linkでremaining/initial/expires_on/event historyを変更しない。
- 過去取得を推測分割しない。
- legacyの管理単位とv2 Accountのnative unitが一致しない行は推測換算してlinkしない。
- `rolling_on_grant` へ移すlegacyに「最後の付与日」の確実な証跡がない場合、旧expires_onから逆算してreceive operationを捏造しない。将来付与から正しく追跡する。
- 明白な旧データ誤記を訂正する場合は、linkとは別Commandで根拠を残して修正する。

## 9. Responsive

390pxではmetricsを1列、formを縦積みし、Account/Lot名は折返す。横スクロールを主要操作要件にしない。

## 10. 関連

- mini-tools#634
- stock-notes#200 / PR#201
- stock-notes#202 / PR#203
- stock-notes#204 / PR#205
- stock-notes#206 / PR#207
- `docs/decision-log/2026-09-13-yutai-reward-model-v2.md`
- `docs/uat/yutai-reward-model-v2.md`
