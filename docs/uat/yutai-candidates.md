# 優待カレンダー UAT チェックリスト

## 確認画面・URL

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app/tools/yutai-candidates` |
| Preview | Vercel PR コメントの URL + `/tools/yutai-candidates` |
| ローカル | `http://localhost:3000/tools/yutai-candidates` |

月を指定する場合: `?month=YYYY-MM`（例: `?month=2026-03`）

## データ取得の仕組み（確認の前提知識）

| データ | 取得元 | API 障害時の挙動 |
|---|---|---|
| manifest | `MARKET_INFO_API_BASE_URL/yutai/manifest` → 失敗時は同梱 JSON | フォールバックで動作継続 |
| 月次データ | `MARKET_INFO_API_BASE_URL/yutai/monthly/YYYY-MM` → 失敗時は同梱 JSON | フォールバックで動作継続 |
| 日興クレジット | `MARKET_INFO_API_BASE_URL/nikko/credit` → 失敗時は null（サンプルなし） | 日興クレジット列が非表示 |
| SBI クレジット（当月・将来月） | `MARKET_INFO_API_BASE_URL/sbi/credit/latest` → 失敗時は null | SBI 表示なし |
| SBI クレジット（過去月） | `MARKET_INFO_API_BASE_URL/sbi/credit/monthly/YYYY-MM` → 失敗時は null | SBI 表示なし |

**API 未設定時**:  
- manifest・月次データは同梱 JSON にフォールバック  
- 日興クレジット・SBI クレジットはサンプル JSON にフォールバック（開発用）

## 正常系チェックポイント

- [ ] ページが正常表示される（HTTP 200）
- [ ] 初期表示月が正しい（権利付き最終日前なら当月、後なら翌月）
- [ ] 月タブで他の月に切り替えられる（URL に `?month=` が反映される）
- [ ] 優待銘柄一覧が表示される（銘柄コード・銘柄名・優待内容・権利月など）
- [ ] SBI 短期売り対象銘柄に「SBI売可」バッジが表示される
- [ ] 「SBI: 売可あり」フィルタが機能する（`is_short=true` のみ表示）
- [ ] 日興クレジット情報が表示される
- [ ] 銘柄をピックして優待メモへ追加できる

## 異常系チェックポイント

| シナリオ | 期待する挙動 |
|---|---|
| `MARKET_INFO_API_BASE_URL` 未設定 | manifest・月次データは同梱 JSON、クレジットはサンプル（開発想定） |
| 日興クレジット API 失敗（API 設定あり） | null → 日興クレジット列が非表示（サンプルにフォールバックしない） |
| SBI クレジット API 失敗（API 設定あり） | null → SBI 表示なし |
| `?month=YYYY-MM` に存在しない月を指定 | availableMonths に含まれない場合、スマートデフォルト月にフォールバック |
| manifest が取得できない | 月タブなし、データ表示なし |

## 環境ごとの注意点

| 環境 | 注意点 |
|---|---|
| 本番 | API から最新の manifest・月次データ・クレジット情報を取得 |
| Preview | 本番と同等（環境変数が引き継がれる） |
| ローカル | `.env` に `MARKET_INFO_API_BASE_URL` を設定しない場合、同梱 JSON + サンプルで動作 |

## SBI 表示ルールの補足

- `is_short=true` の銘柄のみ「SBI売可」バッジを表示
- `position_status`（在庫状態）は表示条件に使わない
- 詳細は [yutai-candidates の SBI 短期対象表示ルール](../decision-log/2026-04-05-yutai-candidates-sbi-short-handling.md) を参照
