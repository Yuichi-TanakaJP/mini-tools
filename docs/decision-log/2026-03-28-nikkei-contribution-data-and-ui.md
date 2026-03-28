# 2026-03-28 日経225寄与度ツールのデータ連携と UI 判断

## 背景

`market_info` 側で生成した `nikkei_contribution_YYYY-MM-DD.json` と
`nikkei_contribution_manifest.json` を `mini-tools` で表示する構成にした。

X 投稿では情報量に制限があるため、`mini-tools` では詳細確認用の UI を担う。

## データ連携方針

- データ生成責務は `market_info`
- 表示責務は `mini-tools`
- `mini-tools` 側では CSV を解釈せず、公開済み JSON を正として扱う
- 既定の取得先は R2 公開 URL とし、必要なら `NIKKEI_CONTRIBUTION_DATA_BASE_URL` で上書きする

## 初期表示の判断

- `manifest.dates` は降順
- ただし `latest_date` をそのまま初期表示に使うと、休場日や誤取得日が混ざったときに空表示になり得る
- そのためサーバー側で
  - JPX 休場日
  - 土日
  - 先頭側に混ざったゼロ変化日
  を避けて、最初に表示すべき営業日を選ぶ

## 休場日判定の判断

- 休場日判定は推定ではなく、`earnings-calendar` で利用している JPX 休場日データを優先する
- クライアント側の「全銘柄ゼロ変化」は補助判定として残す

## 影響度マップの判断

- 面積は `size_value`、現状は `weight_pct`
- 色は `color_value`、現状は `chg_pct`
- 配置は `market_info` 側の treemap 生成に寄せて `squarify` 相当で描画する
- 大きいセルは社名・騰落率・寄与度、小さいセルは情報量を段階的に減らす
- Web らしさとしてホバー詳細を追加する

## 日付ナビゲーションの判断

- セレクトだけでなく前後移動ボタンを置く
- `manifest.dates` が降順なので
  - 前日 = index + 1
  - 翌日 = index - 1
- ラベルは文字ではなく矢印を使い、移動できないときは色を落として無効状態を明示する

## 今後の改善メモ

- 影響度マップはホバーごとに再 render されるため、`sorted` と treemap 計算の memo 化改善余地がある
- この件は Issue [#160](https://github.com/Yuichi-TanakaJP/mini-tools/issues/160) で管理する
