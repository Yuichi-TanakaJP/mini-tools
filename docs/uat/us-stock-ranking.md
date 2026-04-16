# 米国株ランキング UAT チェックリスト

## 確認画面・URL

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app/tools/us-stock-ranking` |
| Preview | Vercel PR コメントの URL + `/tools/us-stock-ranking` |
| ローカル | `http://localhost:3000/tools/us-stock-ranking` |

## データ取得の仕組み（確認の前提知識）

| データ | 取得元 | API 障害時の挙動 |
|---|---|---|
| manifest | `MARKET_INFO_API_BASE_URL/us-ranking/manifest` | ページ全体が「データを取得できませんでした」表示になる |
| 日別ランキング | `MARKET_INFO_API_BASE_URL/us-ranking/{YYYY-MM-DD}` | 初回表示では `manifest.dates` を最大5件試し、初期データが空でも client 側で選択日の fetch を再試行する |

- repo 同梱 JSON fallback は持たない
- 初回表示では `manifest.latest` 固定ではなく、`manifest.dates` の先頭から最大5件を試して最初に取得できた日付を採用する
- 日付切替時は `/tools/us-stock-ranking/data/[date]` 経由で同じ loader を呼ぶ

## 正常系チェックポイント

- [ ] ページが正常表示される（HTTP 200）
- [ ] 初期表示で最新利用可能日のランキングが表示される
- [ ] ランキング種別タブ（値上り率 / 値下り率 / 売買代金）を切り替えられる
- [ ] 日付セレクタと前日 / 翌日ボタンで日付を切り替えられる
- [ ] テーブルに ticker・銘柄名・現在値・前日比・騰落率・売買代金が表示される
- [ ] 日付やランキング種別を変えると件数バッジとテーブル内容が更新される

## 異常系チェックポイント

| シナリオ | 期待する挙動 |
|---|---|
| `MARKET_INFO_API_BASE_URL` 未設定 | 「データを取得できませんでした」表示 |
| manifest は取得できるが `latest` の day data が未発行 | `manifest.dates` の次候補を最大5件まで試し、最初に取得できた日付を初期表示に使う |
| 初回表示の5件試行でも日別データが取れない | ハイドレーション後に選択日の fetch を再試行し、失敗時はテーブル領域にエラーメッセージを表示する |
| 選択日の day data fetch が失敗 | テーブル領域にエラーメッセージを表示し、ページ全体は維持される |
| day data の records が 0 件 | 「データがありません」表示 |

## 環境ごとの注意点

| 環境 | 注意点 |
|---|---|
| 本番 | API 接続前提。publish タイミング差で `manifest.latest` と day data が一時的にずれる可能性がある |
| Preview | 本番と同様に API 依存。環境変数未設定だと未接続表示になる |
| ローカル | `.env.local` に `MARKET_INFO_API_BASE_URL` がないと確認できない |

## 関連 docs

- [2026-04-12 米国株ランキングツール phase 1 のデータ contract と実装方針](../decision-log/2026-04-12-us-stock-ranking-phase1.md)
- [React Server / Client 設計分担](../react-server-client-design.md)
