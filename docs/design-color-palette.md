# カラーパレット設計書

## 採用パターン

現在採用中: **Pattern A — Light Blue**

変更する場合はこのドキュメントのパターンを参照し、
`app/globals.css`（または CSS 変数ファイル）の値を差し替える。

---

## Pattern A — Light Blue（採用中）

決算カレンダーのカラーパレットを全体の基準として採用。
他ページ（TOP・合計計算・文字数カウント）はこの変数を参照することで自動的に統一される。

```css
--color-bg:           #eef2f7;              /* ページ背景（青みグレー） */
--color-bg-card:      #ffffff;              /* カード・パネル */
--color-bg-input:     #f4f6fb;              /* 入力欄・サブ背景 */

--color-text:         #1f2937;              /* メインテキスト */
--color-text-sub:     #374151;              /* サブテキスト */
--color-text-muted:   #6b7280;              /* 薄いテキスト・ラベル */

--color-border:       rgba(15, 23, 42, 0.08);  /* 通常ボーダー */
--color-border-strong:rgba(15, 23, 42, 0.14);  /* 強調ボーダー */

--color-accent:       #2554ff;             /* アクセント（ボタン・リンク） */
--color-accent-sub:   #eef2ff;             /* アクセント薄（チップ・バッジ背景） */
--color-accent-hover: #1d44d8;             /* アクセントホバー */

--color-error:        #dc2626;             /* エラー・オーバー */
--color-success:      #16a34a;             /* 成功（Toast等） */
--color-warning:      #d97706;             /* 警告（期限近い等） */
```

**雰囲気:** 明るい・信頼感・金融サービス寄り
**参考:** 決算カレンダー画面の既存カラーパレットをそのまま採用

---

## Pattern B — Dark（候補）

GitHub / Bloomberg ライクなプロ感。「かっこいい・クール」重視。

```css
--color-bg:           #0d1117;
--color-bg-card:      #161b22;
--color-bg-input:     #21262d;

--color-text:         #e6edf3;
--color-text-sub:     #8b949e;
--color-text-muted:   #6e7681;

--color-border:       #30363d;
--color-border-strong:#484f58;

--color-accent:       #58a6ff;
--color-accent-sub:   #1c2d3e;
--color-accent-hover: #79baff;

--color-error:        #f85149;
--color-success:      #3fb950;
--color-warning:      #d29922;
```

**雰囲気:** ダーク・プロフェッショナル・ターミナル感
**切り替えコスト:** 高（画像・アイコンの色も要確認）

---

## Pattern C — Midnight Navy（候補）

金融ダッシュボード寄り。暗すぎず白すぎない折衷案。

```css
--color-bg:           #0f1729;
--color-bg-card:      #1a2744;
--color-bg-input:     #1e2f52;

--color-text:         #e2e8f0;
--color-text-sub:     #94a3b8;
--color-text-muted:   #64748b;

--color-border:       #2d3f6b;
--color-border-strong:#3d5490;

--color-accent:       #60a5fa;
--color-accent-sub:   #1e3058;
--color-accent-hover: #93c5fd;

--color-error:        #f87171;
--color-success:      #4ade80;
--color-warning:      #fbbf24;
```

**雰囲気:** ネイビー・落ち着き・投資ダッシュボード感
**切り替えコスト:** 高（Pattern B と同様）

---

## パターン切り替え方法

1. `app/globals.css` の `:root { }` 内の変数値を上記パターンの値に差し替える
2. ダーク系（B/C）に切り替える場合は `<html>` の `style` や `body` 背景も変更が必要

---

## 派生ルール

芯の4色から残りを導く考え方：

| トークン | 導き方 |
|---|---|
| `bg-input` | `bg` より少し暗め |
| `text-sub` | `text` を40%薄く |
| `text-muted` | `text` を60%薄く |
| `border` | `bg` を少し暗く |
| `accent-sub` | `accent` を90%薄く（背景用） |
| `accent-hover` | `accent` を10%暗く |
| `error` | 赤系・変更不要なことが多い |
