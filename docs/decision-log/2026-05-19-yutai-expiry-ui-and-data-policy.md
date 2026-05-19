# 2026-05-19 優待期限台帳 UI と入出力データ方針

## 背景

- 対象 tool: 優待期限台帳 `/tools/yutai-expiry`（`app/tools/yutai-expiry/`）
- スクショレビューでコントロール列・セグメント・トグルの不整合、リスト/カード切替の未反映バグが判明。
- あわせてポップアップ導線、エクスポート/インポートの正規化を調査し、データ消失バグを発見。
- 関連 PR: 本ファイルと同 PR。

## 今回決めたこと

### データ contract（入出力）
- インポート正規化 `normalizeLegacyToV2` は **現行 V2 キーを優先し、旧 v1 キーへフォールバック**する。
  - `expiresOn`→（無ければ）`expiresAt` / `amountYen`→`amount` / `memo`→`note` / `link`→`url`。
  - 日付は `YYYY-MM-DD` に正規化（`/` `.` 区切り・ISO・空を吸収。不正は `null`）。
- 結論: **エクスポート(V2形状) → インポートの往復で期限・金額を保持する**ことを正式な仕様とする。

### UI 役割分担
- ヒーローの統計カード（今月の未使用 / 期限切れ注意 / 期限未設定）は **KPI 表示専用（クリック不可）**。
- 絞り込み導線は **タブ 1 系統**（すべて / 今月 / 先の期限 / 期限切れ）に統一。「期限切れ」タブを新設。
- 統計カードとタブの機能を二重化しない。

### 状態管理方針（localStorage / hydration）
- 表示モード（cards/table）は **React state を唯一の真実**とする。
- localStorage は「マウント時に遅延初期化で一度読む／選択時に保存」のみ。**レンダー中の localStorage 直読みを禁止**。

### ポップアップ安全性
- 破壊的操作（インポート全置換）は `window.confirm` で確認し、視覚序列は安全な「マージ」を primary、「すべて置き換え」を danger とする。
- 必須項目は UI 表示（`*`）と実装バリデーションを一致させる（優待名・企業名）。

## 判断理由

- 正規化が旧キーのみ参照だったため、自前バックアップ（エクスポートJSON）の復元で期限/金額が全消失していた。バックアップ導線として致命的なので contract を明文化。
- 統計カードをタブのショートカットにすると「期限未設定だけ表示」等の期待を生むがフィルタが無く不整合になる。データ件数が少なく KPI は一覧性が本質のため、表示専用が最小で破綻しない（案A採用、ショートカット案B/折衷案Cは不採用）。
- localStorage 直読みは「保存値で描画／state で再レンダー」の乖離を生み、同値クリックで no-op→未反映バグになっていた。state を真実にすることで恒久解消。

## 影響範囲

- `app/tools/yutai-expiry/benefits/store.ts`（`coerceNumber`/`normalizeDate` 追加・export、`normalizeLegacyToV2` 改修）
- `app/tools/yutai-expiry/ToolClient.tsx`（viewMode 遅延初期化＋`selectViewMode`、overdue タブ、検索クリア、トグル状態色、ラベル統一）
- `app/tools/yutai-expiry/components/{EditBenefitDialog,ImportBenefitDialog}.tsx`（必須表示・語彙・エラー位置・確認）
- `app/tools/yutai-expiry/ToolClient.module.css`（コントロール高 `--ctl-h`、セグメント、ダイアログスクロール、トークン化）
- 互換性: 旧 v1 JSON は従来どおり取り込み可。V2 JSON の往復が新たに保持される（改善方向、破壊的変更なし）。

## 残課題

- 旧キー自動移行 `loadFromLocalStorage` は `getBenefitsSnapshot` から未接続（手動インポート以外でレガシー移行が走らない）。要否は別途判断。
- `fmtJPDate` と共通 `formatToolDate` の重複、`dueBadge` と overdue 判定の二重定義は将来統一候補（今回はスコープ外）。

## 関連

- Issue: （なし）
- PR: 本 PR
- 参照 docs: [docs-writing-workflow](../docs-writing-workflow.md)
