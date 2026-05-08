# ペンギンシューター 仕様

## 概要

- URL: `/tools/penguin-shooter`
- 分類: おまけゲーム tool
- 主な用途: 宇宙船 Shuty に乗った Pen を操作し、敵を撃ちながら Shoot の救出を目指すミニシューティングゲーム

## 対象ユーザー

- `mini-tools` のおまけ要素として、短時間で遊べる軽いゲームを試したいユーザー
- PC キーボードまたはスマホのタッチ操作で遊びたいユーザー
- 既存の「ペンギン・エイリアンシューター」とは別の、ストーリー性と成長要素を持つ新作を遊びたいユーザー

## 画面仕様

### 主な画面要素

- タイトル / 開始ボタン
- スキップ可能な10秒オープニング
- ゲームフィールド
- プレイヤー: Pen が乗る宇宙船 Shuty
- 敵キャラクター
- 弾 / 爆発 / スコアなどのフィードバック
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
- Shoot 救出クリア
- ゲームオーバー

## ゲーム仕様

### 初期版の範囲

- タイトルは「ペンギンシューター」
- URL は `/tools/penguin-shooter`
- 既存の `/tools/penguin-rabbit-shooter` は残す
- 5ステージ簡易進行を持つ
- Stage 1-4 は撃破目標数を満たすと次ステージへ進む
- Stage 5 は捕獲UFOを倒すと Shoot 救出クリアになる
- 画像アセットの有無は実装側で判断する
- 音声、隠し武器、ランキング、永続セーブ、詳細なショップは初期版では必須にしない

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

- 初期版では外部 API を使わない
- ゲームのステージ、敵、武器、演出設定は実装ファイル内の定数として持つ

### 保存先

- 初期版では永続保存なし
- スコア、コイン、武器状態、ステージ状態はプレイ中のメモリ上に保持する
- 永続ハイスコアや設定保存を追加する場合は、別 PR で LocalStorage 仕様を追記する

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
