# 銘柄の注目目的と信用残監視を独立して管理する

## 決めたこと

既存stock masterへ複数の注目目的とnullable信用残監視設定を追加する。分類は追跡段階、目的は追う理由、信用残設定は取得可否として独立させる。銘柄詳細の中に専用フォームを置き、分類や分析を変更せず保存する。

## 理由と範囲

優待狙いのウォッチを信用残監視へ一括追加しないため。Portfolioの商品保有目的とは粒度と用途が異なるので、その情報はコピーしない。新規調査をwatchへ昇格させず信用残だけ明示ONにすることも可能にする。

未指定/nullは既存実保有だけが対象となる互換設定、falseは明示除外、trueは明示対象。アーカイブは常に除外。未取得/不正値をfalseへ変換しない。

## 表示と更新

一覧に目的badgeと信用残設定を表示し、詳細フォームで複数選択/三状態selectを保存する。同path・URL/history追加なし。保存中は二重操作を防ぎ、失敗時は入力を保持して再試行を案内する。本人JWT/RLSで2項目とupdated_atのみ更新し、0行更新を成功にしない。直接DB読取と既存差分BFFの双方を拡張し、旧キャッシュは無効化する。

## 配備と検証

DB additive migrationとStock Notes APIを先に準備し、その後UIを配備する。main mergeが既存Vercel Git連携による本番公開を起動するため、merge前に対象テスト・build・独立レビュー・承認を揃える。UI UATはdocs/uat/stock-notes.md参照。実認証/DB保存確認と合成UI確認は区別する。

旧get_stock_notes_delta RPCは新列の完全性を宣言しないため、monitoringMetadataVersion=1を宣言するまで既存4-table互換読取へfallbackする。旧RPCが変更0件を返しても信用残設定の完全性とは扱わない。当面はRPC確認1回＋既存4読取となるが、互換fingerprintは新項目とupdatedAtを含むため更新を見落とさない。
