# 開示イベントレーダー 仕様

## URL

- `/tools/disclosure-radar`
- `?view=my-stocks` でマイ銘柄タブを初期表示する。

## 目的

- TDNET由来の正規化済みイベントから、確認優先度の高い開示を一覧化する。
- 株主優待の変更は銘柄リストに関係なく表示する。
- 配当、業績修正、自社株買い、M&A、人事、訂正はマイ銘柄に一致するものを表示する。

## データ取得

- Server Component が `MARKET_INFO_API_BASE_URL/disclosure-events/latest` を取得する。
- API未設定または取得失敗時はエラー案内を表示する。
- 開示本文は保持せず、APIが返す公開元URLへリンクする。

## 端末内フィルタ

- マイ銘柄は `my_stocks_items_v1` から読み込む。
- APIからは公開イベントを広めに取得し、銘柄コードとの照合はClient Component内で行う。
- マイ銘柄の登録内容はAPIへ送信しない。
- TDNETの英数字5桁コードが末尾`0`の場合は、4桁コードへ正規化して照合する。

## 表示

- `優待変更`: `audience=all` のイベント。
- `マイ銘柄`: `audience=personal` かつ端末内リストと一致するイベント。
- 銘柄コード、会社名、タイトルによるクライアント検索に対応する。
- 分類、優先度、要確認フラグ、開示時刻、公開元リンクを表示する。

## 関連

- [UAT](../../uat/disclosure-radar.md)
- [設計判断](../../decision-log/2026-06-13-disclosure-radar-and-mobile-nav.md)
