# 2026-07-20 優待株価JSONを24時間private HTTPキャッシュする

## 背景

- Productionの150銘柄JSONは実測23,623 bytes（約23KB）で、個人利用の通信量としては小さい。
- 株価は月単位の取得サイクルであり、ダッシュボードを開くたびに同じJSONを再取得する必要はない。
- 上流APIが一時的に502となることがあり、直近の成功データを短期間再利用できる方が画面は安定する。
- 計算済みパーセントを保存すると株価更新時の失効管理が増えるため、保存対象は入力データの株価JSONに限定したい。

## 決定

- ブラウザーからのURLを`/api/yutai/stock-prices?month=YYYY-MM`とし、JSTの月をHTTPキャッシュキーへ含める。
- 要求月とpayloadの`scope_month`が一致する成功レスポンスだけ、次を返す。

```text
Cache-Control: private, max-age=86400, stale-if-error=604800
Vary: Cookie
```

- 24時間はブラウザーのprivate HTTPキャッシュを再利用し、期限後に上流障害が起きた場合だけ最大7日間のstale利用を許可する。
- 月不一致、未ログイン、設定不足、上流失敗、不正JSONは`private, no-store`とする。
- `Vary: Cookie`により、ログアウト後・別Premiumセッションで認証済みレスポンスを流用しない。
- PWAは引き続き`NetworkOnly`とし、Cache Storageには保存しない。LocalStorageにも株価JSONを保存しない。
- 必要株数・優待価値は従来どおりLocalStorageへ保存する。必要資金と効率パーセントはキャッシュした株価から画面上で再計算し、保存しない。

## 通信量の目安

- キャッシュなし: 1表示あたり約23KB
- 1日10回表示した場合: 約230KB/日、約6.8MB/30日
- 24時間キャッシュ後: 同一ブラウザー・同一Premiumセッションでは原則1日1回、約0.7MB/30日

## 関連

- [優待株価をPremium認証付きサーバールート経由にする](./2026-07-20-yutai-private-stock-price-proxy.md)
- [優待効率へPrivate実株価を適用する](./2026-07-20-yutai-dashboard-live-stock-price-efficiency.md)
- [優待ダッシュボード仕様](../specs/tools/yutai-dashboard.md)
