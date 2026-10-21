# 管理画面の日付品質 UAT

環境: ローカルproduction build + 合成API、desktop/390x844 mobile。実施結果はPR本文へ記載。

1. premium認証後 `/admin` を開き、国内3ソースのUNKNOWNと取引日未確認パネルを確認する。
2. 最新10/20、週末10/18・17、生成時刻10/19 15:51Zのfixtureで、3ソースとも週末2件・最新平日10/20（祝日未判定）と表示する。相場日の確定とは表示しない。
3. desktopのheatmapへ切り替えてもパネルが残る。mobileでも3件読めてパネル内の横溢れがない。
4. API取得不可はFAILED、未提供日時は未提供。原データ、APIキャッシュ契約、取引日の付替え、タスク設定は変わらない。

unit: `npm test -- app/admin`。UI: `NAVIGATION_MARKET_QUALITY_FIXTURE=1` とtask別 `NAVIGATION_TEST_OUTPUT_DIR` を設定して `npx playwright test --config=playwright.navigation.config.ts --grep "admin market date quality"`。fixtureフラグはテスト専用。

## 保存日と相場日（2026-10-21）

日付選択は公開manifestの保存日一覧。週末・祝日や騰落ゼロだけで保存済みデータを隠さない。選択中と表示中を区別し、日付説明は常に表示中payloadのobservationに従う。相場日は同じ取得元のexplicit_sourceのみ確認済み。取得記録未提供・旧データはUNKNOWN、取得時刻未記録を明示する。APIから記録が届けば自動で表示し、利用者のやり直し操作を要求しない。

From→To: 保存日A表示→保存日B選択。既存の1回の同origin day読取、既存タイムアウトを維持。待機中/失敗時はAとAの日付説明を保持し、成功したらBの本文と説明へ同時に切替。通信失敗の任意retryと、相場日の確認・解除とは別。初回失敗は別日の正常結果にすり替えない。追加の日付照合通信は0回。metadataの追加分は1取得あたり約0.5–1KB（未圧縮の設計見積り）、操作から表示までの時間はPR実測参照。

UAT（local preview、syntheticまたは公開データの隔離読取、外部書込なし）:
1. 保存日一覧に週末がある場合もキーボードで選択できる。
2. 相場日未提供ではUNKNOWN、保存日・取得時刻・生成時刻が別々に表示される。
3. explicit_sourceのmetadataを返す場合は自動で相場日が表示される。
4. 遅延/失敗/連続切替では表示中本文と日付説明が一致し、古い応答で上書きされない。
5. 390px幅で日付・hash等がはみ出さず、既存の待機説明・retryにキーボードで到達できる。
6. 実データの旧CSVには取得元年月日がないことと、独立指数の日付を流用しないことを確認する。
