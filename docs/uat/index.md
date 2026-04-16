# UAT チェックリスト インデックス

PR マージ後・リリース前に「何を確認すれば OK か」をツールごとにまとめたドキュメント。  
毎回の口頭確認を減らし、見落としを防ぐことが目的。

## 対象ツール

| ツール | URL パス | データ取得元 | ドキュメント |
|---|---|---|---|
| 決算カレンダー | `/tools/earnings-calendar` | 国内: 同梱 JSON / 海外: API | [earnings-calendar.md](./earnings-calendar.md) |
| 米国株ランキング | `/tools/us-stock-ranking` | API のみ | [us-stock-ranking.md](./us-stock-ranking.md) |
| 市場ランキング | `/tools/market-rankings` | API のみ | [market-rankings.md](./market-rankings.md) |
| 株価ランキング | `/tools/stock-ranking` | 同梱 JSON + JPX 休場日 API | [stock-ranking.md](./stock-ranking.md) |
| 日経225寄与度 | `/tools/nikkei-contribution` | 同梱 JSON + JPX 休場日 API | [nikkei-contribution.md](./nikkei-contribution.md) |
| TOPIX33業種 | `/tools/topix33` | 同梱 JSON + JPX 休場日 API | [topix33.md](./topix33.md) |
| 優待カレンダー | `/tools/yutai-candidates` | 同梱 JSON (+ API) | [yutai-candidates.md](./yutai-candidates.md) |
| 株主優待期限帳 | `/tools/yutai-expiry` | LocalStorage のみ | [yutai-expiry.md](./yutai-expiry.md) |
| 優待銘柄メモ帳 | `/tools/yutai-memo` | LocalStorage のみ | [yutai-memo.md](./yutai-memo.md) |

## 確認環境

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app` |
| Preview（PR デプロイ） | Vercel の PR コメントに記載の URL |
| ローカル | `http://localhost:3000` |

## 共通注意事項

- **JPX 休場日**: `MARKET_INFO_API_BASE_URL` が設定されている場合は API から取得。未設定またはエラー時は同梱 JSON にフォールバック。ローカル開発では `.env` に `MARKET_INFO_API_BASE_URL` を設定しなければ常にローカル JSON が使われる。
- **タイムアウト**: 外部 API 呼び出しはすべて 5 秒タイムアウト。タイムアウト時は `null` / データなし扱いになる。
- **revalidate**: API レスポンスは 300 秒（5 分）キャッシュされる。本番でデータが古いと感じた場合は時間を置いて再確認する。
