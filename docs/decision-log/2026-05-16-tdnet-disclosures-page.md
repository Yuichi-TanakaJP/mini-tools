# TDNET適時開示一覧の初期実装方針

## 背景

`market_info` から R2 へ TDNET 日次 JSON を publish し、`market-info-api` から `tdnet/disclosures/latest` と `tdnet/disclosures/{date}` を配信できる状態になった。

mini-tools 側では、PDF / HTML / XBRL 本体を再ホストせず、API payload に含まれる URL をユーザーが開ける一覧画面を追加する。

## 決めたこと

- 新規ツールとして `/tools/tdnet-disclosures` を追加する。
- 初期表示は latest endpoint を使う。
- 日付指定は `?date=YYYY-MM-DD` を受け取り、date endpoint を使う。
- 表示項目は時刻、銘柄コード、会社名、タイトル、カテゴリ、PDF / HTML / XBRL リンク、決算短信フラグ、訂正フラグとする。
- 絞り込みは財務関連のみ、決算短信のみ、訂正除外、テキスト検索を提供する。
- 件数が多い日でも追いやすいように、カテゴリ、リンク種別、時間帯の絞り込みも提供する。
- 業績と配当は別テーマとして絞り込めるようにする。TDNET payload に専用 boolean がないため、業績は `is_earnings_release` とタイトル/カテゴリ、配当はタイトル/カテゴリの文字列で判定する。
- 日付移動は日付入力に加えて前日 / 翌日の矢印を提供する。
- 検索範囲は当日、過去7日、過去30日から選べるようにする。API は日別 endpoint なので、基準日から過去方向に複数日取得して mini-tools 側で結合する。
- latest が休日で `total_count=0` の場合も正常な空データとして扱う。

## 理由

- TDNET は日々の開示確認が主用途なので、latest と日付指定を最短導線にする。
- 本体ファイルを mini-tools 側で保持しないことで、データ連携の責務を API と公開元 URL 表示に限定できる。
- 決算短信と訂正開示は個人投資家が頻繁に確認するため、初期実装からフィルタとして提供する。

## 影響範囲

- `app/tools/tdnet-disclosures/`
- トップページのツール一覧
- sitemap
- ツール仕様と UAT
