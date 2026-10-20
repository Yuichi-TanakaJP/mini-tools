# 管理画面の日付品質 UAT

環境: ローカルproduction build + 合成API、desktop/390x844 mobile。実施結果はPR本文へ記載。

1. premium認証後 `/admin` を開き、国内3ソースのUNKNOWNと取引日未確認パネルを確認する。
2. 最新10/20、週末10/18・17、生成時刻10/19 15:51Zのfixtureで、3ソースとも週末2件・最新平日10/20（祝日未判定）と表示する。相場日の確定とは表示しない。
3. desktopのheatmapへ切り替えてもパネルが残る。mobileでも3件読めてパネル内の横溢れがない。
4. API取得不可はFAILED、未提供日時は未提供。原データ、APIキャッシュ契約、取引日の付替え、タスク設定は変わらない。

unit: `npm test -- app/admin`。UI: `NAVIGATION_MARKET_QUALITY_FIXTURE=1` とtask別 `NAVIGATION_TEST_OUTPUT_DIR` を設定して `npx playwright test --config=playwright.navigation.config.ts --grep "admin market date quality"`。fixtureフラグはテスト専用。
