# 2026-06-26 ホーム通知の初期対象を開示イベント新着にする

## 背景

- ホーム画面に通知を出す機能を追加したい。
- 最初の通知対象として、開示イベントレーダーの新着を扱う案が出た。
- 開示イベントレーダーには既に `event_id` と確認済みイベントIDの LocalStorage 管理がある。

## 今回決めたこと

- ホーム通知は、ブラウザ Push 通知ではなく、まずホーム画面内の通知カードとして始める。
- 初期対象は、開示イベントレーダーの直近7日間の `audience=all` イベントと、端末内マイ銘柄に一致する `audience=personal` イベントにする。
- 通知カードには未確認件数と一部の銘柄名を表示し、マイ銘柄と優待変更をグループ分けして、それぞれ `/tools/disclosure-radar?view=my-stocks&range=7` と `/tools/disclosure-radar?view=yutai&range=7` へ遷移できるようにする。
- 未確認判定は、開示イベントレーダーと同じ `disclosure_radar_read_event_ids_v1` を使う。
- イベント本文は LocalStorage に複製保存せず、ホーム表示時に API から取得する。

## 判断理由

- 既存の開示イベントデータ契約と既読管理を再利用でき、通知機能の最初の実装として小さく始められる。
- Push 通知や通知許可ダイアログを導入しないため、利用者体験と実装リスクを抑えられる。
- 直近7日間に限定すると、見落とし防止とホームの情報量のバランスを取りやすい。
- マイ銘柄通知は端末内の銘柄リスト照合だけで完結させ、登録内容は API へ送信しない。

## 影響範囲

- ホーム画面 `/`
- `app/HomeNotifications.tsx`
- `app/tools/disclosure-radar/read-state.ts`
- `app/tools/disclosure-radar/ToolClient.tsx`
- `docs/product-spec.md`

## 残課題

- マイ銘柄イベントのホーム通知
- 通知カード上での「まとめて確認済み」操作
- Push 通知やメール通知など、ホーム外通知への拡張要否
- 通知対象をユーザーが選ぶ設定 UI

## 関連

- 参照 docs: [開示イベントレーダー 仕様](../specs/tools/disclosure-radar.md)
- 参照 docs: [開示レーダーの履歴表示と確認済み管理](./2026-06-14-disclosure-radar-history-and-read-state.md)
