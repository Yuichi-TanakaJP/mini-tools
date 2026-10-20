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
| TOPIX33データ (manifest + 日別 JSON) | `MARKET_INFO_API_BASE_URL/topix33/*` → 失敗時は同梱 JSON にフォールバック | フォールバックで動作継続 |
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
| 本番 | TOPIX33データと JPX 休場日は API 優先。API 障害時は同梱 JSON にフォールバック |
| Preview | 本番と同等 |
| ローカル | JPX 休場日のフォールバックがあるため機能差なし |

## 関連 docs

- [TOPIX33業種データ追加と market tools 導線の方針](../decision-log/2026-03-31-topix33-market-tool-plan.md)
- [TOPIX33 premium 可視化の見せ方方針](../decision-log/2026-04-04-topix33-premium-visualization-plan.md)
- [premium ログイン導線の暫定実装方針](../decision-log/2026-04-04-premium-login-placeholder-flow.md)
- [TOPIX33業種 仕様](../specs/tools/topix33.md)

## 保存日と相場日（2026-10-21）

日付選択は公開manifestの保存日一覧。週末・祝日や騰落ゼロだけで保存済みデータを隠さない。選択中と表示中を区別し、日付説明は常に表示中payloadのobservationに従う。相場日は同じ取得元のexplicit_sourceのみ確認済み。取得記録未提供・旧データはUNKNOWN、取得時刻未記録を明示する。APIから記録が届けば自動で表示し、利用者のやり直し操作を要求しない。

From→To: 保存日A表示→保存日B選択。既存の1回の同origin day読取、既存タイムアウトを維持。待機中/失敗時はAとAの日付説明を保持し、成功したらBの本文と説明へ同時に切替。通信失敗の任意retryと、相場日の確認・解除とは別。初回失敗は別日の正常結果にすり替えない。追加の日付照合通信は0回。metadataの追加分は1取得あたり約0.5–1KB（未圧縮の設計見積り）、操作から表示までの時間はPR実測参照。

UAT（local preview、syntheticまたは公開データの隔離読取、外部書込なし）:
1. 保存日一覧に週末がある場合もキーボードで選択できる。
2. 相場日未提供ではUNKNOWN、保存日・取得時刻・生成時刻が別々に表示される。
3. explicit_sourceのmetadataを返す場合は自動で相場日が表示される。
4. 遅延/失敗/連続切替では表示中本文と日付説明が一致し、古い応答で上書きされない。
5. 390px幅で日付・hash等がはみ出さず、既存の待機説明・retryにキーボードで到達できる。
6. 実データの旧CSVには取得元年月日がないことと、独立指数の日付を流用しないことを確認する。
