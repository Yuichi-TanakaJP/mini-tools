# 優待カレンダー 仕様

URL: `/tools/yutai-candidates?month=YYYY-MM`。月別市場データを検索し、ピック/パス、
長期条件・仕込み開始・銘柄メモを編集する。市場データの取得元とfallbackは
[UAT](../../uat/yutai-candidates.md)を参照。

## 保存先と接続範囲

通常は従来のLocalStorageと既存同期を使用する。本番切替は未実施。
`NEXT_PUBLIC_YUTAI_CANDIDATES_DB_PREVIEW=true` は隔離検証専用で、カレンダーだけを
[共通データ層](../cross-cutting/yutai-repository.md)に接続する。本番で単独有効化しない。
Supabase公開設定とログインが必要。Premium権限を新設するものではなく、DB側で本人に限定する。
検証モードは従来データへのfallbackもLocalStorageへの保存も行わない。
メモ帳本体・ダッシュボード・期限帳・共通同期/通知は未接続なので、本番利用開始とは別。

| 操作 | 検証モードの保存 |
|---|---|
| ピック/パス/解除 | 表示中の月のselection。解除はunreviewedでglobal評価を上書き。global行は変更しない |
| 長期フラグ・仕込み開始 | 銘柄の対象月state。未登録ならprofileと月を作成 |
| メモ追加 | 不足するprofile/月だけ作成。既存メモ・他の月を上書きしない |
| メモ編集 | 変更したprofile項目と対象月項目だけを更新 |
| 仕込み済み | ラベルに示す権利年月のcycle。権利確保後の状態変更は拒否 |
| 追加解除 | 対象month stateのみ削除。最後の月でもprofile・履歴・残高は残す |

新規profileの方針は「未設定」、優先度は★★。入力した名称と銘柄コードを使う。
非表示profileは自動復活せず操作を止める。株数・優待価値は読み取りprojectionに保持し、
他項目の更新では送信しない。カレンダーへの新しい数値入力UIは今回追加しない。
仕込み月表示は各月stateのリード月数を使用し、NULLと0を区別する。
移行処理は元の月別未設定をNULLとして明示的に保存しているため、profileの既定値で
NULLを補完しない。既定値自体はDBに保持し、この画面では変更しない。

## 状態・失敗・復旧

- 初回取得中や未ログイン時は本人データを出さない。取得失敗時は空データに置き換えない。
- 最終取得時刻と古いcacheを表示し、古い状態での編集は止める。手動再取得が可能。
- 編集を開いた時のrevisionを保持。競合しても新しいrevisionへ自動差し替えしない。
- 保存中は編集と通常の画面移動を止め、結果不明時は同じrequest IDで再確認する。
- 保存済み・再取得失敗時は読み取りだけ再試行。DB保存を重ねない。
- 複数commandを含む操作は一括transactionではない。完了数を表示し、成功した処理を
  巻き戻さず残りを再確認する。確定拒否後は再取得して編集を開き直す。
- 不明な操作はメモリにのみ保持。クライアント内の月移動では保持するが、ブラウザ終了や
  logoutを強行した場合は最新データ/監査で結果を確認してから再入力する。
- 本番環境変数、既存tool_data、スマホバックアップをこの実装で変更しない。
  検証モードを無効化してもDBに保存した内容は消えないが、旧画面へ自動逆移行はしない。

## 関連

- [UAT](../../uat/yutai-candidates.md)
- [判断理由](../../decision-log/2026-09-09-yutai-calendar-db-connection.md)
- [画面](../../../app/tools/yutai-candidates/ToolClient.tsx)
- [変換とcommand](../../../lib/yutai/calendar.ts)
- [途中保存の状態管理](../../../lib/yutai/action-runner.ts)
