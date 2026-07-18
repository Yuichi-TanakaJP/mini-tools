# 2026-07-19 優待ダッシュボードをpremium認証必須にする

## 背景

- 優待ダッシュボードへ、個人利用を前提とした株価データを段階的に接続する計画がある。
- 現行の `/tools/yutai-dashboard` は sitemap に載せていないが、URLを知っていればログインなしで利用できた。
- 非公開データを接続する前に、画面のアクセス境界を先に固定する必要がある。

## 今回決めたこと

- `/tools/yutai-dashboard` をpremiumログイン必須にする。
- 未ログインまたはセッション期限切れの場合は、優待・信用データを取得する前に `/premium/login` へ移動する。
- ログイン後は許可リストで検証した `/tools/yutai-dashboard` へ戻す。
- `?month=` 付きのURLからログインした場合は、検証済みの月指定を保って元の表示へ戻す。
- premiumセッションの有効期間をログインから30日間にする。
- 優待ダッシュボードは `noindex, nofollow` とする。
- 認証済みHTML/RSCレスポンスをService Workerへ保存しないよう、ダッシュボードのGETをPWAランタイムキャッシュの `NetworkOnly` 対象にする。

## 判断理由

- URL非掲載や `noindex` はアクセス制御ではないため、署名済みCookieをサーバー側で検証する。
- 認証確認をデータ取得より前に置き、未認証リクエストで外部APIを呼ばない。
- 個人利用で毎回ログインする負担を抑えるため、固定30日間を採用する。
- 復帰先は任意URLを受け付けず、既存premium画面、admin、優待ダッシュボードだけを許可する。
- サーバー側の認証をService Workerのキャッシュで迂回できないよう、保護対象画面は常にネットワーク経由で取得する。

## 影響範囲

- premiumログインCookieと復帰先検証
- `/tools/yutai-dashboard` のSSR入口
- 優待ダッシュボードのTool SpecとUAT
- 他の公開toolのアクセス条件は変更しない。

## 残課題

- 株価データ用のprivate R2、サーバー間認証、非公開APIは後続PRで扱う。
- 現在のpremium認証は個人利用向けの共有パスワード方式であり、会員管理機能ではない。

## 関連

- Tool Spec: [優待ダッシュボード仕様](../specs/tools/yutai-dashboard.md)
- UAT: [優待ダッシュボードUAT](../uat/yutai-dashboard.md)
