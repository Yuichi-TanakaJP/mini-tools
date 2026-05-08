# ペンギンシューター 仕様

## 概要

- URL: `/tools/penguin-shooter`
- 分類: おまけゲーム tool
- 主な用途: 宇宙船 Shuty に乗った Pen を操作し、100小ステージを進みながら Shoot の救出と世界平和を目指すミニシューティングゲーム

## 対象ユーザー

- `mini-tools` のおまけ要素として、段階的に遊び込めるゲームを試したいユーザー
- PC キーボードまたはスマホのタッチ操作で遊びたいユーザー
- 既存の「ペンギン・エイリアンシューター」とは別の、ストーリー性、成長要素、ボス、ステージ進行を持つ新作を遊びたいユーザー

## 画面仕様

### 主な画面要素

- タイトル / 開始ボタン
- スキップ可能な10秒オープニング
- ゲームフィールド
- 大ステージ / 小ステージ表示
- ステージ背景
- プレイヤー: Pen が乗る宇宙船 Shuty
- 敵キャラクター
- 中間ボス / ステージボス
- 弾 / 爆発 / スコアなどのフィードバック
- BGM / 効果音 / ミュート操作
- HUD
  - スコア
  - ライフ
  - コイン
  - ステージ
  - 武器状態
  - ボム残数
- PC キーボード操作
- スマホ向けタッチ操作パネル
- クリア / ゲームオーバー表示

### 入力

- PC:
  - 矢印キーで移動
  - Space でショット
  - ボム用のキーは実装時に決める
- スマホ:
  - 画面下のタッチ操作パネルで移動とショット
  - ボムボタンは誤タップしにくい位置とサイズにする
- オープニング:
  - 開始
  - スキップ
  - リトライ

### 出力

- 敵撃破スコア
- コイン獲得
- 武器強化状態
- ステージ進行
- 2人プレイ解放状態
- Shoot 救出クリア
- 世界平和エンディング
- ゲームオーバー

## ゲーム仕様

### 現在版の範囲

- タイトルは「ペンギンシューター」
- URL は `/tools/penguin-shooter`
- 既存の `/tools/penguin-rabbit-shooter` は残す
- 5大ステージ x 20小ステージ、合計100小ステージの進行を持つ
- 大ステージは「町 / 国 / 月 / 火星 / 異次元」のテーマ背景を持つ
- 各大ステージの10小ステージ目と20小ステージ目にボスを出す
- 異次元ステージを突破すると Shoot 救出クリアになる
- ライフ最大値は10として扱う
- 背景は `public/games/penguin-shooter/backgrounds/` のSVGアセットを使う
- BGM / 効果音は Web Audio API の生成音で導入し、今後ファイル音源へ差し替えられる構成にする
- ミュート状態は LocalStorage に保存する

### 豪華版の目標仕様

- 5つの大ステージを持つ

| 大ステージ | イメージ | 役割 |
|---|---|---|
| 1 | 町 | 冒険開始、基本操作、最初の敵 |
| 2 | 国 | 敵編成の増加、攻撃パターン追加 |
| 3 | 月 | 低重力・宇宙感の強化、中盤の山場 |
| 4 | 火星 | 高難度化、ボス演出強化 |
| 5 | 異次元 | 最終決戦、Shoot 救出、世界平和 |

- 各大ステージは20小ステージを含む
- 合計100小ステージ構成にする
- 各大ステージに中間ボスとステージボスを置く
- 異次元のステージボスを倒すと Shoot を救出し、世界が平和になる
- 10小ステージクリアで2人プレイを解放する
- ライフ最大値は10にする
- 画像、BGM、効果音を導入する
- このゲームは、`mini-tools` で未使用または使用頻度の低い技術を試すトライアル枠として扱う

### オープニング

ベース資料の10秒オープニングを簡易演出として採用する。

| 時間 | 内容 |
|---|---|
| 0-2秒 | 宇宙船 Shuty が登場する |
| 2-4秒 | Pen が登場し、冒険の開始を示す |
| 4-6秒 | Shoot が敵に捕まる |
| 6-8秒 | コインと強化を示す |
| 8-10秒 | Shuty が出発し、ゲームを開始する |

オープニングは必ずスキップできるようにする。

### プレイヤーとキャラクター

- Pen: 主人公。Shuty に乗って戦う
- Shuty: 丸い救助宇宙船。プレイヤー機として扱う
- Shoot: 捕まった友だち。クリア目標として救出する
- Maro-kun: サポート役。初期版では演出または案内役に留めてもよい

### 武器

- Standard Shooter:
  - 初期武器
  - 単発または連射の基本ショット
- 3-Way Spread Shot:
  - 強化武器
  - コイン獲得やステージ進行で解放する
- ボム:
  - 1回だけ使える全画面クリア系の特殊武器
  - 初期版では「もう、どうにでもなれボム」の名称を使ってよい
  - Stage 3 到達時にボムを使い切っている場合、Maro-kun の補給として1回分を戻してよい

## データ仕様

### 取得元

- 現在版では外部 API を使わない
- 豪華版では、ステージ、敵、武器、ボス、背景、音の設定を構造化データとして持つ
- 画像/BGM/効果音アセットは `public/games/penguin-shooter/` 配下に置く方針
- 現在の背景アセットは以下を使う
  - `public/games/penguin-shooter/backgrounds/town.svg`
  - `public/games/penguin-shooter/backgrounds/country.svg`
  - `public/games/penguin-shooter/backgrounds/moon.svg`
  - `public/games/penguin-shooter/backgrounds/mars.svg`
  - `public/games/penguin-shooter/backgrounds/dimension.svg`
- 現在のBGM / 効果音は外部音声ファイルを持たず、ユーザー操作後に Web Audio API で生成する

### 保存先

- 現在版ではミュート状態のみ LocalStorage に保存する
- 豪華版では、進捗、2人プレイ解放状態、ライフ最大値、ハイスコア、ミュート状態を保存する
- 保存先はまず LocalStorage を候補にする

### fallback

- 外部データ取得がないため、通信失敗による fallback は持たない
- 画像アセットを使う場合は、読み込み失敗時でもゲーム開始ボタンや最低限のプレイが壊れない表示にする

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | タイトル、開始ボタン、オープニング導線を表示する |
| オープニング中 | 10秒演出を進め、スキップ操作を受け付ける |
| プレイ中 | HUD、ゲームフィールド、操作パネルを表示する |
| ステージ進行 | ステージごとの進行ゲージと全体救出ゲージを表示する |
| クリア | Stage 5 の捕獲UFO撃破後、Shoot 救出が分かる完了表示とリトライ導線を表示する |
| ゲームオーバー | スコア、リトライ導線を表示する |
| 画像読み込み失敗 | 画像なしでも最低限の表示で継続する |
| 音声再生不可 | ミュート相当で継続し、ゲーム進行を止めない |

## premium / 権限制御

- premium 制限なし
- ログイン不要で利用できる

## 関連実装

- [app/tools/penguin-shooter/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/penguin-shooter/page.tsx)
- [app/tools/penguin-shooter/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/penguin-shooter/ToolClient.tsx)
- 参考: [app/tools/penguin-rabbit-shooter/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/penguin-rabbit-shooter/ToolClient.tsx)

## 関連 docs

- UAT: [ペンギンシューター UAT](../../uat/penguin-shooter.md)
- Plan: [ペンギンシューター新ゲーム作成計画](../../plans/penguin-shooter-new-game-plan.md)
- ベース資料: `docs/plans/penguin_bunny_shooter_project_plan_7pages_with_approval.pdf`
- Decision Log:
  - [ペンギン・バニーシューター最短導入方針](../../decision-log/2026-04-17-penguin-rabbit-shooter-minimal-intro.md)
  - [ペンギン・バニーシューター タッチパネルレイアウト設計](../../decision-log/2026-04-20-penguin-touch-panel-layout.md)
  - [ペンギン自機の宇宙船化](../../decision-log/2026-05-05-penguin-ship-player-visual.md)
  - [ペンギン・エイリアンシューター 敵キャラクター変更](../../decision-log/2026-05-06-penguin-alien-enemy-visual.md)
  - [ペンギンシューター豪華版・新技術トライアル方針](../../decision-log/2026-05-09-penguin-shooter-rich-game-trial.md)
