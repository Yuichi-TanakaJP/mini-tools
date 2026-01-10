# yutai-expiry Table UI WIP notes (from mixed branch experiments)

## スコープ

- date 入力の自由形式パース → ISO 正規化
- hidden date input + showPicker の実装メモ
- bundles（複数券種）入力 UI のクラス構成
- 追加/編集モード分岐の設計メモ

---

## parseFlexibleDateToISO（許容形式案）

許容:

- `YYYY-MM-DD` / `YYYY/MM/DD` / `YYYY.MM.DD`
- `YYYYMMDD`
- `M/D`（年省略 → 今年扱い）
- `M月D日`（年省略 → 今年扱い）
  方針:
- 不正日付は弾く（例: 2026-02-30）
- 空文字は `null` 扱い（期限なし）

UI 側:

- 手入力はそのまま受ける
- onBlur で `YYYY-MM-DD` に正規化できたら draft を更新
- 正規化できない場合は validateDraft 側でエラー表示（onBlur で即エラー表示も将来検討）

---

## normalizeISOOrEmpty（挙動メモ）

目的:

- hidden date input の value に入れるため `YYYY-MM-DD` 形式だけ通す
- それ以外（自由入力中）は空を返し、picker とテキストの状態が衝突しないようにする

---

## 📅 ボタン + hidden date input 実装メモ

構成:

- テキスト入力（自由形式） + ボタン（📅） + hidden date input
- ボタン押下時に `showPicker()` があれば呼ぶ、無ければ click などでフォールバック

注意:

- iOS/ブラウザ差分があるのでフォールバック必須
- hidden input は tabIndex=-1 / aria-hidden にして、フォーカス導線を壊さない

CSS（候補）:

- `.dateField`, `.dateText`, `.calendarBtn`, `.datePickerHidden`

---

## bundles UI クラス名（候補）と意図

- `.bundlesBox` : 入力ブロックの枠
- `.bundlesHeader` / `.bundlesTitle` : 見出し
- `.bundlesList` : 行のリスト
- `.row3` : amount / quantity / 操作ボタン（削除等）を並べる
- 日付入力のために `.dateField` / `.dateText` / `.calendarBtn` も併用

---

## 追加/編集モード分岐（案）

- editMode === "edit"
  - 従来の quantity/amount を編集（bundles は使わない or 互換用に 1 行だけ維持）
- editMode === "add"
  - bundles を編集対象にする（複数券種入力）

Draft 整合:

- 型都合で Draft は bundles を常に持つ（編集時は 1 行 or 空）
- どの時点で単一字段（quantity/amount）と bundles を同期するかは要整理
