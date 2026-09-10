# カラーパレット設計書

この文書は色の実装契約を定める。画面全体の視覚原則は [UI デザインコンセプト](./ui-design-concept.md) を正とする。

## 採用テーマ

ユーザーが共通ヘッダーから次の表示テーマを選べる。

| 選択肢 | 適用テーマ | 挙動 |
|---|---|---|
| 端末設定 | Light / Dark | OS・ブラウザの `prefers-color-scheme` に追従する（初期値） |
| ライト | Light | 端末設定にかかわらず明るい配色に固定する |
| ダーク | Dark | 端末設定にかかわらず暗い配色に固定する |

- 選択値は `mini_tools_color_theme_v1` として LocalStorage に保存し、サーバーへ送信しない。
- 初回描画より前に保存値または端末設定を `<html data-theme>` へ反映し、明るい画面が一瞬表示されるフラッシュを抑える。
- `端末設定` 選択中は、ページを開いたまま端末設定が変わった場合も追従する。
- ブラウザの UI 色に使う `theme-color` も解決済みテーマに合わせる（Light `#ecf1f7` / Dark `#0d131c`）。

---

## 生成規則（この設計書の中心）

Light と Dark は別々に選んだ配色ではなく、**同じ hue 軸から明度だけを変えて生成した二つの表示モード**とする。
色は OKLCH（知覚的に均等な色空間）で決め、sRGB へ変換して `app/globals.css` に書き出す。

### 固定する軸

| 軸 | 値 | 対象 |
|---|---|---|
| Neutral hue | **256** | 面（bg 系）、本文、境界線、ヘッダー、neutral |
| Accent hue | **264** | accent 系、chart-1 |
| Semantic hue | info 255 / success 152 / warning 62 / error 25 | 状態色 |
| Financial hue | rise 32 / fall 252 | 騰落 |
| Chart hue | 264 / 205 / 155 / 95 / 35 / 320 | グラフ系列 |

**テーマを切り替えても hue は動かさない。** 動かすのは明度 (L) と、暗所で刺さらないための彩度 (C) だけ。
これが「ライトとダークで別サービスに見える」状態を防ぐ唯一の仕組みなので、
新しい色を足すときも先に上表のどの軸に属するかを決める。

### 面の明度ラダー

奥から手前へ、page → input → subtle → card → elevated の順で持ち上げる。
Light は白へ向かって、Dark は明るい方へ向かって、同じ順序で並ぶ。

| トークン | Light L | Dark L | 役割 |
|---|---|---|---|
| `--color-bg` | 95.6% | 18.5% | ページの地 |
| `--color-bg-input` | 97.0% | 22.5% | 入力欄（面に対してくぼませる） |
| `--color-bg-subtle` | 97.9% | 24.0% | カード内の弱い帯 |
| `--color-bg-card` | 100% | 27.5% | 通常カード |
| `--color-bg-elevated` | 100% | 31.5% | モーダル・ポップオーバー |

Dark では影がほぼ見えないため、奥行きは影ではなく**この明度差**で表す。
Light の card / elevated は同値なので、そちらは `--shadow-*` で差を付ける。

### 状態色の作り方

状態色は必ず foreground / bg / border / text の組で作り、同じ L・C を全 hue に適用する。

| 部品 | Light (L, C) | Dark (L, C) |
|---|---|---|
| foreground（アイコン・数値） | 48%, 0.17 | 74%, 0.14 |
| bg（チップ・バナー背景） | 96.5%, 0.035 | 28.5%, 0.055 |
| border | 88%, 0.075 | 42%, 0.085 |
| text（bg の上に置く文字） | foreground −14% | foreground +14% |

warning (hue 62) と success (hue 152) は同じ L だと他の hue より明るく見えるため、
foreground の L に Light +7 / +2、Dark −7 / −2 の補正を入れている。

### sRGB 範囲外の扱い

指定した (L, C, hue) が sRGB に収まらない場合は、**hue と L を保ったまま C だけを下げて**収める。
色相がずれると軸が崩れるので、hue と L は動かさない。

---

## Light

```css
--color-bg:               #ecf1f7;
--color-bg-input:         #f2f5fb;
--color-bg-subtle:        #f5f8fd;
--color-bg-card:          #ffffff;
--color-bg-elevated:      #ffffff;

--color-text:             #111b29;
--color-text-sub:         #3c495a;
--color-text-muted:       #606d7f;

--color-border:           #d5dbe4;
--color-border-strong:    #bcc5d1;
--color-border-control:   #7b8799;

--color-accent:           #265adf;
--color-accent-sub:       #e9f0ff;
--color-accent-hover:     #1745c2;
```

**雰囲気:** 明るい・信頼感・金融サービス寄り。青みグレー（slate 系）で統一する。

## Dark

```css
--color-bg:               #0d131c;
--color-bg-input:         #151c26;
--color-bg-subtle:        #18202a;
--color-bg-card:          #202833;
--color-bg-elevated:      #2a323e;

--color-text:             #e3e8f0;
--color-text-sub:         #b0b8c3;
--color-text-muted:       #939ca9;

--color-border:           #2e3641;
--color-border-strong:    #454e5a;
--color-border-control:   #6a7585;

--color-accent:           #5b8df9;
--color-accent-sub:       #182749;
--color-accent-hover:     #7fa9ff;
```

**雰囲気:** 暗いが黒ではない。Light と同じ青みグレーの軸を保った、落ち着いた夜間表示。

実値の正本は `app/globals.css`。上のブロックは代表値の抜粋であり、
全トークンを写経しない（二重管理を避ける）。

---

## 実装ルール

### トークン分類

| 分類 | 用途 | 代表トークン |
|---|---|---|
| Surface | ページ、弱い面、入力、カード、モーダル、overlay | `--color-bg*` |
| Text | 本文、補助、muted、反転文字 | `--color-text*` |
| Border / focus | 通常境界、強調境界、操作部品の輪郭、focus | `--color-border*`, `--color-focus-ring` |
| Action | ブランド、リンク、主要操作 | `--color-accent*` |
| Semantic | info / success / warning / error / neutral | `--color-*-bg/text/border` |
| Financial direction | 上昇 / 下落 | `--color-rise*`, `--color-fall*` |
| Data visualization | グラフ系列 | `--color-chart-1` ～ `6` |
| Elevation | カード、hover、モーダルの影 | `--shadow-*` |
| Global header | 固定ナビゲーション帯 | `--color-header-*` |

### 境界線 3 段の使い分け

| トークン | 用途 | コントラスト |
|---|---|---|
| `--color-border` | 装飾的な区切り線、カードの縁 | 基準なし |
| `--color-border-strong` | 強調したい区切り、選択中の縁 | 基準なし |
| `--color-border-control` | 入力欄・チェックボックスなど**操作できる部品の輪郭** | 背景に対し 3:1 以上 |

面に対して 3:1 が要るのは操作部品だけなので、装飾線に `--color-border-control` を使うと画面が硬くなる。逆に入力欄を `--color-border` で描くと、その欄が操作可能だと分からなくなる。

### 適用規約

1. ライトのトークンは `app/globals.css` の `:root`、ダークのトークンは `html[data-theme="dark"]` に同じ役割名で定義する。
2. 共通 UI と各画面は、面・本文・境界線・主要操作に色リテラルを使わず、役割トークンを参照する。
3. 状態表示は `bg / text / border` の組を使用し、単一の色を別背景へ流用しない。
4. `--color-error` を標準名とし、既存の `--color-danger` は移行中の互換 alias とする。
5. グラフ系列色、ロゴ、ゲーム固有色などは直書きを許容できるが、本文やカードへ流用しない。
6. テーマ選択 UI は `components/ColorThemeSelector.tsx`、初回描画前の適用は `lib/color-theme.ts` と `app/layout.tsx` が担当する。
7. 保存値が壊れている場合や LocalStorage が利用できない場合は `端末設定` と同じ解決方法へフォールバックする。
8. 値を変えるときは上の生成規則に従い、`lib/__tests__/theme-contrast.test.ts` を通してから確定する。

### 廃止した配色

- **Pattern C — Midnight Navy**: 3 つ目の独立した配色として持つと軸が増えるだけなので、候補から外した。
  ネイビー寄りにしたい場合は neutral hue 256 の彩度を上げる形で表現する。
- **旧 Dark（GitHub 由来の `#0d1117` 系）**: neutral の彩度が Light の半分以下で、
  同じ製品に見えないことが今回の作り直しの直接の原因だった。[判断記録](../../decision-log/2026-09-11-unified-color-theme.md)

---

## 確認項目

- ヘッダーの選択を「ダーク」にすると、ホーム背景・カード・文字・モバイル下部ナビが暗い配色になる。
- 再読み込みしても明るい画面を一瞬挟まず、保存したテーマが維持される。
- 「ライト」は端末がダーク設定でもライトを維持する。
- 「端末設定」は端末のライト / ダーク変更に追従する。
- キーボード操作で選択でき、フォーカス位置が見える。
- LocalStorage が利用できなくても画面操作を妨げない。
- `npm run test` で `theme-token-contract` と `theme-contrast` が通る。

## 関連

- [表示テーマ切替の設計判断](../../decision-log/2026-08-30-global-color-theme-selector.md)
- [テーマトークン基盤の設計判断](../../decision-log/2026-09-03-theme-token-foundation.md)
- [Light / Dark を同一 hue 軸から生成する判断](../../decision-log/2026-09-11-unified-color-theme.md)
- [UI デザインコンセプト](./ui-design-concept.md)
- [Product Spec](../../product-spec.md)
