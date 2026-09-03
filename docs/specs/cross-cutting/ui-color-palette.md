# カラーパレット設計書

## 採用テーマ

ユーザーが共通ヘッダーから次の表示テーマを選べる。

| 選択肢 | 適用テーマ | 挙動 |
|---|---|---|
| 端末設定 | Light Blue / Dark | OS・ブラウザの `prefers-color-scheme` に追従する（初期値） |
| ライト | Light Blue | 端末設定にかかわらず明るい配色に固定する |
| ダーク | Dark | 端末設定にかかわらず暗い配色に固定する |

- 選択値は `mini_tools_color_theme_v1` として LocalStorage に保存し、サーバーへ送信しない。
- 初回描画より前に保存値または端末設定を `<html data-theme>` へ反映し、明るい画面が一瞬表示されるフラッシュを抑える。
- `端末設定` 選択中は、ページを開いたまま端末設定が変わった場合も追従する。
- ブラウザの UI 色に使う `theme-color` も解決済みテーマに合わせる。

---

## Pattern A — Light Blue（ライトテーマ）

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

--color-rise-bg:      #fee2e2;             /* 上昇バッジ背景 */
--color-fall-bg:      #dbeafe;             /* 下落バッジ背景 */
--color-fall-text:    #2563eb;             /* 下落文字色 */
```

**雰囲気:** 明るい・信頼感・金融サービス寄り
**参考:** 決算カレンダー画面の既存カラーパレットをそのまま採用

---

## Pattern B — Dark（ダークテーマ）

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
**用途:** 夜間・暗所・光刺激を抑えたい場合の明示選択

---

## Pattern C — Midnight Navy（将来候補・未実装）

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

## 実装ルール

1. ライトのトークンは `app/globals.css` の `:root`、ダークのトークンは `html[data-theme="dark"]` に定義する。
2. 共通 UI とホーム画面は、原則として直書き色ではなく `--color-*` トークンを参照する。
3. テーマ選択 UI は `components/ColorThemeSelector.tsx`、初回描画前の適用は `lib/color-theme.ts` と `app/layout.tsx` が担当する。
4. 保存値が壊れている場合や LocalStorage が利用できない場合は `端末設定` と同じ解決方法へフォールバックする。
5. 新しいテーマを追加するときは、本文・カード・入力欄・境界線・フォーカス表示が各テーマで判読できることを確認する。

## 確認項目

- ヘッダーの選択を「ダーク」にすると、ホーム背景・カード・文字・モバイル下部ナビが暗い配色になる。
- 再読み込みしても明るい画面を一瞬挟まず、保存したテーマが維持される。
- 「ライト」は端末がダーク設定でもライトを維持する。
- 「端末設定」は端末のライト / ダーク変更に追従する。
- キーボード操作で選択でき、フォーカス位置が見える。
- LocalStorage が利用できなくても画面操作を妨げない。

## 関連

- [表示テーマ切替の設計判断](../../decision-log/2026-08-30-global-color-theme-selector.md)
- [Product Spec](../../product-spec.md)

---

## 派生ルール

芯の4色から残りを導く考え方：

| トークン | 導き方 |
|---|---|
| `bg-input` | `bg` より少し暗め |
| `text-sub` | `text` より一段弱いが、本文として読めるコントラストを保つ |
| `text-muted` | 補助ラベルとして読めるコントラストを保つ |
| `border` | `bg` を少し暗く |
| `accent-sub` | `accent` を90%薄く（背景用） |
| `accent-hover` | `accent` を10%暗く |
| `error` | 赤系・変更不要なことが多い |
