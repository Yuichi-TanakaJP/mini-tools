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

---

## 追記：2026-04-04 — `useState` lazy init と useEffect 後注入の使い分け

### 背景

`yutai-candidates`（優待カレンダー）に日興信用データ表示を追加した際、hydration mismatch が発生した。  
原因は `useState` の lazy init で localStorage を読んでいたこと。

```ts
// NG：サーバーは空 Set、クライアントは localStorage から読む → mismatch
const [pickedCodes, setPickedCodes] = useState<Set<string>>(() => loadPickedCodes());
```

### 決めたこと

`"use client"` コンポーネントでも SSR は動く。初回 HTML はサーバーとクライアントで一致している必要がある。

| 値の種類 | 対応 |
|---------|------|
| localStorage / window 依存の初期値 | `useState(空値)` + `useEffect` で後注入 |
| サーバーデータ不要・完全クライアント完結 | `ssr: false`（ClientOnly 方式） |

```ts
// OK：サーバーとクライアントの初期描画を空で揃え、マウント後に注入
const [pickedCodes, setPickedCodes] = useState<Set<string>>(new Set());

useEffect(() => {
  setPickedCodes(loadPickedCodes());
}, []);
```

### ツール別の使い分け

- `yutai-memo` / `yutai-expiry` / `charcount` / `total`：サーバーデータ不要 → `ssr: false`（ClientOnly）
- `yutai-candidates`：サーバーから月別データを受け取る → SSR 有効のまま、localStorage は useEffect で後注入

### 判断フロー

```
サーバーからデータを受け取るか？
  ├─ No  → ssr: false（ClientOnly 方式）
  └─ Yes → SSR 有効のまま
             localStorage 依存の初期値は useState(空値) + useEffect で後注入
```
