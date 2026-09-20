# TDNET Router 確認キュー

Route: `/premium/tdnet-router`

Status: V1 / read-only observation surface

## Purpose

Stock NotesのTDNET Routerが保持する直近180日のHot Eventを、人が確認できる
Premium画面として表示する。

Raw/full TDNET履歴の正本はmarket_info/R2。ここで表示する
`stock_notes_tdnet_hot_event_feed_v` はderived operational read modelであり、
Canonical business factではない。

## Authentication / data boundary

1. 既存Premium sessionを必須にする。
2. 既存Supabase Auth sessionから本人userを取得する。
3. browser/service-role secretは追加しない。
4. security-invoker viewをauthenticated RLSのまま読む。
5. RLSに加えてqueryでもuser_idを明示する。

## V1 filters

Default status set:

- classified
- review_required
- failed

Optional:

- one route status
- one event type
- display limit 25 / 50 / 100 / 200

Order:

1. disclosed_at desc
2. tdnet_disclosure_id desc
3. event_type asc

同一開示がmulti-triggerの場合はevent typeごとの別行として維持する。

## Display

- route status
- event type
- disclosure timestamp (JST)
- Security code
- Company name when linked
- title
- source date
- ingest timestamp
- policy version
- TDNET disclosure ID
- TDNET PDF link

0件は取得失敗と区別して正常な空状態として表示する。

## Explicit non-goals

V1 does not:

- mutate route_status
- call the Router ingest RPC
- run Refresh executors
- write Financial/Yutai/Security/Portfolio/Strategy Canonical state
- enable scheduler
- use AI

## UAT

- Premium未認証でlogin redirectになる。
- Premium認証済み・Supabase未ログインでは本人DBログイン案内になる。
- 0件時に正常な空状態になる。
- status/event/limitで絞り込める。
- TDNET PDFを別タブで開ける。
- page操作でDB writeが発生しない。
- mobile幅でfilter/cardが1列に収まる。
