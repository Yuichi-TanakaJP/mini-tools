# 株価ランキング UAT チェックリスト

## 確認画面・URL

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app/tools/stock-ranking` |
| Preview | Vercel PR コメントの URL + `/tools/stock-ranking` |
| ローカル | `http://localhost:3000/tools/stock-ranking` |

## データ取得の仕組み（確認の前提知識）

| データ | 取得元 | API 障害時の挙動 |
|---|---|---|
| ランキングデータ (manifest + 日別 JSON) | repo 同梱 JSON | 影響なし（API 不要） |
| JPX 休場日 | `MARKET_INFO_API_BASE_URL/market-calendar/jpx-closed` → 失敗時は同梱 JSON にフォールバック | フォールバックで動作継続 |

- 週末（土・日）と JPX 休場日は日付リストから除外される（初期表示対象にならない）

## 正常系チェックポイント

- [ ] ページが正常表示される（HTTP 200）
- [ ] 最新営業日のランキングが初期表示される（週末・休場日は除外済みの最新日）
- [ ] 日付セレクタで過去の営業日に切り替えられる
- [ ] 市場タブ（プライム / スタンダード / グロース）が切り替えられる
- [ ] 各タブで「値上がり率」「値下がり率」「売買高」ランキングが表示される
- [ ] 各銘柄行に銘柄コード・銘柄名・騰落率などが表示される

## 異常系チェックポイント

| シナリオ | 期待する挙動 |
|---|---|
| `MARKET_INFO_API_BASE_URL` 未設定 | JPX 休場日は同梱 JSON にフォールバック。機能的には正常動作する |
| JPX 休場日 API が 5 秒でタイムアウト | 同梱 JSON にフォールバック |
| 選択日のデータが存在しない | UI でデータなし表示（ページエラーにはならない） |
| manifest にデータが 0 件 | 日付セレクタが空、ランキング非表示 |

## 環境ごとの注意点

| 環境 | 注意点 |
|---|---|
| 本番 | JPX 休場日は API から取得（最新祝日に自動対応）。ランキングデータは手動更新が必要 |
| Preview | 本番と同等（環境変数は引き継がれる）。ランキングデータはブランチ時点の同梱 JSON |
| ローカル | `.env` の設定有無で JPX 休場日取得先が変わるが、フォールバックがあるため機能差なし |

## 関連 docs

- [株価ランキングのデータ連携手順メモ](../decision-log/2026-03-26-stock-ranking-data-update-ops.md)
- [market tools の API 統一方針](../decision-log/2026-04-04-market-tools-api-unification-plan.md)
