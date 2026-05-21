# 2026-05-20 優待期限台帳 消費モデル（枚数/金額・履歴）

## 背景

- 対象 tool: 優待期限台帳 `/tools/yutai-expiry`
- これまで `isUsed`（全消費 bool）のみで、QUOカードのように「複数枚を1枚ずつ使う」「部分的に残額が残る」「あとで追加でもらう」を表現できなかった。
- ユーザー要望: ケースバイケース。割り切り（枚数）でもやり切り（金額残高）でも対応したい。簡易履歴も欲しい。
- 関連: [2026-05-19 優待期限台帳 UI と入出力データ方針](./2026-05-19-yutai-expiry-ui-and-data-policy.md)

## 今回決めたこと

### データモデル（`BenefitItemV2` に optional 追加・後方互換）
- `trackMode: "count" | "amount"`（既定 `count`）
- `unitYen: number | null`（count: 1枚あたり額面 / amount: 未使用）
- `initial: number | null`（初期値の基準）
- `remaining: number | null`（count: 残枚数 / amount: 残円）
- `history: UsageEntry[]`（`{ at, deltaQty?, deltaYen?, note? }`）
- `isUsed` は廃止せず **`remaining <= 0` の派生**として常に同期。既存フィルタ/ソートの互換を保つ。
- 旧 `quantity`/`amountYen` は legacy 入力としてのみ読む（今後は書かない）。

### 移行ルール（normalize / 旧 v2 補完の双方）
- `trackMode` = `obj.trackMode === "amount" ? "amount" : "count"`
- count: `unitYen = obj.unitYen ?? amountYen ?? amount`、`initial = obj.initial ?? quantity ?? (isUsed?0:1)`、`remaining = obj.remaining ?? (isUsed?0:initial)`
- amount: `initial = obj.initial ?? amountYen ?? amount`、`remaining = obj.remaining ?? (isUsed?0:initial)`、`unitYen=null`
- 単発クーポン（quantity 無し）は count・initial=1 として扱う。
- `normalizeLegacyToV2` に新フィールドのフォールバックを追加し、**エクスポート往復で保持**（前回方針と一貫）。

### 操作（純関数で item を返す）
- `consume(item, amount, note)`：残から減算（負にしない）、履歴追記、`isUsed` 再計算
- `restock(item, amount, note)`：残に加算、履歴追記
- `setUsedAll(item, used)`：使用済みトグル＝ remaining を 0 or initial に、履歴追記

### UI
- 追加/編集ダイアログに「管理方法」トグル（枚数/金額）。枚数→枚数＋1枚あたり額面(任意)、金額→残高(円)。
- カード/行：`残3枚 ¥1,000（合計¥3,000）` / `残高 ¥700`。`[使う▾]`（1枚/枚数指定/全部、金額は額入力）, `[＋追加]`, 編集, 削除。
- 簡易履歴：折りたたみ表示（日時・増減・自動メモ）。
- 統計に「未使用合計額」「今月失効する金額」を追加。

## 判断理由

- 単一プリミティブに寄せきると QUO 部分消費を失う／金額固定だと枚数管理が煩雑。**item ごとに count/amount を選ぶ二択**が、割り切りとやり切りを同一の器（履歴・統計・移行）で両立できる最小設計。
- `isUsed` を派生で残すことで、既存の `showUsed`・タブ・ソートを作り直さずに済む（手戻り最小）。
- 履歴は `UsageEntry` の単純配列に限定（バックエンド無し・localStorage 前提のため軽量に割り切り）。

## 影響範囲

- `app/tools/yutai-expiry/benefits/store.ts`（型・migrate・normalize・consume/restock/setUsedAll・value 計算）
- `app/tools/yutai-expiry/ToolClient.tsx`（統計、カード/テーブル表示、操作、履歴、ダイアログ連携）
- `app/tools/yutai-expiry/components/EditBenefitDialog.tsx`（管理方法トグル・入力）
- 互換性: 旧 v1 / 旧 v2 / 旧エクスポート JSON はすべて移行ルールで取り込み（破壊的変更なし）。

## 残課題

- レガシー自動移行 `loadFromLocalStorage` 未接続は本件スコープ外（前回 decision-log の残課題のまま）。

## 改訂（2026-05-20 後追い）

- 「使う / ＋追加」の入力 UI を `window.prompt` から専用ダイアログ `UsageDialog` に置換。
  - 理由: prompt は入力 UI なのにブラウザ標準警告のように見え、初見では「エラーが出た」と誤解されやすかった。
  - 仕様: 残量表示、クイック入力チップ（金額は `¥100/¥500/¥1000`、枚数は `1/5/10`、「使う」では「全部」も）、任意メモ入力、エラーは role="alert"。
- 履歴を**取り消し可**にした（`removeHistoryEntry`）。
  - 仕様: 履歴1件あたり ✕ ボタン → `window.confirm` → 残った履歴を `initial` から再生して `remaining` を再計算（**削除順非依存**、0 下限）。
  - 編集はサポートせず、取り消し → 入力し直しで運用する（割り切り）。
- `UsageDialog` の count モードに「**金額（円）での入力**」を追加。
  - `unitYen` が設定されているとき、円入力を `Math.round(yen / unitYen)` で枚数換算して `consume`/`restock` を呼ぶ。
  - 換算結果はメモに自動追記（例: `¥3,000 相当（@¥1,000 → 3枚）`）。
  - `unitYen` 未設定時は入力欄を無効化＋ヒント表示。枚数と金額の両方入力時は金額を優先（混乱回避）。

## 関連

- Issue: なし
- PR: 本 PR
- 参照 docs: [2026-05-19 UI と入出力データ方針](./2026-05-19-yutai-expiry-ui-and-data-policy.md) / [docs-writing-workflow](../docs-writing-workflow.md)
