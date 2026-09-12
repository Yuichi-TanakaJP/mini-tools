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
| Semantic hue | info 255 / success 152 / warning 62 / error 16 | 状態色 |
| Financial hue | rise 29 / fall 252 | 騰落 |
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

`--color-bg-emphasis` はこのラダーの外。**両テーマで濃いまま**にする面で、
上に置く文字は `--color-text-on-emphasis` を使う。数値を目立たせる帯など、
明暗を反転させて強調したい場所のためのもの。`--color-text-inverse` を
直書きの濃い面に重ねると、Dark で「暗い面に暗い文字」になるので使わない。

Dark では影がほぼ見えないため、奥行きは影ではなく**この明度差**で表す。
Light の card / elevated は同値なので、そちらは `--shadow-*` で差を付ける。

### 状態色・騰落の作り方

状態色と騰落は必ず foreground / bg / border / text の組で作る。まず全 hue 共通の基準値を置く。

| 部品 | Light (L, C) | Dark (L, C) |
|---|---|---|
| foreground（アイコン・数値） | 48%, 0.17 | 74%, 0.14 |
| bg（チップ・バナー背景） | 96.5%, 0.035 | 28.5%, 0.055 |
| border | 88%, 0.075 | 42%, 0.085 |
| text（bg の上に置く文字） | foreground −14% | foreground +14% |

そのうえで、**役割の強さに応じて彩度に倍率をかける**。同じ青・同じ赤が並んでも役割が読み分けられるのは、
色相ではなくこの彩度差による。

| 系統 | 彩度倍率 | 理由 |
|---|---|---|
| rise / fall | ×1.12 | 一目で読む信号。いちばん彩度が高い |
| success | ×1.00 | 基準 |
| warning | Light ×1.00 / **Dark ×0.65** | 下の「暖色は暗所で強く出る」を参照 |
| error | ×0.88 | 警告だが騰落の赤より一段落とす |
| info | ×0.65 | 「情報」であって警報ではない。いちばん静か |

明度も、hue ごとの見た目の明るさの差を吸収するために補正する（値は Light 基準、Dark は符号反転）。

| 系統 | 明度補正 | 理由 |
|---|---|---|
| warning | +7 | hue 62 は同じ L だと茶色に沈む |
| rise / fall | +6（Light のみ） | 一目で読む信号なので明るい側に置く。Dark は既に L74 で十分明るい |
| error | +3 | 騰落の赤と明度でも差をつける |
| success | +2 | hue 152 のわずかな沈みを補正 |

### 暖色は暗所で強く出る

`warning` だけ Light と Dark で彩度倍率が違う。暗い地の上では暖色の彩度が強く感じられ、
同じ値でもライトより刺さって見えるため、Dark 側だけ ×0.65 に落としている。

警告は「注意して」であって「エラー」ではないので、状態色の中では本来いちばん
落ち着いていてよい。色相（琥珀）は動かさないので、警告という意味は変わらない。

色相をずらして静かにする案（金・マスタード寄り）も検討したが、
「警告」ではなく「補足」に見える方向へ寄るため採らなかった。

### 前景色を「塗り」に流用しない

状態色には 5 つの部品がある。**役割が違うので入れ替えられない。**

| トークン | 何に使うか | 明るさの狙い |
|---|---|---|
| `--color-success` | 明るい面に乗る文字・アイコン・細い線 | 面に対して読めるよう**暗め** |
| `--color-success-text` | `-bg` の上に置く文字 | さらに暗い |
| `--color-success-bg` | チップ・バナーの淡い背景 | ごく淡い |
| `--color-success-border` | その境界 | 中間 |
| `--color-success-solid` | **7〜12px の点・丸など塗りつぶしマークの地** | 一目で気づけるよう**鮮やか** |

前景色を塗りに使うと沈む。実際、優待カレンダーのマークでこれをやってしまい、
オレンジは明度が **22 ポイント**、グリーンは **13 ポイント**落ちて、
利用者から「色が弱くなった」と指摘された。

`-solid` は「必ず前景色より彩度が高い」ことを `theme-contrast.test.ts` で保証している。

`-solid` の上に短いグリフ（✓ など）を置く場合は `--color-text-inverse` を使う。
ライトでは白、ダークでは濃い字になり、どちらの地でも読める側に倒れる。
**長い文章は `-solid` の上に置かない。** 鮮やかさを優先しているので、
本文に必要な 4.5:1 を満たさない組み合わせがある（特に warning）。
文章を載せるときは `-bg` と `-text` の組を使う。

### 役割の違う色が混ざらないこと

ブランドが青で、日本株の下落も青なので、accent / info / fall は必然的に近い色になる。
同様に rise（上昇＝赤）と error も近い。ここは**明度比では測れない**（同じ明度なら色相が違っても比は 1.0 付近になる）ので、
Oklab 上の距離 dE で 0.045 以上を保つ。上の彩度倍率と明度補正は、この距離を作るための調整でもある。

`rise` を赤から外して距離を稼ぐことはしない。日本株の「上昇＝赤」は動かさない前提とする。

距離を測るのは**取り違えると利用者が損をする組**だけにする。
琥珀系（`warning` / `severity-3` / `chart-10`）は Light でほぼ同色（dE 0.009〜0.033）だが、
どれも「注意・中間」を意味していて矛盾しないので、離す対象にしない。
「青いのに下落ではない」「赤いのにエラーではない」のような**意味が食い違う組**が対象。

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

--color-info:             #2e5e9a;
--color-error:            #aa3848;
--color-rise:             #c52d22;
--color-fall:             #006fc8;
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

--color-info:             #84aee4;
--color-error:            #e48087;
--color-rise:             #fe8070;
--color-fall:             #65afff;
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
| Text | 本文、補助、muted、無効、反転文字 | `--color-text*` |
| Border / focus | 通常境界、強調境界、操作部品の輪郭、focus | `--color-border*`, `--color-focus-ring` |
| Action | ブランド、リンク、主要操作 | `--color-accent*` |
| Semantic | info / success / warning / error / neutral | `--color-*-bg/text/border` |
| Semantic（塗り） | 小さな塗りつぶしマークの地 | `--color-*-solid` |
| Financial direction | 上昇 / 下落 | `--color-rise*`, `--color-fall*` |
| Data visualization（分類） | グラフ系列 | `--color-chart-1` ～ `12` |
| Data visualization（順序） | 重要度・深刻度の段階 | `--color-severity-1` ～ `5` |
| Elevation | カード、hover、モーダルの影 | `--shadow-*` |
| Global header | 固定ナビゲーション帯 | `--color-header-*` |

### 文字 4 段の使い分け

| トークン | 用途 | コントラスト |
|---|---|---|
| `--color-text` | 本文・見出し | 4.5:1 以上 |
| `--color-text-sub` | 補助的な本文 | 4.5:1 以上 |
| `--color-text-muted` | ラベル、注記、出典 | 4.5:1 以上 |
| `--color-text-disabled` | **無効化された操作の文字** | 約 2.4:1（意図的に下げる） |

`--color-text-disabled` だけはコントラスト基準を満たさない。無効な操作は「押せない」ことが
伝わる必要があり、WCAG も無効化された部品を対象外としているため。
読ませたい文字に流用しない。

### グラフ色は「分類」と「順序」を分ける

| 種類 | トークン | 使う場面 |
|---|---|---|
| 分類（categorical） | `--color-chart-1` ～ `6` | 業種、投資主体、銘柄など、順序のない区別 |
| 分類・拡張 | `--color-chart-7` ～ `12` | 系列が 6 を超えるときだけ。既存 6 色の中間の色相 |
| 順序（sequential） | `--color-severity-1` ～ `5` | 重要度、深刻度など、強弱に意味がある段階 |

順序尺度を chart 系列で表すと「色が違う＝別カテゴリ」に見えてしまい、段階であることが伝わらない。
`--color-severity-*` は 1 が最も弱く 5 が最も強い。**強さは明度差ではなく彩度で伝える**ため、
1・2 は中立色、3 以降が警告色になる。`severity-1` は「弱いこと」を示す役割なので 3:1 を求めない。

### 境界線 3 段の使い分け

| トークン | 用途 | コントラスト |
|---|---|---|
| `--color-border` | 装飾的な区切り線、カードの縁 | 基準なし |
| `--color-border-strong` | 強調したい区切り、選択中の縁 | 基準なし |
| `--color-border-control` | 入力欄・チェックボックスなど**操作できる部品の輪郭** | 背景に対し 3:1 以上 |

面に対して 3:1 が要るのは操作部品だけなので、装飾線に `--color-border-control` を使うと画面が硬くなる。逆に入力欄を `--color-border` で描くと、その欄が操作可能だと分からなくなる。

### ヘッダーだけ半透明を残す

面（`--color-bg*`）と境界線は不透明に統一するが、`--color-header-*` だけは半透明のままにする。
共通ヘッダーは `backdropFilter: blur(14px)` を敷いた帯で、不透明にすると blur が効かなくなり、
スクロール中にコンテンツが下を通る表現が消えるため。両テーマで同じ値を使う。

半透明トークンのコントラストは、**いちばん明るい下地（白）にヘッダーを合成し、その面の上に文字を重ねた**
最悪ケースで検証する。

### 適用規約

1. ライトのトークンは `app/globals.css` の `:root`、ダークのトークンは `html[data-theme="dark"]` に同じ役割名で定義する。
2. 共通 UI と各画面は、面・本文・境界線・主要操作に色リテラルを使わず、役割トークンを参照する。
3. 状態表示は `bg / text / border` の組を使用し、単一の色を別背景へ流用しない。
4. `--color-error` を標準名とし、既存の `--color-danger` は移行中の互換 alias とする。
5. グラフ系列色、ロゴ、ゲーム固有色などは直書きを許容できるが、本文やカードへ流用しない。
6. テーマ選択 UI は `components/ColorThemeSelector.tsx`、初回描画前の適用は `lib/color-theme.ts` と `app/layout.tsx` が担当する。
7. 保存値が壊れている場合や LocalStorage が利用できない場合は `端末設定` と同じ解決方法へフォールバックする。
8. ツール固有の色を足す前に、既存の役割トークンで表せないかを先に確認する。
   グラフ系列・ゲーム・ブランド以外で新しい色リテラルを増やさない。
9. 値を変えるときは上の生成規則に従い、`lib/__tests__/theme-contrast.test.ts` を通してから確定する。
   このテストはコントラストのほか、neutral チップが面に溶けないこと、
   役割の違う色が dE 0.045 以上離れていること、
   severity の彩度が 1 -> 5 で単調に上がることも見る。

### 廃止した配色

- **Pattern C — Midnight Navy**: 3 つ目の独立した配色として持つと軸が増えるだけなので、候補から外した。
  ネイビー寄りにしたい場合は neutral hue 256 の彩度を上げる形で表現する。
- **旧 Dark（GitHub 由来の `#0d1117` 系）**: neutral の彩度が Light の半分以下で、
  同じ製品に見えないことが今回の作り直しの直接の原因だった。[判断記録](../../decision-log/2026-09-11-unified-color-theme.md)

---

### テーマに追従しない画面

| 対象 | 扱い | 理由 |
|---|---|---|
| `/admin` | 常時 Dark。画面専用パレット `ADMIN` を使う | 運用者向けの内部画面。共通トークンはテーマで明暗が反転するため、ライト選択時に読めなくなる |
| ペンギン系ゲーム | ゲーム固有パレット | ゲーム世界の表現 |
| ロゴ・ブランド画像 | 変換しない | 出典側の色 |

これらは `lib/__tests__/color-literal-budget.ts` と `no-stale-theme-colors` の対象外。
**逆に、ここがテーマへ追従していたら不具合**として扱う。

### 分類色（タグ）の作り方

利用者が選ぶタグや、画面固有の分類ラベルは、状態色ではなく `--color-chart-*` から導く。
背景と境界は面に対する `color-mix` で作ると、Light / Dark の両方へ自動で追従する。

```css
--clr-violet:        var(--color-chart-6);
--clr-violet-light:  color-mix(in srgb, var(--color-chart-6) 10%, var(--color-bg-card));
--clr-violet-border: color-mix(in srgb, var(--color-chart-6) 34%, var(--color-bg-card));
```

状態色（success / warning / error）をタグ分類に流用しない。
「緑のタグ」が「成功」の意味に読まれてしまうため。

### 半透明の面はトークンと color-mix で作る

`rgba(255,255,255,0.8)` のような半透明の白をカードに使うと、ダークで白いカードが残る。
透過の見た目を保ったままテーマへ追従させるには `color-mix` を使う。

```css
/* 悪い例 */
background: rgba(255, 255, 255, 0.82);
/* 良い例 */
background: color-mix(in srgb, var(--color-bg-card) 82%, transparent);
```

**例外は「常時暗い面に重ねる薄膜」。** `--color-bg-emphasis` の上のボタンや、
暗いヒーローの上のバッジは、地が両テーマとも暗いので `rgba(255,255,255,0.12)` のままが正しい。
透明度の低い（0.2 以下）白の重ねは、たいていこちら。

### 直書き色を増やさない

`lib/__tests__/color-literal-budget.ts` がファイル別の残数を持っている。
`#hex` だけでなく `rgb()` / `rgba()` も数える。
新しく色リテラルを書いたファイルは載っていないので必ず落ちる。既存ファイルで増えても落ちる。
減らしたときは予算も下げる（緩いまま放置しないため）。

理由があって直書きする場合（グラフ系列、ブランド色、ゲーム固有表現）は、
予算ファイルへ追加したうえでコメントに理由を書く。

### 値を変えたら旧値の残骸を消す

トークンの値を変えても、SVG の `fill` / `stroke` やグラデーション文字列に書かれた実値は追従しない。
実際、accent を `#2554ff` から変えたあと 24 箇所が旧値のまま残り、
同じ画面に 2 種類の青が出ていた。

値を更新したら `lib/__tests__/no-stale-theme-colors.test.ts` に旧値を追加する。
このテストが `app` / `components` を走査して残骸を落とす（ゲームと管理画面は除外）。

## 確認項目

- ヘッダーの選択を「ダーク」にすると、ホーム背景・カード・文字・モバイル下部ナビが暗い配色になる。
- 再読み込みしても明るい画面を一瞬挟まず、保存したテーマが維持される。
- 「ライト」は端末がダーク設定でもライトを維持する。
- 「端末設定」は端末のライト / ダーク変更に追従する。
- キーボード操作で選択でき、フォーカス位置が見える。
- LocalStorage が利用できなくても画面操作を妨げない。
- `npm run test` で `theme-token-contract` / `theme-contrast` /
  `no-stale-theme-colors` / `color-literal-budget` が通る。
- 配色を変えたら [UAT: 表示テーマ](../../uat/color-theme.md) を Light / Dark の両方で通す。

## 関連

- [表示テーマ切替の設計判断](../../decision-log/2026-08-30-global-color-theme-selector.md)
- [テーマトークン基盤の設計判断](../../decision-log/2026-09-03-theme-token-foundation.md)
- [Light / Dark を同一 hue 軸から生成する判断](../../decision-log/2026-09-11-unified-color-theme.md)
- [UI デザインコンセプト](./ui-design-concept.md)
- [UAT: 表示テーマ](../../uat/color-theme.md)
- [Product Spec](../../product-spec.md)
