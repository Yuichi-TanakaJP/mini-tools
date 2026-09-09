# 優待の共通データ層（切替工程3）

対象: 優待メモ、カレンダー/候補、ダッシュボード、期限・残高と依存通知。
2026-09-09時点では共通処理だけを追加。既存画面は未接続で、現在の保存先は変わらない。

## 全体の位置づけ

利用開始までの6工程は固定。工程数は作業量が均等ではないので割合へ換算しない。

| 工程 | 状態 |
|---|---|
| 1 全件読み取りAPI | stock-notes PR188でDB適用・検証済み |
| 2 日常更新24操作 | stock-notes PR190/191でDB適用・検証済み |
| 3 共通取得・保存・キャッシュ | 本変更の対象。コード・契約テスト・認証連携テスト |
| 4 既存画面接続 | 未着手。既存LocalStorageの隠れた書き戻しも対象 |
| 5 スマホ/PC/ChatGPT UAT・export/復旧 | 未着手 |
| 6 更新停止中の最新差分照合・read/write同時切替・旧同期停止 | 未着手 |

工程3の完了だけを「日常利用の切替完了」と呼ばない。高度なRealtimeや大規模UI再編を
この6工程の完了条件に追加しない。
[DB側の正本計画](https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/docs/yutai-minitools-cutover.md)も参照。

## 契約と入口

- `lib/yutai/contracts.ts`: workspace、24種類のcommand、返却値の型と受信検証。
- `lib/yutai/repository.ts`: テスト可能な共通キャッシュ・保存状態管理。
- `lib/yutai/runtime.ts`: 既存Supabase Auth sessionとRPC、ブラウザ復帰イベントの接続。
- `lib/yutai/browser.ts`: 遅延生成のブラウザ共有インスタンスと`useYutaiWorkspace(month)`。
  現段階では既存画面からimportしない。SSRでは本人データを作らない。

読み取りは `stock_notes_get_yutai_workspace({ p_month: 1..12 })`。
保存は `stock_notes_record_yutai_command({ p_input: command })`。
旧context、初回importer、table直接書き込み、旧tool_data同期は使わない。
DBルールの重複実装を避け、入力の業務制約・権限・revision・transactionの正本はDB側。
受信時はschema、月、全配列、件数、行fieldの型、enum、revisionを検証し、欠落を空配列へ変換しない。
未設定方針、NULLと0、株数・優待価値、全年度cycle、archive、全履歴を保持する。
月別selectionは毎年共通の月、cycleは権利年月。両者を混同しない。

## キャッシュと認証

- Supabaseのみ正本。キャッシュはメモリ内のみで、再読み込みやアプリ終了で消える。
  LocalStorage / IndexedDBにコピーも未送信操作も保存しない。
- ログイン本人と選択月ごとに分離。別ユーザーへの変更・logoutで全破棄。
  一度logoutして同じ本人に戻った場合も古い通信・保存要求を無効化。
- Auth callbackでは同期的な状態変更のみ。RPCはcallbackを抜けてから実行する。
- 各通信直前にsession ownerを確認し、確認したaccess tokenをその要求に固定する。
  途中でアカウントが変わっても別の本人として送らない。古い応答を新しい画面へ返さない。
- 同じ月への並行取得をまとめる。通常の画面遷移は30秒以内の新鮮なcacheを再利用する。
  30秒は初期の調整可能値で、リアルタイム保証ではない。
- focus、表示復帰、online復帰、明示`load(month, true)`で表示中の月を再取得。
  保存後は全月cacheを古い状態とし、表示中の月と保存元の月を再取得する。
- foregroundに居続ける別端末の更新をpushでは受けない。必要時は手動更新。
- RPC通信は15秒で中断。タイムアウトした保存は未保存と断定しない。
- オフラインは取得済みメモリcacheの閲覧のみ。再起動後のoffline閲覧は保証しない。
  `fetchedAt`と`stale`をUIに表示し、空データと認証エラーを区別する。

## 保存の組み込み方（工程4で必須）

1. 利用者が確認した編集内容と、その編集開始時の`expected_revision`から`prepare(draft)`。
2. 返った`PreparedCommand`をフォーム側で保持して`save(prepared, selectedMonth)`。
3. 同じ操作の二重クリック・不明結果の再確認では同じオブジェクトを使う。
   毎回`prepare`を呼び直して新しいrequest IDを作ってはいけない。
4. 全ての保存結果を次の表で分岐する。古い画面を成功表示で閉じない。

| 結果 | 意味・UIの扱い |
|---|---|
| saved | DB成功＋最新データ再取得完了。フォームを閉じられる |
| saved_refresh_failed | 保存済み、表示更新だけ失敗。「保存済み・再取得失敗」と表示し読み取りを再試行 |
| not_saved | offline、session事前不一致、DBの競合/入力拒否。理由を表示 |
| uncertain | 通信応答不明・不正応答・送信中の本人切替。未保存とも成功とも断定しない |

`uncertain`は同じprepared要求を再確認できる。DBの同一request再送機構により二重加算しない。
ページ終了やlogoutでprepared要求も使用できなくなるため、不明結果があるまま閉じない導線を工程4で用意する。
閉じた場合は最新データ/監査で確定結果を確認してから新規入力する。自動再送・offline queueはない。
競合時は最新データを取得するが、revisionを勝手に差し替えて保存し直さない。
成功済みrequestの再送応答は過去の結果なので、その応答だけで画面を更新せず必ず再取得する。
削除結果はafterとrevisionがnull。通常更新のrevisionと混同しない。
SQLエラー本文は画面へ返さず、安全な分類メッセージだけを返す。

## 検証と復旧

`npm test -- lib/yutai`で契約、並行取得、競合、二重送信、失敗、本人切替を検証する。
[UAT手順](../../uat/yutai-repository.md)と
[判断理由](../../decision-log/2026-09-09-yutai-authoritative-repository.md)を参照。
この追加はDB migrationや本番writeを含まず、既存保存処理を呼び替えない。
問題時はこの追加commitのrevertで戻せる。既存LocalStorage、旧tool_data、移行backupは残る。
画面接続後に新DBへ書いたデータの復旧は工程5/6で別途照合し、旧backupを無条件上書きしない。

公式確認: [RPC](https://supabase.com/docs/reference/javascript/rpc)、
[Authイベント](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)。
