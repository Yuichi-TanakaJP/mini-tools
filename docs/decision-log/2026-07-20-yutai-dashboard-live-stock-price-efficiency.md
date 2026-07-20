# 2026-07-20 優待効率へPrivate実株価を適用する

## 背景

- 簡易優待効率MVPは、みんかぶの最低投資金額を100株分として概算株価を求めていた。
- Premium認証付きの`GET /api/yutai/stock-prices`が利用可能になり、上流tokenをブラウザーへ渡さず実株価を参照できる。
- 株価取得に失敗しても、必要株数・優待価値の入力と既存の概算計算は継続したい。

## 決定

- 優待ダッシュボードのマウント後に、JST年月を付けた`GET /api/yutai/stock-prices?month=YYYY-MM`を1回取得する。
- `status=ok`かつ正の有限値である株価だけを、銘柄コード単位の計算へ利用する。
- 株価がある銘柄は`実株価 × 必要株数`、株価がない銘柄は従来どおり`最低投資金額 ÷ 100 × 必要株数`で必要資金を計算する。
- 一覧の簡易効率、効率順ソート、詳細パネルは同じ純関数と同じ株価Mapを使う。
- 画面上に株価データの取得件数・生成時刻と、選択銘柄の株価基準日を表示する。
- API失敗・不正schema・個別銘柄の取得失敗は概算へフォールバックし、ページ全体をエラーにしない。
- 株価JSONはLocalStorage・Cache Storageへ保存しない。PWAは既存の`NetworkOnly`指定を維持し、成功レスポンスだけ[24時間のprivate HTTPキャッシュ](./2026-07-20-yutai-stock-price-private-http-cache.md)を使う。
- 手数料・配当・取得後の株価変動は引き続き初期モデルの対象外とする。

## 計算

```text
計算株価 = 実株価（取得成功時）
         = 最低投資金額 ÷ 100（実株価未取得時）

必要資金 = 計算株価 × 必要株数
簡易優待効率（%） = 優待価値 ÷ 必要資金 × 100
```

## 関連

- [簡易優待効率MVP](./2026-07-18-yutai-dashboard-simple-efficiency.md)
- [優待株価をPremium認証付きサーバールート経由にする](./2026-07-20-yutai-private-stock-price-proxy.md)
- [優待ダッシュボード仕様](../specs/tools/yutai-dashboard.md)
- [優待ダッシュボードUAT](../uat/yutai-dashboard.md)
