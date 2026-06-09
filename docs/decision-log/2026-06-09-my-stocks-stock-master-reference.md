# My Stocks Stock Master Reference

Date: 2026-06-09

## Decision

`my-stocks` の公開基盤情報は `MARKET_INFO_API_BASE_URL` が設定されている場合、`GET /stock-master/latest` を優先して取得する。

API が未設定または取得失敗した場合は、従来どおり優待 month API と決算カレンダー API から code map を合成する fallback を残す。

画面には保存対象の `保有メモ` / `ウォッチ` に加えて、保存形式を変えない表示専用タブ `銘柄一覧` を追加する。`銘柄一覧` は client 側の銘柄マスターを一覧・検索し、各行から保有またはウォッチへ追加できる。件数が多いため、50件単位のページ送りを持つ。

## Reason

`market_info` 側で JPX 銘柄マスター、決算予定、優待、配当利回りを結合した stock master を publish できるようになったため、mini-tools 側で複数 endpoint を読んで同じ基盤情報を再構成するより、latest reference artifact を優先するほうが軽く、表示項目も揃えやすい。

## Impact

- `my-stocks` は次回決算・優待月に加えて配当利回りと推定年間配当を badge 表示できる。
- `銘柄一覧` では配当利回りと配当額を分けて表示する。
- `dividend_per_share` は確定配当ではなく `market_info` 側の利回り・株価からの逆算推定値として扱う。
- `銘柄一覧` タブは表示専用で、localStorage の `tab` 値は `holding` / `watch` のまま維持する。
- stock-master API が取得できた場合は、その records を配当付きの銘柄一覧として使う。
- 銘柄名の全角英数字は `market_info` の stock master artifact 側で半角化する。mini-tools は `/data/jpx_listed_companies.json` fallback にも同じ表示変換を適用する。
