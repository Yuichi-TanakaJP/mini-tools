# 市場ランキング UAT チェックリスト

## 確認画面・URL

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app/tools/market-rankings` |
| Preview | Vercel PR コメントの URL + `/tools/market-rankings` |
| ローカル | `http://localhost:3000/tools/market-rankings` |

## データ取得の仕組み（確認の前提知識）

| データ | 取得元 | API 障害時の挙動 |
|---|---|---|
| manifest | `MARKET_INFO_API_BASE_URL/market-rankings/{type}/manifest` | ページ上部に「月次ランキング API が未接続です」表示 |
| 月次データ | `MARKET_INFO_API_BASE_URL/market-rankings/{type}/monthly/{YYYY-MM}` | 対象月のみ error card を表示し、ページ全体は維持される |

- repo 同梱 JSON fallback は持たない
- `type` は `market-cap` / `dividend-yield` を query string で表現する
- `month` が manifest に存在しない値なら `manifest.latest` に正規化される
- 月変更やランキング種別変更は internal route fetch ではなく query string 更新で server を再評価する

## 正常系チェックポイント

- [ ] ページが正常表示される（HTTP 200）
- [ ] 初期表示で最新月のランキングが表示される
- [ ] ランキング種別（時価総額 / 配当利回り）を切り替えられる
- [ ] 月ボタンを切り替えると URL の `month` と表示内容が更新される
- [ ] 市場区分タブ（プライム / スタンダード / グロース）を切り替えられる
- [ ] テーブルに順位・銘柄名・市場区分ごとの主要指標・現在値・騰落情報が表示される
- [ ] ヘッダーの更新時刻 / 対象月 / 市場日付チップが整合している

## 異常系チェックポイント

| シナリオ | 期待する挙動 |
|---|---|
| `MARKET_INFO_API_BASE_URL` 未設定 | 「月次ランキング API が未接続です」表示 |
| `type` に不正値を指定 | `market-cap` として扱われる |
| `month` に存在しない値を指定 | `manifest.latest` に正規化される |
| manifest は取れるが selected month の API が失敗 | error card を表示し、他の UI は維持される |
| 特定市場の records が空 | その市場タブは disabled、または空表示になる |

## 環境ごとの注意点

| 環境 | 注意点 |
|---|---|
| 本番 | API 接続前提。repo 内 fallback がないため API 状態がそのまま見える |
| Preview | 本番と同様。PR 環境変数が無いと未接続表示になる |
| ローカル | `.env.local` に `MARKET_INFO_API_BASE_URL` が必要 |

## 関連 docs

- [2026-04-11 市場ランキング月次ツールの追加方針](../decision-log/2026-04-11-market-rankings-monthly-tool.md)
- [React Server / Client 設計分担](../react-server-client-design.md)
