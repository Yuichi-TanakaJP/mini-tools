# 投資主体別売買動向 UAT チェックリスト

## 確認画面・URL

| 環境 | URL |
|---|---|
| 本番 | `https://mini-tools-rho.vercel.app/tools/investor-flow` |
| Preview | Vercel PR コメントの URL + `/tools/investor-flow` |
| ローカル | `http://localhost:3000/tools/investor-flow` |

## データ取得の仕組み

| データ | 取得元 | API 障害時の挙動 |
|---|---|---|
| raw manifest | `MARKET_INFO_API_BASE_URL/investor-flow/manifest` | 未接続表示 |
| raw latest / week | `MARKET_INFO_API_BASE_URL/investor-flow/latest` または `/weeks/{start}/{end}` | 選択週の error card |
| analysis manifest | `MARKET_INFO_API_BASE_URL/investor-flow/analysis/manifest` | raw から計算できるサマリーに fallback |
| analysis latest / week | `MARKET_INFO_API_BASE_URL/investor-flow/analysis/latest` または `/analysis/weeks/{start}/{end}` | raw から計算できるサマリーに fallback |

- repo 同梱 JSON fallback は持たない
- 週切替は query string 更新で server component を再評価する

## 正常系チェックポイント

- [ ] ページが正常表示される
- [ ] 初期表示で最新週が選択される
- [ ] 週ボタンを押すと URL の `start` / `end` と表示週が更新される
- [ ] サマリータブで最大買い越し、最大売り越し、買い構成比、反転、継続が表示される
- [ ] 構造タブで `総計 -> 自己計 / 委託計` の関係が分かる
- [ ] 詳細タブで個人、法人、金融機関、自己売買の内訳を確認できる
- [ ] JPX元データリンクが別タブで開く
- [ ] モバイル幅でタブ、カード、内訳テーブルが重ならない

## 異常系チェックポイント

| シナリオ | 期待する挙動 |
|---|---|
| `MARKET_INFO_API_BASE_URL` 未設定 | 「データ取得先が未接続です」表示 |
| raw manifest は取れるが raw week が失敗 | 選択週の error card |
| analysis だけ失敗 | 注意表示を出し、生データ由来のサマリーを表示。反転・継続は比較データ待ち表示 |
| query string の週が manifest にない | manifest latest に正規化 |

## 環境ごとの注意点

| 環境 | 注意点 |
|---|---|
| 本番 | API 接続前提。repo 内 fallback はない |
| Preview | `MARKET_INFO_API_BASE_URL` が未設定だと未接続表示になる |
| ローカル | `.env.local` に `MARKET_INFO_API_BASE_URL` が必要 |

## 関連 docs

- [投資主体別売買動向 仕様](../specs/tools/investor-flow.md)
- [Market Tools データ取得経路一覧](../specs/cross-cutting/market-tools-data-fetch-paths.md)
- [2026-06-01 投資主体別売買動向の分析API優先表示](../decision-log/2026-06-01-investor-flow-analysis-api-view.md)
