# 2026-03-28 日経225寄与度ツールのデータ連携と UI 判断

> Note
> このメモの UI 判断は引き続き有効ですが、取得入口の説明は当時の前提です。
> 現行の標準取得入口は `NIKKEI_CONTRIBUTION_DATA_BASE_URL` ではなく `MARKET_INFO_API_BASE_URL/nikkei/*` です。
> 最新方針は [2026-04-04 market tools の API 統一方針](./2026-04-04-market-tools-api-unification-plan.md) を参照します。

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

## モバイル表示切替の判断

- スマホ向けのカード密度やテーブル密度は、初回描画から確定していることを優先する
- `useEffect + matchMedia` で `isMobile` を後判定すると
  - 初回は desktop 寄りサイズ
  - hydrate 後に mobile サイズへ再描画
  となり、更新時にカードサイズのちらつきが起きやすい
- `styled-jsx` で後から上書きする構成も、適用タイミング次第で同種のサイズジャンプを起こしうる
- そのためレスポンシブなサイズ変更は、可能な限り SSR に乗る CSS で表現する
- このページでは `ToolClient.module.css` に寄せ、mobile を基準値、desktop を `min-width` 側で拡張する方針にした
- 画面幅で分岐する表示文言も、JS 条件分岐ではなく CSS の `mobileOnly` / `desktopOnly` で吸収する

## 今後の改善メモ

- 影響度マップはホバーごとに再 render されるため、`sorted` と treemap 計算の memo 化改善余地がある
- この件は Issue [#160](https://github.com/Yuichi-TanakaJP/mini-tools/issues/160) で管理する
