# 2026-07-12 取得実績の権利月ひもづけ（リード期間の当年寄せ）

## 背景

優待の取得実績（`ArchivedMemoItem.entitlementMonthKey`, YYYY-MM）は、取得日（`acquiredAt`）から `resolveEntitlementMonthKey()` で権利月を逆算していた。従来ロジックは「取得日以前の直近の権利月」に紐づけるため、権利確定より前（例: 一般信用クロスの仕込み時期）に取得済みにすると、**前年の権利月**として記録されていた。

例: 5月権利・3か月前仕込み（開始2月）の銘柄を 2026年2月に取得済みにすると `2025-05` になり、12ヶ月ビューの年度表示で狙っていた 2026年ではなく前年に取得マークが付いていた。

## 決めたこと

- `resolveEntitlementMonthKey(months, acquiredAt, preparationMonthsBefore?)` に任意引数 `preparationMonthsBefore` を追加する。
- 取得日が **仕込み開始〜権利月のリード期間**に入る場合は、「これから来る当年の権利月」に寄せる。リード期間より前は従来どおり前年の権利月、権利確定後は当年の権利月。
- `preparationMonthsBefore` 未指定（= 0 扱い）のときは従来動作を完全に維持する（後方互換）。年をまたぐリード（例: 2月権利・3か月前＝前年11月開始）も扱う。

## 理由

- 一般信用クロス等では権利確定前（仕込み時期）にポジションを確保し、その時点で「取得済み」とみなす運用がある。前年扱いになると年度別の取得実績がずれて見える。
- リード期間は銘柄ごとに `preparationMonthsBefore` で構造化済みなので、それを使えば「仕込み中の取得は次に来る権利」に正しく寄せられる。
- 既存データ・他ツール（優待メモ／期限帳）への影響を避けるため、引数は任意にして未指定時は従来動作にした。

## 影響範囲

- `app/tools/yutai-memo/date-utils.ts`（`resolveEntitlementMonthKey`）
- `app/tools/yutai-memo/ToolClient.tsx`（アーカイブ生成・重複判定の各呼び出しで `preparationMonthsBefore` を渡す）
- `app/tools/yutai-memo/storage.ts`（アーカイブ読み込み時の補完で memoId から仕込み月数も引く）
- 優待ダッシュボード 12ヶ月ビューは `entitlementMonthKey` を読むだけなので、この変更で年度表示が正しくなる（コード変更なし）

## 関連

- Decision Log: [2026-07-12 12ヶ月ビューの年度軸](./2026-07-12-yutai-dashboard-calendar-year-axis.md)
- Decision Log: [2026-07-03 優待の仕込み月表示軸](./2026-07-03-yutai-preparation-month-axis.md)
- 実装: [date-utils.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-memo/date-utils.ts)
