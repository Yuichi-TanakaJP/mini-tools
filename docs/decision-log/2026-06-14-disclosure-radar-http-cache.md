# 2026-06-14 開示レーダーの日付別JSONとブラウザHTTPキャッシュ

## 背景

- 開示レーダーは1日・7日・30日を切り替えるため、従来はServer Componentが
  画面表示時に直近30日分の日付別APIをまとめて取得していた。
- 開示イベントの過去日付JSONはpublish後に変更しないため、毎回30日分をサーバーで
  集約する必要はない。

## 今回決めたこと

- `market_info`の日付別JSONとmanifestをそのまま利用し、7日・30日の集約JSONは作らない。
- mini-toolsに同一オリジンのmanifest・日付別routeを置き、Client Componentから取得する。
- 日付別routeは1年間の`immutable` HTTPキャッシュ、manifestは5分キャッシュとする。
- 表示期間の集約とマイ銘柄照合はブラウザ内で行う。
- IndexedDBやlocalStorageにイベントデータ本体を重複保存しない。

## 判断理由

- 通常利用ではmanifest確認と新しい1日分だけの追加取得にできる。
- 同一オリジンrouteを使うため、Cloud Run APIへのブラウザ直接アクセス用CORSや
  公開環境変数を追加しなくてよい。
- HTTPキャッシュはブラウザが容量管理する。消去されても日付別APIの再取得だけで復旧できる。
- rolling 7日・30日JSONの毎日再生成と重複保存を避けられる。

## 影響範囲

- `/tools/disclosure-radar`
- mini-toolsの開示イベントmanifest・日付別route
- market-info-apiの開示イベントHTTPキャッシュヘッダー
- 既読IDとマイ銘柄のlocalStorage仕様は変更しない。

## 残課題

- 実データが30日蓄積した時点で、初回取得量と再訪時の転送量を再計測する。
- LINE内ブラウザと通常ブラウザはキャッシュ領域が別になる可能性があるため、
  キャッシュ共有を前提にしない。

## 関連

- 参照 docs: `docs/specs/tools/disclosure-radar.md`
- 参照 docs: `docs/uat/disclosure-radar.md`
