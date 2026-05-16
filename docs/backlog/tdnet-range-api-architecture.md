# TDNET 複数日検索 range API 化 検討メモ

## 結論

TDNET の複数日検索は、将来的に `market-info-api` 側の range endpoint へ寄せることを検討する。

mini-tools 側で日別 endpoint を複数回呼んで結合する実装は、UI 検証や暫定導入としては扱いやすい。一方で、本番で過去7日 / 過去30日検索を継続的に使うなら、通信回数、応答性、責務分離の観点で API 層結合のほうが望ましい。

## 背景

TDNET の公開データは R2 に日別 JSON と latest JSON として保存されている。

- `tdnet/disclosures/YYYY-MM-DD.json`
- `tdnet/disclosures/latest.json`

現在の mini-tools 実装では、過去7日 / 過去30日検索を行う場合、基準日から過去方向に日別 API を複数回呼び、mini-tools 側で items を結合する。

## 比較

| 案 | 結合場所 | mini-tools からの通信回数 | 応答性 | 通信量 | market_info 修正 | 評価 |
|---|---|---:|---|---|---|---|
| mini-tools 側で日別 API を複数回呼ぶ | mini-tools | 7日なら最大7回、30日なら最大30回 | SSR が全日分待ちになり遅くなりやすい | HTTP overhead が日数分増える | 不要 | 暫定・UI検証向き |
| market-info-api 側で結合する | market-info-api | 1回 | API 側で並列化・cache しやすい | mini-tools 側の通信量を削減 | 不要 | 本番向きの第一候補 |
| market_info 側で range JSON を事前生成 | market_info / R2 | 1回 | 最速 | 最小。ただし R2 保存量は増える | 必要 | 高頻度利用・高速化重視向き |
| API 側で結合 + cache | market-info-api | 1回 | 初回以外は速い | cache hit 時は小さい | 不要 | バランス最良候補 |

## 今後の候補

### market-info-api

- `GET /tdnet/disclosures/range?to=YYYY-MM-DD&days=7`
- `GET /tdnet/disclosures/range?to=YYYY-MM-DD&days=30`
- `to` 未指定時は latest の `target_date` を基準にする
- `days` はまず `1 / 7 / 30` に制限する
- response は既存 shape を拡張する

```json
{
  "status": "ok",
  "target_date": "2026-05-16",
  "range_days": 30,
  "loaded_dates": ["2026-05-16"],
  "missing_dates": [],
  "total_count": 1234,
  "items": []
}
```

### mini-tools

- `range=1` は既存 latest/date endpoint を使う
- `range=7/30` は range endpoint を1回だけ呼ぶ
- API 側 range endpoint が利用可能になったら、mini-tools 側の日別複数 fetch 結合は削除する
- UI の検索範囲、業績/配当、カテゴリ、リンク種別、時間帯フィルタは維持する

## market_info 修正要否

今回の range endpoint 化だけなら、`market_info` 側の修正は不要。

修正が必要になるのは、次のような段階に進む場合。

- `available_dates.json` のような日付 manifest を R2 に publish したい
- 業績 / 配当などの判定 boolean を生成時点で payload に追加したい
- range JSON を事前生成して R2 に保存したい
- R2 publish のファイル構成を変更したい

## 関連 Issue

- mini-tools: [#304](https://github.com/Yuichi-TanakaJP/mini-tools/issues/304)
- market-info-api: [#40](https://github.com/Yuichi-TanakaJP/market-info-api/issues/40)
