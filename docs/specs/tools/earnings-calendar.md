# 決算カレンダー 仕様

## 概要

- URL: `/tools/earnings-calendar`
- 分類: 市場データ系ツール
- 主な用途: 国内株・海外株の決算予定を月間カレンダーと日別一覧で確認する

## 対象ユーザー

- 決算予定を日付単位で確認したいユーザー
- 国内株と海外株の決算予定を同じ画面で切り替えて見たいユーザー
- 銘柄名やコードから決算日を検索したいユーザー

## 画面仕様

### 主な画面要素

- 銘柄検索バー
- 国内 / 海外の切り替えタブ
- 月切り替えタブ
- 月間カレンダー
- 選択日の決算一覧
- 休場日表示
- Yahoo ファイナンスへの外部リンク

### 入力

- 検索キーワード
  - 銘柄名の一部
  - 国内銘柄コード
  - 海外ティッカー
- タブ選択
  - 国内 / 海外
  - 対象月
- カレンダー上の日付選択

### 出力

- 月間カレンダー上の日別決算件数
- 選択日の決算予定一覧
- 銘柄名、コードまたはティッカー、市場、決算時刻、決算種別
- 検索結果一覧
- JPX / US 休場日表示

## データ仕様

### 取得元

| データ | 取得元 |
|---|---|
| 国内 manifest | API 優先、失敗時は repo 同梱 JSON |
| 国内 月別データ | API 優先、同一月の API 失敗時は repo 同梱 JSON |
| 国内 latest | API 優先、API 未設定時は repo 同梱 JSON |
| JPX 休場日 | repo 同梱 JSON |
| 海外 manifest | `MARKET_INFO_API_BASE_URL` の API |
| 海外 月別データ | `MARKET_INFO_API_BASE_URL` の API |
| 海外 latest | `MARKET_INFO_API_BASE_URL` の API |
| US 休場日 | `MARKET_INFO_API_BASE_URL` の API |

### 保存先

- ユーザー入力データは保存しない
- 検索語や選択状態は画面操作中の UI state として扱う
- サーバー DB や LocalStorage には保存しない

### fallback

- 国内データは API が使えない場合でも repo 同梱 JSON で表示する
- 国内月別データは、API manifest が取れていても該当月 API が失敗した場合、同梱 JSON の同一月で補完する
- 海外データは API 専用。API 未設定または失敗時はデータなし扱いにする
- US 休場日が取れない場合は、休場日マークなしで表示する

## ホーム通知

- ホーム画面は `/api/earnings-calendar/notifications` から今日・明日の国内/海外決算予定を取得する
- 通知カードには、今日・明日の国内/海外件数と、端末内の保有/ウォッチ銘柄、日経225採用銘柄に一致する決算予定の一部を表示する
- 保有/ウォッチ銘柄の照合はブラウザ内で行い、登録銘柄コードは API へ送信しない
- 日経225採用銘柄コードは日経225寄与度の最新日次データから取得し、通知 API の公開データとして返す
- 保有/ウォッチと日経225の両方に一致する銘柄は、保有/ウォッチ枠を優先して重複表示しない
- 決算通知は既読管理を持たず、日付が変わることで自然に入れ替わる予定表示として扱う

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | Server Component で国内・海外データを並列取得し、Client Component に渡す |
| 国内データなし | raw error を出さず、データなしに準じた表示にする |
| 海外 API 未設定 | 国内タブは表示し、海外タブはデータなし扱いにする |
| 海外 API 失敗 | 国内タブは影響を受けない |
| 検索一致なし | 一致する銘柄がない旨を表示する |

## premium / 権限制御

- premium 制限なし
- ログイン不要で利用できる

## 関連実装

- [app/tools/earnings-calendar/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/earnings-calendar/page.tsx)
- [app/tools/earnings-calendar/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/earnings-calendar/ToolClient.tsx)
- [app/tools/earnings-calendar/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/earnings-calendar/data-loader.ts)
- [app/tools/earnings-calendar/types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/earnings-calendar/types.ts)

## 関連 docs

- UAT: [決算カレンダー UAT](../../uat/earnings-calendar.md)
- Decision Log:
  - [決算カレンダーのデータ contract と運用メモ](../../decision-log/2026-03-22-earnings-calendar-data-contract.md)
  - [海外決算カレンダー統合方針](../../decision-log/2026-04-05-overseas-earnings-calendar-integration.md)
  - [決算カレンダーへの銘柄検索機能追加](../../decision-log/2026-05-02-earnings-calendar-search.md)
