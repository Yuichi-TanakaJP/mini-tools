# データ入出力

URL: `/tools/data-transfer`。

## 優待DBの出力・照合（工程4、隔離検証）

`NEXT_PUBLIC_YUTAI_TRANSFER_DB_PREVIEW=true` の場合だけ、従来の端末バックアップとは別枠で表示する。
Supabase設定と本人ログインが必要。優待メモ・期限帳のDB版からもリンクする。本番フラグはまだ有効にしない。

### 出力

- 共通repositoryで `stock_notes_get_yutai_workspace({p_month:1})` を再取得する。月1は選択の表示引数で、全月・全年の行を返す。
- 銘柄（非表示含む）、月別設定、全年度cycle、タグ、タグ割当、優待残高（archive含む）、残高履歴、global/月別選択の8種類を全件保存する。
- ID、revision、日時の原文、NULLと0、小数、追加フィールドを保持する。取得APIのworkspace全体をJSONに格納する。
- schema=`mini-tools-yutai-workspace-export`、version=1。sourceにproject URLとowner UUID、取得/出力日時、coverage=`workspace_current_state`、SHA-256を付ける。認証token/session/APIキーは取得元情報に入れない。
- SHA-256はsha256フィールドを除いたオブジェクトを、再帰的にキー順固定したJSONとしてUTF-8で計算する。破損検知であり署名/作成者認証ではない。
- 出力上限10MiB、再帰階層32。実際のダウンロードJSONを再パース・チェックサム検証してから保存を開始する。
- 通信失敗、本人切替、未確定の保存がある時は中止。古いキャッシュへfallbackしない。ダウンロードは利用者が端末側で確認する。
- **DB全体のバックアップではない**。削除済み行・操作監査・移行管理情報・DBスキーマ/認証設定等はworkspace APIに含まれず、出力対象外。既存のDBバックアップは引き続き保持する。

### 読み戻しと照合

- JSON、schema/version、checksum、配列/件数、ID/自然キー重複、参照先欠落/不一致を検査する。欠落配列を空配列で補完しない。
- ファイルはブラウザメモリ内で読む。アップロード・LocalStorage保存・DB書き込みをしない。
- 現在の本人・projectがファイルのsourceと一致する場合のみ照合。照合前もDBを再取得する。
- 8種類それぞれでID（タグ割当はprofile_id/tag_id）により照合し、全フィールドの一致、ファイルのみ、DBのみ、内容変更の件数を表示する。配列順・オブジェクトのキー順は無視する。
- `as_of`/取得日時や表示月による`effective_selections`は派生表示のため比較対象外。元のselections全件は比較する。
- 差分IDの表示は各区分先頭20件まで。件数と一致判定は全件対象。照合時刻を示し、その後の更新は再照合が必要。
- 復元実行・旧形式インポートは未接続。読み込むだけで現在DBへ適用せず、古いデータによる上書きを避ける。

## 従来の端末バックアップ

既存LocalStorage版は維持する。`mini-tools-localstorage-backup` 形式を出力し、merge/replaceで端末へ取り込む。
優待DB専用形式は従来parserで拒否し、端末形式はDB照合parserで拒否する。両形式を自動変換しない。
旧端末のexport/import迂回経路の切替時無効化は工程6の残件。今回の追加で他ツールの保存先を変更しない。

## 関連

- [UAT](../../uat/data-transfer.md)
- [判断理由](../../decision-log/2026-09-10-yutai-db-export.md)
- [全体工程](../cross-cutting/yutai-repository.md)
- 実装: `lib/yutai/transfer.ts`、`app/tools/data-transfer/DatabaseTransfer.tsx`
