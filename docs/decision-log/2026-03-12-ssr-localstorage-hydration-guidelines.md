# SSR / Hydration / localStorage の運用ガイド（#24）

## 背景

- `localStorage` を使うツールで hydration mismatch が発生しうる状態だった。
- 対象は `charcount` / `total` / `yutai-expiry`。

## 整理した前提

- SSR は「サーバーで初期HTMLを作ること」。
- hydration は「クライアントがそのHTMLを引き継いで有効化すること」。
- 問題の本質は再レンダリングそのものではなく、サーバー初期HTMLとクライアント初期描画の不一致。

## なぜ localStorage が衝突するか

- `localStorage` はブラウザ専用で、サーバーは直接読めない。
- そのためサーバー描画結果と、クライアントで `localStorage` を読んだ後の描画結果がズレると mismatch になる。

## 採用方針

1. `localStorage` 依存UIは `ClientOnly` 経由で描画する。
2. `page.tsx` は Server Component の入口として保ち、`next/dynamic(..., { ssr: false })` で Client 側に寄せる。
3. SSR と一致が必要な状態は将来的に cookie を検討する（`localStorage` のままサーバーへ送る設計は採用しない）。

## 今回の実装

- `app/tools/charcount`: `page.tsx` を Server 化し `ClientOnly` + `ToolClient` 構成へ変更
- `app/tools/total`: `page.tsx` を Server 化し `ClientOnly` + `ToolClient` 構成へ変更
- `app/tools/yutai-expiry`: `ToolClient` 直描画をやめ、`ClientOnly` 経由に統一

## 運用ルール（再発防止）

- `localStorage`, `window`, `navigator` 前提ロジックをページ直下に置かない。
- 画面骨格は Server、ブラウザ依存部分のみ Client に分離する。
- 初期描画差分を作る値（日時/乱数/環境依存値）は SSR 側で直接UIに出さない。
