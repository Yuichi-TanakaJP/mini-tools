# Yutai Reward Model v2 の段階接続

- 日付: 2026-09-13
- 関連: mini-tools#634 / stock-notes#200

## 決定

期限帳の既存v1画面・RPCを置換せず、Reward Model v2 を追加レイヤーとして接続する。

- v1 `stock_notes_get_yutai_workspace` / `stock_notes_record_yutai_command` は互換維持する。
- v2 は `stock_notes_get_yutai_reward_ledger_v2` / `stock_notes_record_yutai_v2_command` を別契約として使う。
- 画面はDB preview時に既存 `DatabaseRewards` と v2 `RewardLedgerV2Panel` を併設する。
- 旧import Rewardは起動時に自動Account紐付けしない。ユーザーが意味を確認できたものだけ段階的にlinkする。
- v2 Accountは現在残高、利用可能残高、期限切れ未処理、次回期限、追跡開始時残高、追跡後取得を分ける。
- Grant Lotは期限・出所を保持したままAccountへ集約する。
- U-NEXT型はFEFO、EDION型は期限別Lot、QUO型は開始残高と追跡後取得を分離する。
- rolling expiryは「365日」と「12か月」を同一視せず、DB policyのdays/monthsを表示・更新契約へ反映する。
- Entitlementのclaim/use/service期限はtyped Deadlineとして扱う。

## 理由

旧34件は履歴coverageが不完全で、`initial_value` を生涯累計取得と解釈できない。単一残高/単一期限へ統合すると、U-NEXTの月次失効、EDIONの年度別期限、選択型/サービス型の申込期限を誤表現するため。

## 安全境界

- LocalStorage/backupを削除しない。
- legacy Rewardの残高・履歴をAccount link時に書き換えない。
- v2 wireは受信時にruntime validationする。
- v2 Repositoryはv1 Repositoryのowner/sessionRevisionへ追随し、owner changeで即時破棄する。
- uncertain writeは同一request_idでのみretryする。
- anon / 他ユーザー境界はDB RLS/RPCで維持する。

## 完了条件

1. Account / Lot / Entitlement / Deadlineのread/writeがMiniToolsから成立する。
2. U-NEXT / EDION / QUO / rolling expiryの代表ケースがDBとUIの双方で再現できる。
3. v1期限帳の回帰が通る。
4. 390px幅で主要操作が破綻しない。
5. main merge前にPR review/UATを完了する。
