# minimatch 11とPWA依存の互換更新

対象はminimatch残件。前提の色予算同期は別PR #728（合計529不変、UI色変更なし）。本PRはそのbranch上に積み、先に前提をマージする。main元版5f0e10fにあったcolor検査2FAILを分離コピーでも再現した。

## lint

ESLint9/Nextの既存peer・規則を維持する。対象版6親のminimatchを公式registry11.0.3へ限定overrideし、親21sourceのimportだけを別名private legacy bridgeへ接続する。型定義やlint規則本体は変えない。postinstallは全件の親版・元/適用後SHA・realpathを検証してから変更、未知ソースは停止する。CIは既存npm ci --ignore-scriptsを維持し、明示prepareと互換検証stepを追加する。trigger/job名/required-checkを変更しない。

bridgeは旧callable/default/Minimatch Windows区切りの実使用subsetのみ。旧makeReのRegExpと11のmatchは意味が異なるためmakeReを明示throwする。現行import/no-internal-modulesはoff、将来pattern付き有効化は診断で停止する。汎用v3/旧glob互換ではない。親更新時にhashだけを追従させずAPIを再評価し、test:dependenciesとauditを実行する。公式min11をlocal package名へ置換して監査を逃がす方式は使わない。

## PWA

旧glob7はmin11で例外、glob11/13は一部wildcardでファイル0件を返すことを独立実証した。このため旧glob内部をpatchせず、公式にmin11を指定するglob14.0.3へ移行する。next-pwa5.6から別メンテナの@ducanh2912/next-pwa10.2.9へ移行し、Workbox7.4.1/webpack plugin7.4.1、Workbox配下glob14、filelist1.0.6→min11を限定overrideする。

forkの既定cacheは元版と異なり、API auth除外が狭まりRSC用cacheも増える。元版cache.jsをMIT license付きtoolingへ保全し、既存2つのNetworkOnly→元default一覧の優先順をそのまま継承する。forkはmain-appにもsw-entryを注入するので、その注入だけを除き、従来のmain.js登録境界を維持する。register:falseでも履歴/cache副作用が残るため代用しない。未知entry形状は停止、開発でPWA無効のときは追加wrapperを適用しない。

元commitを秘密.envなしの分離コピーで通常buildし、実生成SW6を用意した。同じlocalhost origin/scope/タブで実生成SW7へ切替え、旧新SW SHA・controller identity変更・precache再充填・offline表示・認証付きAPIの古cache不使用を確認。旧新precache対象160（static132）、tracked public assetに削除/変更なし。実ブラウザーの通常App Router読込では旧/新とも登録0・controllerなし・window.workboxなし。既に登録済みの利用者だけ新workerへ更新される既存境界を保つ。

最初の試験はWindows環境キー大小文字で子Node起動が失敗し、既存テストのallowlistを実キーcase保持へ修正した。次はブラウザーのoffline指定だけではSWのHTTP通信が残り、networkidleも継続要求でtimeoutした。失敗を保持し、DOMContentLoaded/loadと、専用proxyの実TCP遮断を用いて再検証した。旧cacheへ合成staleをseedしても、更新後の認証GETはonlineで再取得、遮断時に失敗しstaleを返さない。合成fixtureではなく元commitの実build workerを使用、本番SWや利用者cacheは読まない。

## 検証・残件・復旧

Windows標準clean ci/postinstall、lint（既存warning2）、依存11、Workbox/PWA3、全suiteとbuild、型検査、PWA通常1/実移行2を実行。LinuxのCI install/明示prepare/互換8/lint/buildと別モデルの最終結果はPRへ記録する。Node^22.23.4はCIと整合。秘密/実DB/認証情報は使わない。

npm auditは元29（low2/moderate27）→low5のみ、moderate/high/critical0、minimatch指摘0。残るlow5は既存のdeepmerge（deepmerge-tsとは別）1 advisoryと親4件への波及。新しいadvisory IDの追加なし。今回のminimatch解消を全指摘0とは記載しない。

マージ・Vercel本番・既存ローカルbranchへの反映は直前承認後。元のdirty feature branch/テスト差分を保全する。承認後に配備commit/alias/public資産を照合し、3repo再検査と記録を整理。rollbackは本PRのmanifest/lock/Next設定/cache/entry wrapper/import準備/CI変更を一式戻しclean install/build、静的配備を直前正常版へ戻す。配布済SWは既存登録を削除せず同じ/sw.jsを戻しupdateで収束させる。rollback実地は未実施、旧依存へ戻すと旧監査指摘も再発する。

根拠（2026-11-01）: https://github.com/advisories/GHSA-g3hv-75wg-m249 、https://registry.npmjs.org/glob/14.0.3 、各親の公開npm配布と実行証拠。実装gpt-6.1-sol、security/API/PWA/cache/rollbackを別モデルで独立レビューする。

最初のレビュー前の実行記録: Windows標準ci/postinstall、依存7+Workbox1、lint（既存warning2）、全117files/1413tests、typecheck、build PASS。PWA通常1と実旧buildからの移行2がPASS。LinuxはCIと同じignore-scripts→明示prepare→依存8/lint/build PASS。最終UATは専用scratchのChromium、127.0.0.1だけで実施し、新・旧buildのworker/manifest、元public資産を照合した。未実施は本番配備、実利用者データ/DB、実rollback。


## 最終独立レビューからの修正

旧globのdot-parent最適化を無効（optimizationLevel:0）にし、実CJS/ESM親APIで検証する。準備処理は全親から同じbridgeへの解決、保全sourceとのhash一致、公式backend11.0.3の版・解決先・ロードを先に検証する。共有hardlinkは書込み前に拒否し、通常npm ciで私有ファイルを再構築する。欠損・共有・dev省略・未知sourceを含め互換11件。

旧版のquery string方針ignoreURLParametersMatching:[]を明示する。元next-pwa/register.jsもMIT表記付きで保全し、Pages main.jsだけで使用する。forkの登録処理では失われた初回installed時のstart-url温めとredirect応答処理を保つ。App Routerには登録entryを入れない。保全コードの直接依存workbox-window7.4.1を明示し、初回イベントだけでlanding応答が保存されることを検証する。

移行proxyはASTで実worker manifestを読み、各ビルドの公開対象static/public資産の全件を照合する。異なるbuild間のhash付きファイル名の一致は求めない。通常App Routerの無登録検査はHTTP200・既存テーマ選択のclient操作・pageerrorなしを先に確認する。offline時のAuthorization付きprecache assetにutm_source/fbclidを付け、queryless precacheで回答しないことも検証する。修正後の実行結果と再レビューpairはPRに記録する。

修正後Windows: clean ci/互換11、PWA境界3、entry4、full117files/1413tests、typecheck、lint（既存warning2）、build、実ブラウザー通常1/実旧SW更新2 PASS。manifestガードは旧新ともstatic132/public28を照合し、通常読込はテーマ操作でclient起動を確認済み。Linux最終結果と別モデル再レビューはPR本文へ追記する。
