# Yutai Reward Model v2 UAT

## Scope

`/tools/yutai-expiry` のDB previewで、既存v1期限帳を維持したままv2 Account / Grant Lot / Entitlement / Deadlineを併設する。

関連: mini-tools#634 / stock-notes#200 / stock-notes#202

## 前提

- `NEXT_PUBLIC_YUTAI_EXPIRY_DB_PREVIEW=true`
- Supabaseへログイン済み
- v2 DB migration / read / command RPCが適用済み
- 旧Rewardの自動Account紐付けはしない

## UAT-01 初期表示 / legacy保全

1. 期限帳を開く。
2. 既存v1カードとv2パネルが両方表示されることを確認する。
3. v2 Account未作成の場合、未割当Reward件数が表示されることを確認する。

期待:
- v1カードの残高/履歴/編集は従来どおり。
- v2未作成を理由にlegacyへfallback保存しない。
- 未割当Rewardは残高を変更せず表示される。

## UAT-02 Account作成 / legacy link

1. QUO等のAccountを作成する。
2. 未割当RewardからAccountを選び「残高を変えず紐付け」を押す。

期待:
- link前後でReward残高・event履歴が変わらない。
- v2 Account側へLotとして現れる。
- coverageは履歴不完全であることが分かる。

## UAT-03 QUO型表示 / 未分類増減

期待:
- 現在残高と追跡開始時残高を別表示する。
- `opening_balance_native` を生涯累計取得と表現しない。
- 旧 `adjusted` は「未分類増減」としてnet/増加/減少を表示し、追跡後取得・利用へ推測分類しない。
- 実データQUOでは開始43,500円、未分類純増10,500円（増加13,000円 / 減少2,500円）、現在54,000円を説明できる。
- 追跡後にnative_completeで付与したLotだけが「追跡後の取得」に加算される。

## UAT-04 EDION型

1. 同一Accountへ期限の違う2つのGrant Lotを追加する。
2. FEFO Accountから一部使用する。

期待:
- Account残高は合計表示。
- Lotは期限別に残る。
- 期限の近いLotから消費される。
- 次回期限が最も近い未使用Lotになる。
- legacyの旧 `adjusted -3000` は未分類減少として残し、追跡後利用へ自動再分類しない。

## UAT-05 U-NEXT型

1. point Accountを `fixed_per_grant + fefo` で作る。
2. 月ごとに1,800ptと各期限をGrantとして追加する。
3. 2,000pt使用する。

期待:
- 古い期限Lotを全消費し、次Lotを必要分だけ消費する。
- Account合計とLot残量が一致する。
- legacyの「1,800pt相当×個数」count行はpoint Accountへ推測換算しない。将来付与から正しいpoint Lotを使う。

## UAT-06 Manual Lot

1. `allocation_policy=manual` のAccountを作る。
2. Lotごとの「使用」から量を指定する。

期待:
- 指定Lotだけ減る。
- 他Lotは変化しない。
- stale revisionは保存されない。

## UAT-07 Rolling expiry

1. rolling expiry 12か月のAccountを作る。
2. transfer/利用等で活動日を更新する。
3. 期限後に開く。

期待:
- 12か月を365日に丸めず表示する。
- transfer先Accountでも活動日が更新される。
- 期限後は利用可能=0、期限切れ未処理へ移る。
- 「失効を確定」でLot残高0＋expired eventになる。

## UAT-08 Entitlement / Deadline

1. choice Entitlementの選択肢を保存する。
2. claim/activate/fulfillを更新する。
3. Deadlineの完了ボタンを押す。

期待:
- selected_optionが保存される。
- status timestampがDBに残る。
- Deadline完了はcompleted_atを持つ。

## UAT-09 owner switch / uncertain retry

1. Aでv2を表示する。
2. Bへ切り替える。
3. 書込中にネットワークを切断するケースを確認する。

期待:
- Aのv2 dataをBへ見せない。
- owner changeでv2 cacheを即破棄する。
- transport failure後も通常readでuncertain状態を消さない。
- uncertain writeは同じrequest_id＋occurred_atの再確認だけを提供し、別writeを送らない。
- DBが明示エラーを返した要求は結果不明と表示しない。

## UAT-10 mobile / 日付境界

390px幅と日付跨ぎを確認する。

期待:
- Account metricsが1列化する。
- form/buttonが横にはみ出さない。
- 長いAccount名/Lot名が折り返される。
- 画面を開いたまま日付が変わった場合、1分以内またはfocus時に基準日が更新され、期限判定も更新される。
