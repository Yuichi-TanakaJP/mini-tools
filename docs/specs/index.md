# 仕様書インデックス

このディレクトリは、`mini-tools` の「現在仕様」をツール別に整理する場所です。

## 仕様書の位置づけ

- 仕様書: 現在どう動くべきかを書く
- UAT: 何を確認すればよいかを書く
- Decision Log: なぜその仕様にしたかを書く

## 横断仕様

- [横断仕様インデックス](./cross-cutting/index.md)

## ツール別仕様

| ツール | URL | 仕様 |
|---|---|---|
| 株価ランキング | `/tools/stock-ranking` | [stock-ranking.md](./tools/stock-ranking.md) |
| 日経225寄与度 | `/tools/nikkei-contribution` | [nikkei-contribution.md](./tools/nikkei-contribution.md) |
| TOPIX33業種 | `/tools/topix33` | [topix33.md](./tools/topix33.md) |
| 優待銘柄メモ帳 | `/tools/yutai-memo` | [yutai-memo.md](./tools/yutai-memo.md) |
| 決算カレンダー | `/tools/earnings-calendar` | [earnings-calendar.md](./tools/earnings-calendar.md) |
| TDNET適時開示一覧 | `/tools/tdnet-disclosures` | [tdnet-disclosures.md](./tools/tdnet-disclosures.md) |
| 開示イベントレーダー | `/tools/disclosure-radar` | [disclosure-radar.md](./tools/disclosure-radar.md) |
| 投資主体別売買動向 | `/tools/investor-flow` | [investor-flow.md](./tools/investor-flow.md) |
| ペンギンシューター | `/tools/penguin-shooter` | [penguin-shooter.md](./tools/penguin-shooter.md) |

## テンプレート

新しいツール別仕様を追加するときは、[_template.md](./tools/_template.md) をコピーして使います。

## 更新ルール

- 新規ツールを追加したら、このインデックスに行を追加する
- 仕様変更 PR では、対象ツールの仕様書更新要否を確認する
- UAT と仕様書の内容がずれた場合は、仕様書を正、UAT を確認手順として補正する
- ツール別仕様には、対応する UAT、関連 Decision Log、関連実装へのリンクを置く
- ツール別仕様を新規追加したら、`docs/index.md` の Specs にも主要リンクを追加する
