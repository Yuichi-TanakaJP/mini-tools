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
- [ ] サマリータブで主体別・週次ヒートマップが表示される
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


## 公開更新の自動反映

| From → To | 通信・待機・失敗・復旧 |
|---|---|
| 最新週を表示中 → 新しい公開週 | visible時60秒、復帰時にno-storeのdataルートを確認。10秒タイムアウト。週・本文・分析を一緒に更新し、document reloadしない |
| 過去週を表示中 → 背景確認 | start/endを維持し、最新週へ勝手に移動しない |
| 通信失敗 → 自動/手動retry | 旧週・旧金額とラベルを保持。確認失敗を表示し、自動次回とキーボード操作可能なretryを提供 |
| 履歴へ移動・unmount → 前の応答完了 | 前の要求をabortし、新しい画面へ書き込まない |

API TTL30秒と画面60秒を合わせた通常公開反映目標は約90秒＋通信時間。HTTP応答・ブラウザー表示完了・fixture加速試験を区別する。背景1回の転送は本文/分析と直近選択肢のみ（目安100KB以下、実測はPR）。非表示タブでは停止。非同期処理中はaria-busy/statusで伝え、失敗を0件表示にしない。

テスト: `npm exec -- vitest run app/tools/investor-flow/__tests__`、`npm exec -- playwright test tests/ui-smoke/investor-flow-refresh.spec.ts --config=playwright.investor-flow.config.ts`。合成APIで新週公開・失敗→Enter retry・hidden/foreground・過去週固定・mobileを確認。本番更新・Cloud定期実行は別のリリース受入。

専用Playwright configは合成APIとproduction build/serverを起動する。外部API設定は不要。既存ブラウザーを使う環境では`UI_SMOKE_EXECUTABLE_PATH`に実行ファイルを指定できる。PWA非経由の状態テストに加え、NetworkOnly除外の単体回帰と、Service Worker有効のoffline試験を行う。
