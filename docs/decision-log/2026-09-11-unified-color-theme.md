# 2026-09-11 Light / Dark を同一 hue 軸から生成する

## 背景

Light / Dark を切り替えられるようにしたところ、同じサービスに見えないという指摘を受けた。
`app/globals.css` の実値を OKLCH に変換して調べたところ、原因は好みではなく**軸が 3 本あること**だった。

| 使われていた系統 | 代表値 | neutral の彩度 (C) | 使用箇所 |
|---|---|---|---|
| Tailwind slate | `#64748b` `#0f172a` `#f8fafc` | 0.035 – 0.041 | 各ツール画面の直書き（最多） |
| Tailwind gray | `#1f2937` `#374151` `#6b7280` | 0.023 – 0.031 | `:root` の Text トークン |
| GitHub grey | `#0d1117` `#161b22` `#8b949e` | 0.014 – 0.018 | Dark テーマ全体 |

- Dark の neutral 彩度は Light（slate 系）の**半分以下**。色相はどれも 250–260 で近いのに、
  Dark だけ「青みのないフラットな灰色」になり、別製品に見えていた。
- accent も 3 系統あった。`#2554ff`（hue 265.5 / C 0.256）、`#2563eb`・`#1d4ed8`（hue 263–264 / C 0.215）、
  premium 画面の indigo `#4338ca`・`#4f46e5`（**hue 277**）。Dark の `#58a6ff` は hue 253.3 で、
  Light の accent から色相が 12° ずれ、彩度は 40% 落ちていた。
- つまり Dark は Light の別明度ではなく、別配色だった。

## 今回決めたこと

- Light / Dark を「別々に選んだ配色」ではなく、**同じ hue 軸から明度だけを変えて生成した二つの表示モード**として定義し直す。
- 色は OKLCH で決め、sRGB へ変換して `app/globals.css` に書き出す。
- 軸を固定する: neutral hue = **256**、accent hue = **264**、
  semantic は info 255 / success 152 / warning 62 / error 25、financial は rise 32 / fall 252、
  chart は 264 / 205 / 155 / 95 / 35 / 320。
  **テーマ間で hue は動かさない。動かすのは明度と、暗所で刺さらないための彩度だけ。**
- 面は page → input → subtle → card → elevated の順に持ち上げる。Dark では影がほぼ見えないため、
  奥行きは影ではなく明度差（18.5% → 22.5% → 24% → 27.5% → 31.5%）で表す。
- 状態色は全 hue に同じ L・C を適用して作る。hue ごとの見た目の明るさの差は、
  warning に +7 / success に +2（Dark は符号反転）の補正だけで吸収する。
- 境界線を 3 段に分ける。`--color-border`（装飾）/ `--color-border-strong`（強調）/
  **`--color-border-control`（操作できる部品の輪郭・背景に対し 3:1 を満たす）**。
- 指定した色が sRGB に収まらない場合は、hue と明度を保ったまま彩度だけ下げて収める。
- コントラストは目視ではなく `lib/__tests__/theme-contrast.test.ts` で機械的に固定する。
- Pattern C（Midnight Navy）は候補から削除する。

## 判断理由

- 直書き色を全部トークンへ置き換えても、トークン自体が 3 軸に割れていれば統一感は出ない。
  先に軸を 1 本にしないと、画面移行の作業がそのまま無駄になる。
- hue を固定して明度だけ動かす方式なら、「Dark にしたら別の青になった」が構造的に起きなくなる。
  Zenn のダークモード実装も enechain の事例も、先にトークン基盤を整えることを最大の学びとして挙げている。
- OKLCH は知覚的に均等なので、同じ L を指定した色は実際に同じ明るさに見える。
  HSL や hex で手作業に調整すると、hue ごとに明るさがばらついて「なんとなく揃わない」状態に戻る。
- 最多勢力が slate 系だったので、neutral hue を 256 に寄せると各画面の直書き色との差が最小になり、
  移行時の見た目の飛びが小さい。
- 3:1 が必要なのは操作できる部品の輪郭だけ。装飾線まで 3:1 にすると画面が硬くなるので、
  境界線トークンを役割で分けた。

## 影響範囲

- `app/globals.css` の全テーマトークン（55 + `--color-border-control`）。
- `theme-color`: Light `#eef2f7` → `#ecf1f7`、Dark `#0d1117` → `#0d131c`
  （`app/layout.tsx` / `lib/color-theme.ts` / `components/ColorThemeSelector.tsx`）。
- トークンを参照している共通ヘッダー、ナビドロワー、共有モーダル、ホーム、移行済みの yutai 系画面。
- **直書き色のままの画面（app / components で hex 約 1,779 箇所・56 ファイル）は今回変わらない。**
  ユーザーが感じている統一感のなさの大半はここが原因なので、この PR だけでは解消しない。

## 残課題

- 各画面の直書き色を新トークンへ移行する（#573 / #572）。最優先は hex 出現数の多い
  `yutai-dashboard` / `yutai-candidates` / `investor-flow` / `market-rankings` / `admin`。
- premium 画面の indigo（hue 277）を accent hue 264 へ寄せる。
- 直書き色の自動監査（CI で新規の色リテラル追加を検知する）。
- 管理画面を常時 Dark の例外にするかの確定。
- 全画面 Light / Dark UAT。

## 関連

- Issue: #570 / #571 / #573 / #572
- 参照 docs: [UI カラーパレット仕様](../specs/cross-cutting/ui-color-palette.md)、
  [UI デザインコンセプト](../specs/cross-cutting/ui-design-concept.md)、
  [テーマトークン基盤の設計判断](./2026-09-03-theme-token-foundation.md)
- 参考: [Zennのダークモードを実装しました](https://zenn.dev/team_zenn/articles/zenn-darkmode-system)、
  [ダークモードのカラー設計とプロダクト対応の実際（enechain）](https://techblog.enechain.com/entry/dark-mode-2024-2)、
  [ダークモード対応へのいくつかのアプローチ](https://zenn.dev/ken7253/articles/darkmode-approach)、
  [Dark Mode Color Design: Building a System, Not Just an Inversion](https://colorarchive.org/guides/dark-mode-color-design-guide/)
