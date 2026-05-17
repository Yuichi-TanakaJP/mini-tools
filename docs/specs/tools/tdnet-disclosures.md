# TDNET適時開示一覧 仕様

## 概要

- URL: `/tools/tdnet-disclosures`
- 分類: 個人投資家向け市場情報ツール
- 主な用途: TDNET の全適時開示を日付ごとに確認し、会社名・銘柄コード・タイトル・カテゴリで絞り込む

## 対象ユーザー

- 国内株の適時開示を日次で確認したい個人投資家
- 決算短信、訂正開示、財務関連開示を素早く探したいユーザー

## 画面仕様

### 主な画面要素

- ページヘッダー
- 日付入力、表示ボタン、latest ボタン
- 日付の前日 / 翌日移動
- 検索範囲選択
  - 当日
  - 過去7日
  - 過去30日
- 対象日、対象日数、総件数、フィルタ後件数
- 検索入力
- フィルタボタン
  - 財務関連のみ
  - 決算短信のみ
  - 訂正を除外
- カテゴリ選択
- リンク種別フィルタ
  - PDFあり
  - HTMLあり
  - XBRLあり
- テーマフィルタ
  - 業績
  - 配当
- 時間帯フィルタ
  - 午前
  - 昼休み
  - 午後
  - 15:30以降
- 適時開示テーブル

### 入力

- 日付: `YYYY-MM-DD`
- 日付移動: 前日 / 翌日の矢印
- 検索範囲: 当日、過去7日、過去30日
- 検索: 銘柄コード、会社名、タイトル、カテゴリ
- フィルタ: 財務関連、決算短信、訂正除外、カテゴリ、リンク種別、テーマ、時間帯

### 出力

- 時刻
- 銘柄コード
- 会社名
- タイトル
- カテゴリ
- PDF / HTML / XBRL リンク
- 決算短信フラグ
- 訂正フラグ

## データ仕様

### 取得元

- `MARKET_INFO_API_BASE_URL/tdnet/disclosures/latest`
- `MARKET_INFO_API_BASE_URL/tdnet/disclosures/{date}`
- 過去7日 / 過去30日は、基準日から過去方向に日別 endpoint を複数取得して mini-tools 側で結合する

### 保存先

- mini-tools 側では保存しない
- TDNET PDF / HTML / XBRL 本体は再ホストせず、URL リンクだけを表示する

### fallback

- API base URL 未設定、取得失敗、5 秒タイムアウト時はデータなし表示にする
- latest が休日の場合は `total_count=0` を正常な空データとして扱う
- 業績/配当フィルタは専用 boolean がないため、タイトル・カテゴリと `is_earnings_release` から判定する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | latest endpoint を取得して表示する |
| 日付指定 | `?date=YYYY-MM-DD` から date endpoint を取得して表示する |
| 範囲指定 | `?range=7` または `?range=30` で基準日を含む過去日数分を結合して表示する |
| データなし | 休日やTDNET休止日の可能性を含む空状態メッセージを表示する |
| 取得失敗 | API設定または通信状況の確認を促すメッセージを表示する |
| 保存失敗 | 保存処理がないため該当なし |

## premium / 権限制御

- なし。無料公開ツールとして扱う。

## 関連実装

- `app/tools/tdnet-disclosures/page.tsx`
- `app/tools/tdnet-disclosures/data-loader.ts`
- `app/tools/tdnet-disclosures/ToolClient.tsx`
- `app/tools/tdnet-disclosures/types.ts`

## 関連 docs

- UAT: [tdnet-disclosures.md](../../uat/tdnet-disclosures.md)
- Decision Log: [2026-05-16 TDNET適時開示一覧の初期実装方針](../../decision-log/2026-05-16-tdnet-disclosures-page.md)
- Backlog: [TDNET 複数日検索 range API 化 検討メモ](../../backlog/tdnet-range-api-architecture.md)
