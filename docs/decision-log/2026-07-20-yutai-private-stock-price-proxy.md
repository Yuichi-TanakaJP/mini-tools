# 2026-07-20 優待株価をPremium認証付きサーバールート経由にする

## 背景

- `market_info`が優待向け株価をPrivate R2へpublishし、`market-info-api`がBearer認証必須の`/yutai/stock-prices/latest`を提供するようになった。
- 上流Bearer tokenをブラウザーへ渡すと、Premium認証を迂回してprivate endpointを直接呼べてしまう。
- 優待ダッシュボード本体には、署名済みCookieを使う30日間のPremium認証がすでにある。

## 決定

- mini-toolsに`GET /api/yutai/stock-prices`を追加し、Premium Cookieを検証してからだけ上流を呼ぶ。
- 未ログイン・期限切れは404とし、上流リクエストを行わない。
- 上流Bearer tokenは`MARKET_INFO_API_YUTAI_STOCK_PRICES_TOKEN`としてサーバー環境だけに置く。`NEXT_PUBLIC_`を付けない。
- 当初は成功・エラーとも`Cache-Control: private, no-store`としていた。成功レスポンスのみ、後続の[24時間private HTTPキャッシュ](./2026-07-20-yutai-stock-price-private-http-cache.md)へ変更した。エラーは引き続き`no-store`とする。
- `next-pwa`の既定`/api/*` cacheより前に、このrouteを`NetworkOnly`へ指定する。HTTP `no-store`だけに依存しない。
- 上流の認証・設定エラーは502へ変換し、tokenや上流本文をクライアントへ返さない。
- 株価を簡易優待効率へ適用するUI変更は別PRとし、[優待効率へのPrivate実株価適用](./2026-07-20-yutai-dashboard-live-stock-price-efficiency.md)で判断を記録する。

## データ経路

```text
Premium Cookie
    |
    v
mini-tools /api/yutai/stock-prices
    |  Authorization: Bearer <server-only token>
    v
market-info-api /yutai/stock-prices/latest
    |
    v
Private R2 yutai/stock-prices/latest.json
```

## 関連

- [優待ダッシュボードPremium認証](./2026-07-19-yutai-dashboard-premium-auth.md)
- [優待ダッシュボード仕様](../specs/tools/yutai-dashboard.md)
- [優待ダッシュボードUAT](../uat/yutai-dashboard.md)
