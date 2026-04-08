# TOPIX33業種 UAT チェックリスト

## 確認画面・URL

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app/tools/topix33` |
| Preview | Vercel PR コメントの URL + `/tools/topix33` |
| ローカル | `http://localhost:3000/tools/topix33` |

## データ取得の仕組み（確認の前提知識）

| データ | 取得元 | API 障害時の挙動 |
|---|---|---|
| TOPIX33データ (manifest + 日別 JSON) | repo 同梱 JSON | 影響なし（API 不要） |
| JPX 休場日 | `MARKET_INFO_API_BASE_URL/market-calendar/jpx-closed` → 失敗時は同梱 JSON にフォールバック | フォールバックで動作継続 |

- 週末・JPX 休場日は日付リストから除外される
- `sectors.length === 0` の日はスキップされ、次の有効な日が初期表示になる

## 正常系チェックポイント

- [ ] ページが正常表示される（HTTP 200）
- [ ] 最新営業日の TOPIX33業種データが初期表示される
- [ ] 「上昇業種ランキング」「下落業種ランキング」が表示される
- [ ] 全33業種の一覧テーブルが表示される（業種名・騰落率など）
- [ ] 日付セレクタで過去の営業日に切り替えられる
- [ ] premium 機能のプレースホルダーが適切に表示される（ログイン誘導など）

## 異常系チェックポイント

| シナリオ | 期待する挙動 |
|---|---|
| `MARKET_INFO_API_BASE_URL` 未設定 | JPX 休場日は同梱 JSON にフォールバック。機能的には正常動作する |
| JPX 休場日 API が 5 秒でタイムアウト | 同梱 JSON にフォールバック |
| `sectors.length === 0` の日 | その日はスキップされ、次の有効な営業日が初期表示になる |
| manifest にデータが 0 件 | 日付セレクタが空、データ非表示 |

## 環境ごとの注意点

| 環境 | 注意点 |
|---|---|
| 本番 | JPX 休場日は API から取得。TOPIX33データは手動更新が必要 |
| Preview | 本番と同等 |
| ローカル | JPX 休場日のフォールバックがあるため機能差なし |

## 関連 docs

- [TOPIX33業種データ追加と market tools 導線の方針](../decision-log/2026-03-31-topix33-market-tool-plan.md)
- [TOPIX33 premium 可視化の見せ方方針](../decision-log/2026-04-04-topix33-premium-visualization-plan.md)
- [premium ログイン導線の暫定実装方針](../decision-log/2026-04-04-premium-login-placeholder-flow.md)
