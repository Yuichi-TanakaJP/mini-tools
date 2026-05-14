# 2026-05-14 日興信用 JSON contract

## 背景

- `yutai-candidates` は `MARKET_INFO_API_BASE_URL/nikko/credit` から日興信用情報を取得している。
- これまでは信用買い・売り可否と一般売建可能数量のみを UI 側の型とサンプルに持っていた。
- upstream で公的規制・社内規制も含む JSON format を扱うため、mini-tools 側の参照仕様を固定する必要が出た。

## 今回決めたこと

- `GET /nikko/credit` はトップレベルに `date`、`generated_at`、`record_count`、`by_code` を持つ。
- `by_code` の各銘柄レコードは信用可否、一般売建可能数量に加えて、次の規制情報を持つ。
  - `has_exchange_regulation`
  - `has_internal_regulation`
  - `regulation_sources`
  - `regulation_details`
- `regulation_sources` の値は `exchange` / `internal` に限定する。
- `regulation_details` は `source|market|restriction|effective_date` を基本形にする。
- 日興の現行社内規制ページのように市場列がない場合は、`source|restriction|effective_date` として `market` を省略する。
- `yutai-candidates` の表示は `一般売可` / `一般注意` / `一般規制` / `制度売可` の 4 種類を基本にする。
- `一般在庫?` は UI に出さず、内部的な監視継続対象として扱う。
- `3549` は `新規売建規制 取引停止` により `一般規制` として表示する。

## 判断理由

- 公的規制と社内規制を boolean と sources で持つと、UI では有無を低コストに判定できる。
- `regulation_details` を配列で保持すると、同一銘柄に複数規制があるケースをそのまま表現できる。
- 社内規制ページに市場列がない現状に合わせ、欠けた市場名を空文字で埋めず、形式自体を短くする方が元データとの差分が少ない。
- 優待カレンダーでは一般信用クロス可否の判断が主目的なので、制度信用は一般クロス判定と混ぜず別 badge として表示する。
- `general_short=false` かつ `available_shares>0` のような曖昧な状態は、画面に推測ラベルを出すより、監視継続対象として内部分類する方が誤解が少ない。

## 影響範囲

- `yutai-candidates` の日興信用データ型
- `yutai-candidates` の開発用サンプル JSON
- market tools のデータ取得・外部 API contract docs

## 残課題

- 規制情報のうち `新規売建規制 取引停止` と `貸株注意喚起` 以外を UI でどう扱うかは今回決めない。
- `regulation_details` を将来 structured object にするかどうかは、表示要件が固まってから判断する。

## 関連

- 参照 docs: [Market Tools データ取得経路一覧](../specs/cross-cutting/market-tools-data-fetch-paths.md)
