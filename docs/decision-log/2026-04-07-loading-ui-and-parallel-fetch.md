# 2026-04-07 loading.tsx 追加と並列 fetch 化

## 背景

- TOP から「株価ランキング」等の market tools をタップすると、画面遷移が始まる前に一瞬止まって見える問題が報告された
- 原因を調査した結果、2 つの要因が重なっていた：
  1. `loading.tsx` が存在せず、サーバー側の `loadData()` が完了するまで Next.js が旧画面を維持し続ける
  2. `loadRankingManifest()` と `loadJpxMarketClosedData()` などの独立した fetch が直列 `await` で実行されていた

## 今回決めたこと

### loading.tsx の追加対象

`async` Server Component をもつ全 5 ページに `loading.tsx` を追加する。

| ページ | loading.tsx | 備考 |
|---|---|---|
| `stock-ranking` | ✅ 追加 | |
| `nikkei-contribution` | ✅ 追加 | |
| `topix33` | ✅ 追加 | |
| `earnings-calendar` | ✅ 追加 | |
| `yutai-candidates` | ✅ 追加 | searchParams あり、同様に効果あり |
| `total` | — 不要 | Client Component のみ |
| `charcount` | — 不要 | Client Component のみ |
| `yutai-memo` | — 不要 | Client Component のみ |
| `yutai-expiry` | — 不要 | Client Component のみ |

### Promise.all 化の対象

manifest fetch と jpx-closed fetch の 2 つを並列化できる 3 ページに適用。

| ページ | 変更 |
|---|---|
| `stock-ranking` | `loadRankingManifest()` + `loadJpxMarketClosedData()` を `Promise.all` 化 |
| `nikkei-contribution` | `loadContributionManifest()` + `loadJpxMarketClosedData()` を `Promise.all` 化 |
| `topix33` | `loadTopix33Manifest()` + `loadJpxMarketClosedData()` を `Promise.all` 化 |
| `earnings-calendar` | fetch が 1 つのみ → 変更なし |
| `yutai-candidates` | fetch が 1 つのみ → 変更なし |

## 判断理由

- `loading.tsx` を置くだけで Next.js App Router が即時ローディング UI を表示する仕組みになる。実装コストが最小で、体感の改善効果が最大
- Client Component ページは SSR fetch がなく遷移が即座に始まるため対象外
- `nikkei-contribution` の先頭日付ループ（有効データ探索）は件数が少ない通常時は問題ないため今回は変更しない

## 影響範囲

- 各 `loading.tsx` は pure Server Component として扱われる（`"use client"` 不要）
- ローディング中は旧画面ではなく `loading.tsx` のスケルトン UI が表示される
- `Promise.all` 化により manifest + jpx-closed の fetch が並列実行されるため、API レスポンス待機時間が短縮される

## 残課題

- `nikkei-contribution` の先頭日付ループは API レスポンスが遅い場合に積み重なる可能性がある。件数増加時に要再検討
- `loading.tsx` のスケルトンは実際のレイアウトとの差分が大きい場合は見直す

## 関連

- PR: （このコミットの PR を参照）
- 参照 docs: [Market Tools データ取得経路一覧](../market-tools-data-fetch-paths.md)
