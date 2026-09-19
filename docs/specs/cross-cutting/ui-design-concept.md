# UI デザインコンセプト

## コンセプト

**Quiet Financial Workspace — 判断に集中でき、長時間見ても疲れにくい道具箱**

mini-tools は、派手な情報量や装飾で注意を奪うのではなく、利用者が数字・期限・変化・次の行動を落ち着いて判断できる画面を目指す。Light / Dark は別製品ではなく、同じ情報構造と意味を異なる明るさで表す二つの表示モードとして扱う。

## デザイン原則

### 1. Structure before decoration

- 色は装飾より先に、画面の階層、状態、操作可能性を伝えるために使う。
- ページ背景、カード、入力、浮いたパネルの奥行きを全画面で揃える。
- 強いグラデーションや発光表現は、ヒーローや重要な選択状態など限定した場所だけで使う。

### 2. Dark is first-class

- Dark は Light の単純な色反転にしない。
- Light / Dark のどちらも、本文、入力、モーダル、空状態、エラー、ローディングまで同じ完成条件を持つ。
- 暗所で白い面が突然現れないよう、画面遷移中の表示も選択テーマへ追従させる。

### 3. One semantic meaning, one token

- 同じ役割の色は画面をまたいで同じトークンを使う。
- 面、文字、境界線、操作、状態、騰落、グラフ系列を別の役割として管理する。
- `#fff` などをカード背景として直接指定せず、役割トークンを参照する。
- ツール固有色が必要な場合も、ローカル変数へ意味を付け、Light / Dark の両方を定義する。

### 4. Preserve financial meaning

- 日本株の騰落表示は「上昇=赤、下落=青」を基本とし、成功・失敗の緑・赤とは役割を分ける。
- 色だけで状態を伝えず、符号、文言、アイコン、ラベルのいずれかを併用する。
- グラフ系列色は本文や主要操作の色として流用しない。

### 5. Calm density

- カードを増やすことより、見出し・余白・境界線でまとまりを作る。
- 通常状態では影を弱くし、hover やモーダルなど実際に高さが変わる場面だけ影を強める。
- 常時表示の本文に低コントラスト色を使いすぎない。

## 共通画面構造

| 層 | 役割 | 主なトークン |
|---|---|---|
| Page | 画面全体の地 | `--color-bg` |
| Subtle | セクション内の弱い面 | `--color-bg-subtle` |
| Input | 入力・操作前の面 | `--color-bg-input` |
| Card | 通常カード | `--color-bg-card` |
| Elevated | モーダル・ポップオーバー | `--color-bg-elevated` |
| Overlay | 背景を抑えるスクリーン | `--color-bg-overlay` |

共通ヘッダーは画面間を移動する固定されたナビゲーション帯として、Light / Dark にかかわらず深いチャコールを維持する。本文領域と区別し、テーマ選択の戻り道を常に同じ位置・見た目で提供する。

## アクセシビリティ基準

- 通常本文は背景に対して原則 4.5:1 以上、大きな文字と主要UI境界は原則 3:1 以上を目標にする。
- focus は色だけでなく、見えるリングまたは境界線で示す。
- `prefers-reduced-motion` が指定された環境では、テーマ切替に不要なアニメーションを追加しない。
- 状態表示は色名や色相だけを前提にせず、テキストで意味を確認できるようにする。

## 外部リファレンスから定めた審美・品質基準

Apple Human Interface Guidelines の Dark Mode / Materials と、Web UI の実装観点を整理した
Zenn記事を参考に、mini-tools では次を「おしゃれで統一された状態」の判定基準とする。

1. **反転ではなく適応**: Light の固定色を Dark へ持ち込まず、意味を持つトークンで明度と彩度を適応させる。
2. **奥行きは静かな面差で作る**: page → input → subtle → card → elevated の順を守り、Dark では大きな影や発光より明度差を優先する。
3. **アクセントは選択と主要操作に限定**: 通常カードを青く染めず、選択中だけ `accent-sub / accent / border-accent` を組で使う。
4. **状態色は三点セット**: `info / success / warning / error / neutral` は `-bg / -text / -border` を同じファミリーから選び、直書き前景色と混ぜない。
5. **白く光る面を作らない**: Dark のカード、ローディング、空状態、エラー、画像背景に高輝度の固定面を残さない。
6. **装飾より可読性**: 通常本文は 4.5:1 以上を必須、小さい独自色テキストは 7:1 を目標、主要UI境界は 3:1 以上とする。
7. **彩度の予算を守る**: 同時に強く見せる色は原則1系統とし、金融の騰落色・エラー・主要操作を同じ面で競わせない。

選択状態の標準形は次とする。

```css
background: var(--color-accent-sub);
color: var(--color-accent);
border-color: var(--color-border-accent);
box-shadow: inset 0 0 0 1px var(--color-accent-glow);
```

参考資料:

- [Apple Human Interface Guidelines: Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Apple Human Interface Guidelines: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Zenn: WebアプリケーションのUI構築のポイント](https://zenn.dev/tomokusaba/articles/c37aadf984fcd0)

## テーマ例外

- ペンギン系ゲームはゲーム世界の固有パレットを維持してよい。ただし共通ヘッダー、設定UI、ゲーム外モーダルは共通テーマへ従う。
- 管理画面 `/admin` は選択テーマに追従しない**常時 Dark**とする（2026-09-11 確定）。
  運用者が更新状況を見るための内部画面で、共通トークンを使うとライト選択時に
  「暗い地に暗い文字」になる。画面専用のパレット（`ADMIN` 定数）を持つ。
  デスクトップ版・モバイル版の両方を Dark でそろえる。
- ブランド画像、企業ロゴ、証券会社ロゴなど、出典側の色はテーマ変換しない。

## 実装・レビュー規約

1. 新しい面・本文・境界線・主要操作は `app/globals.css` の役割トークンを使う。
2. 状態色は foreground / background / border の組で選ぶ。
3. ローディング、空状態、エラー、モーダルも通常画面と同時に実装する。
4. 直書き色は、データ可視化、ブランド、ゲーム固有表現など理由を説明できるものだけ許容する。
5. PRでは Light / Dark の両方と、狭い画面での主要導線を確認する。

## 関連

- [UI カラーパレット仕様](./ui-color-palette.md)
- [表示テーマ切替の設計判断](../../decision-log/2026-08-30-global-color-theme-selector.md)
- [テーマトークン基盤の設計判断](../../decision-log/2026-09-03-theme-token-foundation.md)
- GitHub Issue: #570 / #571
