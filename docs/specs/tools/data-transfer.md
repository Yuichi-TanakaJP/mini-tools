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
- この欄は照合専用。復元は下記の独立した確認欄からのみ実行する。旧形式インポートは未接続。

## 優待DBの復元（隔離検証）

- `lib/yutai/restore-transport.ts` に専用のpreview/apply/get接続を追加。既存runtimeの本人セッション固定・15秒timeoutを共用する。
- preview送信前にファイル本体のチェックサム、本人、project、理由、要求IDを検査する。applyにはプランIDと確認hashだけを送る。
- 通信結果不明時の自動再実行は行わない。送信中の本人変更後は成功結果を画面に渡さず、結果不明として扱う。
- `NEXT_PUBLIC_YUTAI_TRANSFER_DB_PREVIEW=true` と `NEXT_PUBLIC_YUTAI_RESTORE_DB_PREVIEW=true` の両方で独立した復元欄を表示する。未設定時は表示せず、復元RPCを送らない。本番では両フラグをまだ有効化しない。
- 読み込んだファイルはブラウザメモリだけに置く。「差分を確認」でDBへ送り、変更前コピーをprivate領域に保全する。業務行を移動して空にはしない。
- before/afterの8配列・全行・全fieldを検査し、サーバーの差分を独立に再計算して一致確認。追加/変更/削除の件数と全差分を折りたたみで表示する。revision/updated_atの差分も省かない。confirmation_hashはDBのJSONB正規化による固定値として扱う。
- 変更前を通常の優待DB出力形式でダウンロードする。実際のJSONを再パース・checksum確認後に開始する。ファイル名 `mini-tools-yutai-before-<plan_id>.json` に復元プランIDを含む。端末での保存と削除を含む差分への同意チェック、最後の確認ダイアログが揃ったときだけapplyする。
- 日常保存がrunning/pausedならプレビューを開始しない。確認中・適用中・結果不明中は共通repositoryで通常保存を拒否する。DBは別端末の更新も全行比較で競合検知する。ブラウザ内の排他だけを安全性の根拠にしない。
- 通常の画面移動には警告するが、バックアップのblobダウンロードは妨げない。制御状態は同一セッションのクライアント遷移で維持する。ログアウト/本人変更時はprivateな画面状態を破棄する。
- 応答不明時はGETで同じプランを照会する。新しいプランへ置換せず、自動applyしない。preparedならバックアップ/同意を再確認して同じIDだけを明示再送できる。期限切れの再送はDBが適用済み記録を返すか未適用として拒否する。新規プランの期限切れは送信前に止める。
- 成功receiptの全fieldがプランafterと一致しても、それだけで完成表示しない。全cacheを無効化しworkspaceを再取得して、8種類の全fieldを照合する。取得失敗は「復元済み・照合未完了」、差分ありは「復元済み・現在DBに差分」とし、再適用しない。
- 再読み込み後はダウンロード名にあるプランIDを入力してGETから再開する。ファイル/プラン/認証情報をLocalStorageに保存しない。バックアップを復元前へ戻す場合も新規プレビューと明示確認を必須とする。
- これは業務データの復元UIであり、本番migration適用・復元先設定・実端末UAT・切替は別工程。本番の設定やデータは変更しない。旧形式の自動変換も追加しない。

## 従来の端末バックアップ

既存LocalStorage版は維持する。`mini-tools-localstorage-backup` 形式を出力し、merge/replaceで端末へ取り込む。
優待DB専用形式は従来parserで拒否し、端末形式はDB照合parserで拒否する。両形式を自動変換しない。
旧端末のexport/import迂回経路の切替時無効化は工程6の残件。今回の追加で他ツールの保存先を変更しない。

## 関連

- [UAT](../../uat/data-transfer.md)
- [判断理由](../../decision-log/2026-09-10-yutai-db-export.md)
- [復元UIの判断理由](../../decision-log/2026-09-10-yutai-restore-ui.md)
- [全体工程](../cross-cutting/yutai-repository.md)
- 実装: `lib/yutai/transfer.ts`、`app/tools/data-transfer/DatabaseTransfer.tsx`
