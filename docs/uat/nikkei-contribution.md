# 日経225寄与度 UAT チェックリスト

## 確認画面・URL

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app/tools/nikkei-contribution` |
| Preview | Vercel PR コメントの URL + `/tools/nikkei-contribution` |
| ローカル | `http://localhost:3000/tools/nikkei-contribution` |

## データ取得の仕組み（確認の前提知識）

| データ | 取得元 | API 障害時の挙動 |
|---|---|---|
| 寄与度データ (manifest + 日別 JSON) | repo 同梱 JSON | 影響なし（API 不要） |
| JPX 休場日 | `MARKET_INFO_API_BASE_URL/market-calendar/jpx-closed` → 失敗時は同梱 JSON にフォールバック | フォールバックで動作継続 |

- 週末・JPX 休場日は日付リストから除外される
- 全銘柄の `chg`, `chg_pct`, `contribution` がすべて 0 の日は「市場クローズ扱い」と見なしてスキップされる（`isLikelyMarketClosed` 判定）

## 正常系チェックポイント

- [ ] ページが正常表示される（HTTP 200）
- [ ] 最新営業日のデータが初期表示される
- [ ] 「上昇寄与ランキング」「下落寄与ランキング」が表示される
- [ ] 全銘柄テーブルが表示される（銘柄コード・銘柄名・寄与度・騰落率）
- [ ] 日付セレクタで過去の営業日に切り替えられる
- [ ] 日付を切り替えた際にランキング・テーブルが更新される

## 異常系チェックポイント

| シナリオ | 期待する挙動 |
|---|---|
| `MARKET_INFO_API_BASE_URL` 未設定 | JPX 休場日は同梱 JSON にフォールバック。機能的には正常動作する |
| JPX 休場日 API が 5 秒でタイムアウト | 同梱 JSON にフォールバック |
| 全銘柄 chg=0, chg_pct=0, contribution=0 の日 | その日はスキップされ、次の有効な営業日が初期表示になる |
| manifest にデータが 0 件 | 日付セレクタが空、データ非表示 |

## 環境ごとの注意点

| 環境 | 注意点 |
|---|---|
| 本番 | JPX 休場日は API から取得。寄与度データは手動更新が必要 |
| Preview | 本番と同等 |
| ローカル | JPX 休場日のフォールバックがあるため機能差なし |

## 関連 docs

- [日経225寄与度ツールのデータ連携と UI 判断](../decision-log/2026-03-28-nikkei-contribution-data-and-ui.md)
- [market tools の日付 UI と休場日扱いの整理](../decision-log/2026-03-29-market-tools-date-ui-and-holiday-handling.md)
