# 2026-08-23 MINKABU候補の公式月突合結果を表示から除外する互換運用

## 背景

MINKABUの月次候補は、公式サイトとの権利月突合が完了するまで数日から数週間かかる可能性がある。候補JSON全体を公式確認待ちにすると、ほぼ正しい候補までMini Toolsへ届けられず、月次の銘柄選定が遅れる。一方、公式確認で月違いと判定された候補を表示し続けると、誤ったクロス取引候補として検討される。

## 決定

- market_infoは候補レコードをJSONから削除せず、公式突合結果を `display_policy` などの任意フィールドとして保存する。
- `display_policy: "exclude"` の候補だけを `yutai-candidates` のdata-loaderで表示データから除外する。
- `display_policy` がない旧JSONは `include` として扱う。既存JSONの読み込み契約を壊さない。
- manifestの `visible_count` があれば月タブの表示件数に使い、旧manifestでは `count` を使う。
- UIに「除外済み候補を表示する」切替は追加しない。候補選定画面では誤候補を通常表示しないことを優先し、監査・復帰はmarket_info側の元JSON、sidecar、backupで行う。

## 影響範囲

- `app/tools/yutai-candidates/types.ts`
- `app/tools/yutai-candidates/data-loader.ts`
- `app/tools/yutai-candidates/ToolClient.tsx`
- `docs/specs/tools/yutai-dashboard.md`
- `docs/uat/yutai-candidates.md`

## 検証

- `npm test -- --run app/tools/yutai-candidates/__tests__/data-loader.test.ts`
- `display_policy: "exclude"` が1件、旧形式レコードが1件ある入力で、除外件だけ消え、旧形式は残ることを確認する。
