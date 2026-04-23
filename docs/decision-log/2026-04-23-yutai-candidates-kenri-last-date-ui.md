# 2026-04-23 yutai-candidates の権利付き最終日 UI 表示

## 背景

- `yutai-candidates` は権利付き最終日を内部ロジックで計算し、初期表示月の切り替え判定に使っていた。
- 一方で UI には `○月権利` までしか出ておらず、ユーザーが「その月の締切が何日か」を画面上で確認できなかった。
- issue #269 では、まず表示月に対応する権利付き最終日を UI に出す暫定対応を行うことにした。

## 今回決めたこと

- `yutai-candidates` では、表示月に対応する権利付き最終日を画面上に明示する。
- 日付は `権利付き最終日: 3/27` のように、表示月セクションの近くに出す。
- 当面は既存のローカル計算ロジックをそのまま使い、API や月次 JSON の contract は変更しない。
- 計算結果は server 側で `MonthlyYutaiPageData` に載せて client へ渡す。

## 判断理由

- すでに server 側で表示月を決めるために計算しているため、同じ値を page data に載せるのが最も小さい変更で済む。
- UI で再計算させるより、SSR で確定した表示値を渡す方が hydration や責務の面で分かりやすい。
- 将来の恒久対応で API 側 contract を持たせる可能性はあるが、現時点ではまずユーザーが締切日を見られることを優先する。

## 影響範囲

- [data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/data-loader.ts)
- [types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/types.ts)
- [ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/ToolClient.tsx)
- [yutai-candidates.md](/c:/Users/yutaz/dev/mini-tools/docs/uat/yutai-candidates.md)

## 残課題

- `権利落ち日` や `権利確定日` をどの contract で扱うかは別 issue #270 で整理する。
- API / manifest / 月次 JSON に日付情報を持たせる恒久対応はこの decision には含めない。

## 関連

- Issue:
  - #269
  - #270
- 参照 docs:
  - [Docs Writing Workflow](/c:/Users/yutaz/dev/mini-tools/docs/docs-writing-workflow.md)
  - [優待カレンダー UAT チェックリスト](/c:/Users/yutaz/dev/mini-tools/docs/uat/yutai-candidates.md)
