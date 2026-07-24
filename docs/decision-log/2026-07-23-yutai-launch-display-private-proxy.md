# 2026-07-23 優待公式条件をPremium認証付きサーバールート経由にする

## 背景

- `market_info`が公式HTML/PDF/TDNET由来の優待条件を正規化し、Private R2へ`yutai/launch-display/*.json`としてpublishする。
- `market-info-api`はPrivate R2を読み、Bearer認証必須の`/yutai/launch-display/latest`、`/yutai/launch-display/manifest`、`/yutai/launch-display/monthly/{year_month}`を提供する。
- ブラウザーからPrivate R2や上流Bearer tokenへ直接アクセスさせると、Premium認証とprivate保管の境界が崩れる。
- 優待ダッシュボードには、署名済みCookieを使うPremium認証がすでにある。

## 決定

- mini-toolsに`GET /api/yutai/launch-display`を追加し、Premium Cookieを検証してからだけ上流APIを呼ぶ。
- 未ログイン・期限切れは404とし、上流リクエストを行わない。
- 上流Bearer tokenは既存の`MARKET_INFO_API_YUTAI_STOCK_PRICES_TOKEN`をサーバー環境で再利用する。`NEXT_PUBLIC_`を付けない。
- 月指定がある場合は`/yutai/launch-display/monthly/{year_month}`、月指定がない場合は`/yutai/launch-display/latest`を呼ぶ。
- 指定月とpayloadの`month`が一致し、画面parserで解釈できる成功レスポンスだけ`Cache-Control: private, max-age=86400`にする。それ以外は`private, no-store`にする。
- `next-pwa`の既定`/api/*` cacheより前に、このrouteを`NetworkOnly`へ指定する。
- 上流の認証・設定エラーは502へ変換し、tokenや上流本文をクライアントへ返さない。
- 優待ダッシュボードは公式条件を詳細パネルに表示する。
- 月別表示の簡易効率は、手入力がない場合に公式条件の最初の自動計算可能条件を使って自動計算する。
- 手入力済みの必要株数・優待価値は公式条件より優先する。公式条件で表現できないものや利用者評価額が必要なものだけ手入力で補正する。
- 全月表示の一覧は、選択行に応じて読み込む月別snapshotが変わるため、一覧全体の簡易効率には公式条件fallbackを使わない。詳細パネルでは選択行の月別公式条件を表示・計算する。

## データ経路

```text
Premium Cookie
    |
    v
mini-tools /api/yutai/launch-display
    |  Authorization: Bearer <server-only token>
    v
market-info-api /yutai/launch-display/monthly/{year_month}
    |
    v
Private R2 yutai/launch-display/{year_month}.json
```

## 関連

- [優待株価をPremium認証付きサーバールート経由にする](./2026-07-20-yutai-private-stock-price-proxy.md)
- [優待ダッシュボードPremium認証](./2026-07-19-yutai-dashboard-premium-auth.md)
- [優待ダッシュボード仕様](../specs/tools/yutai-dashboard.md)
- [優待ダッシュボードUAT](../uat/yutai-dashboard.md)
