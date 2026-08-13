# 2026-08-13 銘柄分析ダッシュボードの銘柄単位差分同期

## 結論

`/tools/stock-notes` は、前回キャッシュを表示した後、銘柄単位のmanifestをサーバーへ渡して差分を取得する。変更がない銘柄の子データはレスポンスに含めない。

最初の実装では既存のSupabaseスキーマを変更せず、サーバー側で現在の表示用データから内容ハッシュRevisionを計算する。将来データ量が増えた場合は、DBトリガーで銘柄ごとのRevisionを更新する方式へ移行できる。

## 背景

`stock_notes_stocks`、`stock_notes_analyses`、`stock_notes_theses`、`stock_notes_actions` は `stock_id` で銘柄単位に紐づいている。一方、分析・見立てには更新日時がなく、既存の `updated_at` だけでは子データの追加・編集・削除を漏れなく検出できない。

いきなり親テーブルへRevision列やトリガーを追加すると、分析を書き込む別リポジトリとのスキーマ同期が必要になる。そのため、まずはmini-toolsのRoute Handlerで4テーブルを並列取得し、画面に必要な表示フィールドを銘柄ごとに正規化してハッシュ化する段階導入にした。

## 決めたこと

- `POST /api/stock-notes/delta` がログイン中ユーザーのRLS範囲でmanifestを作る。Supabase RPCが利用できる環境ではDB内でMD5内容ハッシュを計算し、未適用環境ではRoute Handlerの互換フォールバックを使う（ハッシュは差分判定用であり、セキュリティ用途ではない）
- クライアントは前回の `{ stockId: revision }` を送る
- Revisionが一致する銘柄は子データを返さない
- Revisionが変わった銘柄は銘柄本体・分析・見立て・未消化アクションをまとめて返す
- `stock_notes_stocks` から完全なmanifestで消えた銘柄だけを `deletedStockIds` として返す
- `category = archived` は銘柄行が存在するため削除しない
- APIエラー、JSON不正、未完全レスポンスではキャッシュを削除しない
- 差分APIが使えない場合は従来のSupabase直接取得へフォールバックする
- アクションのハッシュ対象は画面表示対象の `open` のみとする。`open -> done/dismissed` はopen一覧の変化として検出できる
- 分析本文 `body` は一覧表示と既存キャッシュの対象外なのでRevision対象に含めない。本文は「原文を表示」操作時に個別取得する

## 削除と整合性

削除判定は「manifestが完全に取得できた」場合だけ成立する。通信失敗時に空配列を正常データと解釈しないため、HTTPエラーはdelta適用前に止める。

差分レスポンスを適用する際は、変更銘柄の子データを置き換え、削除銘柄に紐づく子データもキャッシュから除去する。アーカイブは通常の変更銘柄として置き換え、アーカイブタブに残す。

4クエリは同一トランザクションではないため、更新と同時に取得した場合は一時的に混在したRevisionになる可能性がある。ただし次回manifestでRevisionが変わり、再取得される。DBトリガー方式へ移行する際は、RPC内で一貫したsnapshotを返す契約にする。

## 関連実装

- `app/api/stock-notes/delta/route.ts`
- `app/tools/stock-notes/delta.ts`
- `app/tools/stock-notes/cache.ts`
- `app/tools/stock-notes/load.ts`
