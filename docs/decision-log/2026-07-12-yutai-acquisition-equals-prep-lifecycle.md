# 2026-07-12 取得＝仕込みの一本化と権利年ライフサイクル

## 背景

12ヶ月ビューの検討過程で、取得と仕込みを別イベントとして扱っていたが、ユーザーの運用では **「取得済み」＝「売り・買いを仕込んだ日」＝仕込み** であり、両者は同一イベントだと確認できた。これに伴い、次の不整合が明らかになった。

- PR #411 で追加した「仕込み実績（別ログ、`yutai_dashboard_prep_log_v1`）」は、取得＝仕込みなら重複。
- 取得履歴（`ArchivedMemoItem`）は `acquiredAt`（＝アーカイブした時刻）＋ `entitlementMonthKey`（権利月/年）を持つが、`acquiredAt` が「実際に仕込んだ日」ではなくアーカイブ時刻になっている。
- 12ヶ月ビューの取得✓は権利月にしか出さず、「いつ仕込んだか（当月）」を表示していない。
- 月替わりの一括アーカイブ（[yutai-memo/ToolClient.tsx:853](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-memo/ToolClient.tsx)）は、月が替わると取得済みを一律アーカイブして `acquired` を false に戻す。権利月より前に仕込むと、権利月が来る前にリセットされてしまう。

## 決めたこと（仕様）

### 1. 取得＝仕込みの一本化
- 「仕込んだ（＝取得済み）」を単一イベントとして扱う。**別ログ（PR #411）は撤回**する。
- 取得（＝仕込み）を、**仕込んだ実日付（当月）と権利月の両方**に紐づけて記録する。
  - `MemoItem` に `acquiredMarkedAt?`（ISO）を追加し、`acquired` を true にした時刻を保持する。
  - アーカイブ時、`ArchivedMemoItem.acquiredAt` にはアーカイブ時刻ではなく `acquiredMarkedAt`（＝仕込み日）を入れる。未設定の旧データはアーカイブ時刻でフォールバック（後方互換）。
  - `entitlementMonthKey` は従来どおり権利月（[2026-07-12 取得実績のひもづけ](./2026-07-12-yutai-entitlement-attribution-lead-time.md) のリード期間ロジックで当年に寄せる）。

### 2. 12ヶ月ビューの表示
- **権利月の取得✓表示（権＋緑✓／灰✓）は残す**（撤去しない）。ユーザー確認済み。
- これに加えて、取得（＝仕込み）を**実際に仕込んだ月（`acquiredAt` の月）に実施マーカー**で表示し、権利月の取得表示とひも付ける。
- PR #411 の手動クリック記録（フクシア●・独立ログ）は撤去し、取得履歴と `acquired` フラグから導出する表示に置き換える。
- 取得表示の対象は、取得履歴（アーカイブ済み）に加えて **現在の `acquired`（事前仕込みでまだアーカイブされていないもの）** も含める。月替わりリセットの変更で事前仕込みは権利月までアーカイブされないため、`acquired` フラグからも導出する。

### 3. 月替わりリセット（一括アーカイブ）の条件
- 一括アーカイブ（＝リセット）の対象を、**権利月に到達／経過した取得済みだけ**に限定する。
- 権利月より前の事前仕込みは `acquired` のまま維持し、リセットしない。権利月を過ぎたらアーカイブ提案する。

### 4. 断念（取引停止・残数なしで見送り）
- 取得と同様に、権利年ごとの結果として「断念」データを持つ。
- 保持方法は、権利年ごとの結果を1つにまとめるため **取得履歴を結果ステータス化**する案を軸にする：`ArchivedMemoItem.outcome?: "acquired" | "abandoned"`（既定は `acquired`）＋ `abandonReason?`（`取引停止` / `残数なし` / `その他`）。
- 12ヶ月ビューでは断念を✕マーカー＋理由ツールチップで表示。
- 断念の実装は段階を分ける（下記）。

## 全体の流れ（ユーザー運用）

`計画（帯・仕）` → `仕込み実施＝取得（当月に実施マーカー）` → `権利月（権）到達` → `取得確定でアーカイブ／断念で✕`。年度セレクタで年ごとに追える。

## 段階実装計画

1. **Phase A（一本化・表示・リセット）**
   - PR #411（別ログ）を撤回。
   - `acquiredMarkedAt` を追加し、アーカイブの `acquiredAt` を仕込み日にする。
   - 12ヶ月ビューで仕込み月（当月）に実施マーカーを出す（取得履歴から導出）。
   - 月替わり一括アーカイブを「権利月到達／経過のみ」に限定。
2. **Phase B（断念）**
   - `outcome` / `abandonReason` を追加。断念の入力導線と✕表示。

## データと互換性

- `MemoItem.acquiredMarkedAt?`、`ArchivedMemoItem.outcome?` / `abandonReason?` はいずれも任意。旧データは従来解釈（`acquired` 相当、アーカイブ時刻フォールバック）。
- `yutai_dashboard_prep_log_v1`（PR #411）は撤去。既存キーは読まないだけで害はないが、`SYNCED_KEYS` からも外す。

## 影響範囲

- `app/tools/yutai-memo/`（types・ToolClient・storage・date-utils 周辺）
- `app/tools/yutai-dashboard/`（12ヶ月ビュー、prep-log 撤去）
- `lib/sync/registry.ts`（prep-log キー除去）
- `docs/specs/tools/yutai-dashboard.md`、`docs/specs/tools/yutai-memo.md`、各 UAT

## 関連

- Decision Log: [2026-07-12 12ヶ月ビューの年度軸](./2026-07-12-yutai-dashboard-calendar-year-axis.md)
- Decision Log: [2026-07-12 取得実績の権利月ひもづけ](./2026-07-12-yutai-entitlement-attribution-lead-time.md)
- Decision Log: [2026-07-12 12ヶ月ビューの仕込み実績記録](./2026-07-12-yutai-dashboard-prep-log.md)（本決定で撤回）
