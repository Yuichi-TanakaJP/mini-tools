# 全ページの画面遷移 UAT

対象は[画面遷移と通信予算](../specs/cross-cutting/navigation-transitions.md)のG01〜09、E01〜14、R01〜39、Q01〜12、D01〜04、L01、X01〜02。実装前に決めた手順であり、実施済みチェックや合格結果ではない。実施結果は対象PR本文へ記録する。

## 確認環境と入力

- commit/base、Preview/本番、browser/端末、地域、10Mbps/RTT100ms等の通信条件、cache有無、cold/warmを記録する。
- 個人情報を含まないfixtureで0.1秒/1秒/5.5秒/8秒超/timeout/401/503/offlineを再現する。実データは承認済みの読み取り確認だけ。
- 認証の実password、本文、query値、金融情報を動画/ログ/画像へ保存しない。保存・画像送信・メール送信・DB書換えを遷移確認のために実行しない。

## FromとToの網羅

- [ ] R01〜39を、正本表の実在From（またはD）から開いて戻る。API routeを画面に数えず、動的詳細は代表IDで確認する。
- [ ] Home grid、Header/ロゴ、Drawer、両BottomNav、Premium HubのG01〜05を確認する。
- [ ] E01〜14の関連画面リンクとflag付き入口を確認する。無効なflagのリンクを常時公開しない。
- [ ] Q01〜12でpath不変のquery変更を確認する。pathname変更だけでpending解除していないこと。
- [ ] D01〜04のcache hit/missを確認し、Client API待ちとページ移動を区別する。
- [ ] L01のlocal切替は0 requestで即反映し、通信spinnerを出さない。
- [ ] X01〜02とG06〜09でauth/full reload、Back/Forward、直URL、外部/_blank/hash/修飾クリックを確認する。

## 受付と待機

- [ ] 押した対象の受付が100ms以内。pointer/Enter両方で、押下元だけを識別できる。
- [ ] 150msを超えたら対象spinner/文言とheader barが出る。速い遷移で不必要な点滅がない。
- [ ] 200ms以内に見出し/概形/戻り手段等が表示され、JS chunk待ちでも空白にならない。
- [ ] 3秒以上で遅延案内が出る。旧データ/旧条件と要求中条件を混同しない。
- [ ] 戻る/メニュー/別ページを使える。無関係な操作を一律disabledにしない。
- [ ] aria-busy/role=status/aria-live、キーボード、reduced-motion、mobileの固定ナビを確認する。

## 成功・失敗・中断

- [ ] 新データ確定でpending解除。URL変更だけで取得完了と扱わない。
- [ ] 5.5秒cold-start相当でViewerが成功でき、上流8秒/下流10秒の処理全体予算を超えた場合は12秒以内に回復可能な表示へ進む。
- [ ] timeoutと接続/401/403/413/429/5xx/契約不正を区別する。
- [ ] 同じcursor/date/monthで手動再試行でき、正常表示済みの一覧や戻り条件を失わない。
- [ ] 連打と別リンクへの変更で最新要求が勝ち、古い完了が画面/進捗を上書きしない。
- [ ] Back/Forward、同一URL、redirect、errorでpendingが残らない。
- [ ] 未認証時は本人データ取得前にloginへ遷移。login後のCookie反映を壊さない。

## 通信量と時間

- [ ] BのHTML/RSC、JS/CSS、JSON、画像等とU/DBを別々に記録する。APIサイズをbrowser総量として記載しない。
- [ ] 初回とhome表示後を分け、cache/prefetch済みのrequestを二重計上しない。
- [ ] 通常30回以上でp95を記録し、cold-startは別表にする。標本不足をp95合格にしない。
- [ ] 各Profileの容量・時間目標を確認する。超過は理由と分割/遅延/compactの対応をPRへ記録し、欠落で達成しない。
- [ ] Viewerはcold/warm、一覧/続き/詳細、複数ページを含めて成功率・timeout率を記録する。

## 実装時の検証

変更に応じた対象unit/lint、必要なbuild、独立レビューと上記UATを実施する。全routeを扱う共通部品のテストには同path query、履歴、中断、modifier clickを含める。コード変更前の文書だけのPRではdiff/リンク/表の整合を確認し、未実施のruntime検証をPASSにしない。

## 関連

- [判断理由](../decision-log/2026-10-18-navigation-feedback-and-latency.md)
- [テーマViewer UAT](theme-viewer.md)

## 再現可能なローカル確認

`npx playwright test --config=playwright.navigation.config.ts` はloopback専用の合成APIとNext production build/startを起動する。既存Edgeを既定で使用し、必要なら `NAVIGATION_BROWSER_CHANNEL=chrome` へ切り替える。`NAVIGATION_TEST_OUTPUT_DIR` へscratchの絶対pathを指定してtrace/失敗画像を保存する。指定なしはOSのtemporary directoryとなる。本番のtokenやDBは使わない。

対象: 39ページの入口、Viewerの5.5秒遅延/8秒timeout/503・同条件retry・元cursor・履歴・競合、mobile共通ナビ、日付の正常表示保持/手動retry、native GET。unitは `npm test`、型は `npx tsc --noEmit`、production生成は `npm run build`。テストbuildでは公開同梱JSONのfallbackを明示的に有効にする。fixture時間を本番p95として報告しない。実データの全条件、実機回線・cold start、各Profileの容量/p95合否は別に計測し、未実施を記録する。

### 再試行の回帰確認

- 同じURLの「表示」を押しても取得が実行され、別の待機要求を上書きできること。同じURLという理由だけでno-opにしない。
- 日付B失敗→cached A→B再選択で、B取得中表示が復帰し、成功後に以前のerrorが残らないこと。
- 開示30日等の条件で失敗後、期間・view・topic・検索を保持したまま不足日の再試行を行うこと。URLにないlocal条件をfull reloadで失わない。

- 企業scope A取得済み→B取得中/失敗でAの図・ラベル・中心企業が一緒に保持され、旧図の操作だけが止まること。「前回の条件に戻る」でAが再び操作可能になり、「同じ条件で再試行」でBの条件を変えずに取得すること。実DB未接続の場合はsnapshot選択のunit検証と未設定入口のUI検証を区別し、実scope UATを未実施と記載する。

- 同URLのretryはRSC要求が1回であること（push/replaceの後にrefreshを重ねない）。企業scopeの表示基点を変更してから別scopeへ進んでも、その最新基点が旧図と復帰先へ保持されること。

### 経済カレンダーの表示切替

`npx playwright test --config=playwright.calendar-navigation.config.ts` はloopbackの経済カレンダーfixtureを使う。初回月取得中を未発行と扱わず、失敗した月の同条件再試行が実際に通信すること、月→週・週→月の切替で別表示のエラーと再試行操作が残らないことを確認する。取得済みの月の行は次の取得中も保持する。
