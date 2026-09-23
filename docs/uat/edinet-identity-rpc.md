# EDINET Financial identity RPC: 本人GET UAT

この画面は本人ログイン済みブラウザから、固定した1候補へのPostgREST GETを1回行うための一時的な検証導線。Canonical登録、Production DB書き込み、R2公開は行わない。画面の「事前チェック通過」は合格判定ではない。

- URL: `/tools/stock-notes/edinet-identity-uat`（ナビゲーション非掲載、noindex。URL秘匿は認可手段ではない）
- 候補: EDINET docID `S100VWHX`、secCode `45430`、JPX `4543`、提出日 `2025-06-23`。保存済みEDINET type2 document-listの実行前証拠に基づく。現在の正式な銘柄紐付けを保証するものではない。
- ログイン中の本人がボタンを1回押す。画面はSupabaseセッションのaccess tokenをリクエストヘッダーで使うが、表示・ログ保存・ファイル化しない。再試行には原因確認が必要。
- HTTP status、時刻、応答本文SHA-256、軽量事前チェックを記録する。200以外、事前チェック失敗、通信失敗は未合格。200でも完全validatorを通すまで未合格。
- 200応答だけ「生レスポンスをローカルに保存」を押し、Stock Notes側 `scripts/verify_edinet_financial_identity_rpc_snapshot_v1.py` の使用方法に従って検証する。ダウンロードしたJSONは所有者情報を含み得るため公開・PR添付しない。HTTP GETの実行証拠とSHA-256を別に残し、packet内容のみで認証済み通信を主張しない。
- 完全validatorの不合格、reference不在/複数、link/listingの矛盾を0件・正常と読み替えない。候補・時点が固定されたUATであり、過去の提出日時点の会社同一性を証明しない。

公開環境に画面を反映するには別途レビューとデプロイ承認が必要。実ユーザーでのGETはデプロイ後の独立したgateであり、このPRのテストだけでは完了しない。
