# 2026-05-30 ルーター遷移の押下フィードバック共通化（useRouterTransition + pendingKey）

## 背景

- 各ツールの月切り替え・日付切り替え・タブ切り替え等で `router.push` / `router.replace` を使っている。
- 遷移完了までに時間がかかる場合、UI 上で「操作を受け付けた」感が出ず、ユーザーが「無反応」と感じる。
- `loading.tsx` は配置済みだが、**同一ページ内の searchParams 変更やキャッシュ済み遷移では押下直後のフィードバックとしては頼りにくい**（押したコントロール単位の即時フィードバックには別途仕組みが必要）。
- 既存対応はツールごとにバラバラ：
  - econ-calendar: disabled + 「読み込み中…」テキスト
  - earnings-calendar / market-rankings: disabled のみ
  - yutai-candidates / tdnet-disclosures: フィードバックなし

## 今回決めたこと

- `app/tools/_shared/use-router-transition.ts` を新設し、ルーター遷移を `useTransition` で包む共通フックとする。
- フックの API:
  - `navigate(href, { key?, method? })`：`method` は `"push" | "replace"`、既定は `"push"`
  - `isPending`：遷移中フラグ（singleton）
  - `pendingKey`：直近に押した対象のキー
  - `isPendingFor(key)`：押下対象の識別用（チップ・タブ・ボタン単位で視覚化するため）
- 視覚パターン:
  - 押した対象のみ `opacity: 0.55` + `cursor: wait` + `disabled` + `aria-busy`
  - **全ボタン一律 disabled にはしない**（雑な UI を避けるため）
- 履歴挙動を変えない:
  - 既存が `replace` のものは `replace`、`push` のものは `push` をそのまま使う。

## 判断理由

- `useTransition` は React 標準で副作用が少なく、遷移完了で自動的に `isPending=false` に戻る。
- `isPending` は singleton なので、押下対象を識別したい場合は `pendingKey` を別 state で持つ必要がある。これを共通フック内に閉じ込めることで、各ツールでの重複を防ぐ。
- `loading.tsx` だけでは「押した瞬間」のフィードバックを保証できないため、操作単位のフィードバックを別レイヤーで持つ。
- 一律 disabled / グレーアウトは「どこを押したか分からない」体験になるため避ける。

## 影響範囲

### PR1（pilot）

- 追加: [app/tools/_shared/use-router-transition.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/_shared/use-router-transition.ts)
- 適用: [app/tools/yutai-candidates/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/ToolClient.tsx)（月チップ）

### PR2 以降（展開予定）

- tdnet-disclosures: 日付適用 / 前日 / 翌日 / range / クリア
- market-rankings: 月ナビ + ランキング種別タブ
- 必要に応じて earnings-calendar / econ-calendar の方式も統一

## 残課題

- 他ツールへの展開は PR を分けて段階適用する（pilot で問題が出れば API を見直す）。
- 「ボタン以外（select 等）」のフィードバックは pending スコープ外。必要になれば検討。
