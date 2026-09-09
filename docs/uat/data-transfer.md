# データ入出力 UAT

## DB隔離検証

ローカル/Previewに `NEXT_PUBLIC_YUTAI_TRANSFER_DB_PREVIEW=true` とSupabase公開接続設定を指定する。
自動試験は `npx playwright test --config=playwright.yutai.config.ts yutai-transfer.spec.ts`。合成session/模擬DBのみを用いる。

1. 本人ログインでDB出力欄を開く。非表示銘柄、8月/9月の異なる設定、2025年/2026年履歴、タグ割当、archive済み残高、残高履歴、global/月別選択を用意する。
2. DB全件JSONをダウンロードし、全8種類の全フィールド・件数、NULL/0、小数、日時精度、ID/revisionが取得値と一致することを確認する。
3. 出力した同じJSONを読み込み「全件照合」で一致を確認する。ファイルに認証情報や他ツールのLocalStorageが混入しないこと。
4. 別端末相当の更新後に再照合し、対応する種類に内容変更件数が出ること。現在DBとファイルのどちらも書き換わらないこと。
5. 値を改変したJSON、配列欠落、件数不一致、ID重複、参照先欠落、旧形式、未知version、不正JSON、上限超過を拒否すること。
6. 別owner/projectのファイルは照合を拒否し、自動適用しないこと。
7. キャッシュがある状態で次の取得を失敗させる。ダウンロードが発生せず、旧キャッシュを最新として扱わないこと。
8. 取得中のlogout/login、未確定の保存がある場合に出力を中止すること。未ログイン時はDB出力ボタンを出さないこと。
9. 旧LocalStorageキーと他ツールのデータが不変であること。DB更新コマンド/旧保存APIが呼ばれないこと。
10. メモ/期限帳のDB版からリンクで移動できること。従来の端末バックアップ欄とDB出力欄の区別が明確であること。

実端末での保存ファイル確認・本番認証・復元演習は工程5で実施する。ファイル検証だけで復元成功としない。

関連: [仕様](../specs/tools/data-transfer.md)、[判断記録](../decision-log/2026-09-10-yutai-db-export.md)。
