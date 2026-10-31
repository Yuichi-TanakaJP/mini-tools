# 画面遷移と通信予算

更新日: 2026-10-18。対象: mini-toolsの全39ページ定義と、同一画面内の条件変更・データ切替。

**共通遷移は#703で本番反映済み（配備確認SHA `4fb33e9`）。** 以下の初期調査・asset見積りの基準ソースは `86ada02d061ffe0447232c29c76c8ccc0e7c9bbd`。目標は実測の全画面合格を意味しない。指定経路の本番単発確認は [#703の記録](https://github.com/Yuichi-TanakaJP/mini-tools/pull/703) を参照する。

## 1. 対応方針

1. 内部リンク・router遷移・GET条件フォームを共通の受付/pending仕様へ揃える。まずテーマViewerと共通ナビを対応する。
2. ページ移動、query変更、Clientデータ取得、通信しない切替を分ける。すべてを全画面スピナーに置き換えない。
3. テーマViewerは上流処理の全体予算8秒、MiniToolsの上流待ち10秒、利用者が回復を選べる状態まで12秒以内を採用する。現在の5秒一律待機はこの画面で見直す。設定値が変わっただけでは完了としない。
4. 失敗時はtimeout/接続/認証/HTTP/契約不正を分け、同じ条件の手動再試行を提供する。自動再試行は初回対応に入れない。
5. 金融・本人データの先読みは現状の抑制を維持する。静的な入口/共通assetは通常のNext cache/prefetchを使い、通信予算を超えるデータは分割/必要時取得にする。
6. Cloud Run常時起動などの費用変更、DB migration、認証方式変更、共有Service Workerへの本人データcacheは初回対応に含めない。

[判断理由](../../decision-log/2026-10-18-navigation-feedback-and-latency.md) / [受入手順](../../uat/navigation-transitions.md)。

## 2. FromとToの読み方

- **P**: `/` のtool gridと全画面のNavDrawer。`lib/tools-catalog.ts`に実在するツールリンクだけ。
- **H**: `/premium` のHubカード。保護画面では未認証なら`/premium/login?next=…`を経由する。
- **D**: 直URL・bookmark・ブラウザーの履歴。画面内にリンクが存在するという意味ではない。
- ロゴ→`/`、共通下部ナビ、保護画面からloginへのredirectは後述の共通辺も適用する。
- 全組合せ39×39を遷移可能とはしない。存在する入口と、実際のquery/Client切替を記録する。

## 3. 通信量と時間の定義

### 通信を三層に分ける

| 層 | 記載する量 | 他の層との違い |
|---|---|---|
| B: browser↔MiniTools | HTML/RSC、JS/CSS、Client JSON | 利用者の回線を通る。SSRデータはRSC/HTMLに含まれ、API JSONサイズと一致しない |
| U: MiniTools↔upstream API | market-info/stock-notes等のHTTP response | browserが直接受信する量ではない。Next Data Cache hitなら実通信しない場合がある |
| DB: API↔DBまたはClient↔DB | query回数とresponse | Uの1リクエストが多数のDB HTTPへ展開する場合がある |

下表のAPI回数はコード上の論理読取。cache miss時の通信見積りの根拠であり、実測request数ではない。本人データ/全月件数で変わる値は固定数を捏造しない。

### JS/CSSのコード由来見積り

同じソースのローカルproduction buildから、routeのclient-reference manifestとrootMainFiles、直下のdynamic importに参照されたJS/CSSを重複排除し、各fileをgzipして合計した。表の「初回」はbrowser cacheなし、「追加」は`/`を表示済みとしたasset差分。KiB=1,024 bytes。

**参照asset集合の見積りであり、browser実転送量ではない。** HTML/RSC/JSON、画像/音声/font、headers、別ディレクトリ内の条件付きdynamic importを含めない。manifest参照があっても実際に不要なchunkが含まれる場合がある。CDNのBrotli、code hash、cache、遅延chunkによって実転送は変わる。同じrouteのquery変更では通常追加JS/CSSは0KiBだが、RSC/JSON通信は残る。

### 採用するデータ・時間予算

すべて**目標**。現状未測定の値を実測のように扱わない。データサイズはbrowser側の圧縮後body（JS/CSSを除く）を対象にし、U/DBのサイズとは別に測る。p95は通常時30回以上を最低サンプルとし、cold startは別シナリオで記録する。環境は国内回線10Mbps/RTT100msを基準に、端末・地域・cache状態も記録する。

| Profile | 遷移仕様 | Bのデータ予算 | 時間目標: 受付 / 有意味表示 / 操作可能な表示完了 |
|---|---|---|---|
| S1 | 軽いServer画面/入口 | RSCまたはHTML ≤64KiB | ≤100ms / ≤1秒 / p95≤1秒 |
| S2 | ServerでAPI/DBの標準画面 | RSCまたはHTML ≤256KiB | ≤100ms / ≤200msのfallback / warm p95≤3秒 |
| S3 | 複数API/DB・大きい画面 | RSCまたはHTML ≤512KiB。超過分を遅延/分割 | ≤100ms / ≤200msのfallback / warm p95≤4秒 |
| C1 | Client主体・local操作 | 初期shell ≤64KiB、業務JSON 0 | ≤100ms / chunk待ちfallback≤200ms / cacheありp95≤1秒 |
| C2 | Client認証/データ取得 | 初期shell ≤64KiB、1回JSON ≤256KiB | ≤100ms / fallback≤200ms / warm p95≤3秒 |
| A1 | 認証POST→全画面移動 | 認証JSON ≤8KiB + 移動先profile | submit受付≤100ms、認証完了まで送信中。移動は移動先予算 |
| V1 | テーマ一覧1ページ | B: RSC ≤128KiB。U: 40,000文字未満、最大10件 | ≤100ms / fallback≤200ms / warm p95≤3秒、coldの目標≤8秒、10秒で待機打切り |
| V2 | テーマ詳細 | B: RSC ≤256KiB。U: 既存60,000文字未満 | ≤100ms / fallback≤200ms / warm p95≤3秒、coldの目標≤8秒、10秒で待機打切り |
| L0 | 同じ画面のlocal切替 | 0 bytes、0 request | 選択反映p95≤100ms。重い描画は別計測 |

200msの有意味表示は見出し・概形・戻り手段で、データ取得完了とは異なる。容量目標を超えたらcompact化・分割・遅延取得を行い、行を黙って欠落させて達成しない。S2/S3/C2のtimeoutは個別operationの予算を設計し、今回一律に10秒へ延長しない。

## 4. 全39ページのFrom→To

JS/CSSの「追加/初回」はKiB。実際のFromがホーム以外の場合の追加assetは、その画面で既に取得したchunkとの差分で再計算する。下表の時間はProfileの**目標**を参照。現状のend-to-end時間は、テーマ以外も含め全39画面では未測定。

<!-- navigation-contracts:pages -->
| ID | From | To | JS/CSS見積り 追加/初回 | データ/遷移時間目標 | U/DB論理読取の見積り |
| --- | --- | --- | --- | --- | --- |
| R01 | DBツールの認証案内・D | `/account` | 5.3 / 228.7 | C2 | Supabase認証/同期状態（回数未計測） |
| R02 | 再設定メールリンク（送信元/account）・D | `/account/reset-password` | 8.0 / 231.5 | C2 | 認証セッション確認。更新送信は遷移外 |
| R03 | H・D | `/admin` | 0.2 / 223.6 | S3 | 18 API論理読取、現状2グループ |
| R04 | 全画面ロゴ/通常ホーム/メニュー・D | `/` | 0.0 / 223.4 | S1 | Cookie判定。通知等のClient追加通信は別 |
| R05 | H・D | `/premium/company-network` | 33.1 / 256.6 | S3 | 認証+DB bootstrap。選択後のscope APIは別 |
| R06 | H・D | `/premium/industry-map` | 28.0 / 251.4 | S3 | 認証+DB（回数未計測） |
| R07 | 未認証で保護ページへ移動→redirect・D | `/premium/login` | 2.2 / 225.6 | A1 | Cookie確認。submit後POST 1→全画面移動 |
| R08 | H・D・Premium下部ナビ | `/premium/market` | 2.8 / 226.2 | S3 | 休場日+manifest+対象月のn日（2+n） |
| R09 | HeaderのPremium・Premium下部ナビ・D | `/premium` | 0.7 / 224.1 | S1 | Cookie判定のみ。ログアウトPOSTは別 |
| R10 | H・D・Premium下部ナビ | `/premium/portfolio` | 17.0 / 240.4 | S3 | 認証/DB+後続の関連取得（回数未計測） |
| R11 | H・D | `/premium/routines` | 0.8 / 224.3 | S1 | Cookie+同梱表示 |
| R12 | H・D | `/premium/tdnet-router` | 2.7 / 226.2 | S2 | 認証+DB条件検索（回数未計測） |
| R13 | H・D | `/premium/theme-company-network` | 3.7 / 227.1 | S2 | 認証+DB（回数未計測） |
| R14 | テーマ一覧カード・D | `/premium/themes/[themeId]` | 0.8 / 224.3 | V2 | stock-notes 1、DB複数（回数未計測） |
| R15 | H・D・Premium下部ナビ | `/premium/themes` | 0.8 / 224.3 | V1 | stock-notes 1、通常DB 1+3n（n=10で31） |
| R16 | P・D | `/tools/charcount` | 7.6 / 231.0 | C1 | 業務API 0 |
| R17 | P・D | `/tools/data-transfer` | 13.7 / 237.1 | C2 | local版0、DB版は認証/DB。転送操作は別 |
| R18 | P・D・通常下部ナビ | `/tools/disclosure-radar` | 7.8 / 231.3 | C2 | Client: manifest+対象日n（1+n）、本人対象照合は別 |
| R19 | P・D・通常下部ナビ | `/tools/earnings-calendar` | 5.9 / 229.3 | S3 | 国内/海外manifestと収録月数に比例、calendar等 |
| R20 | P・D | `/tools/econ-calendar` | 5.5 / 228.9 | S2 | 初回3 API、月追加は週数に比例 |
| R21 | P・D | `/tools/edinet-documents` | 4.0 / 227.5 | S2 | manifest+日次 2 API |
| R22 | P・D | `/tools/investor-flow` | 7.9 / 231.3 | S2 | raw/analysis manifest+snapshot 通常4 API |
| R23 | P・D | `/tools/market-rankings` | 5.8 / 229.2 | S2 | manifest+選択月 2 API |
| R24 | 旧bookmark・D（統合済み案内） | `/tools/my-stocks` | 0.2 / 223.6 | S1 | 業務API 0 |
| R25 | P・D | `/tools/nikkei-contribution` | 8.0 / 231.4 | S2 | manifest+calendar+有効日探索（2+n） |
| R26 | P・D | `/tools/penguin-rabbit-shooter` | 7.3 / 230.7 | C1 | 入口業務API 0。画像/音声assetは別 |
| R27 | P・D | `/tools/penguin-shooter` | 25.3 / 248.7 | C1 | 入口業務API 0。画像/音声assetは別 |
| R28 | D（検証用、通常入口なし） | `/tools/stock-notes/edinet-identity-uat` | 2.8 / 226.3 | C2 | 入口だけでは検証RPCを自動起動しない |
| R29 | P・D・通常下部ナビ | `/tools/stock-notes` | 14.1 / 237.5 | C2 | 認証/DB/参照API（回数未計測） |
| R30 | P・D | `/tools/stock-ranking` | 3.8 / 227.2 | S2 | manifest+calendar+日次 3 API |
| R31 | P・D | `/tools/tdnet-disclosures` | 4.5 / 228.0 | S2 | 日次/期間条件に依存（回数未計測） |
| R32 | P・D | `/tools/topix33` | 4.9 / 228.3 | S2 | manifest+calendar+有効日探索（2+n） |
| R33 | P・D | `/tools/total` | 6.5 / 229.9 | C1 | 業務API 0 |
| R34 | P・D | `/tools/us-stock-ranking` | 3.7 / 227.1 | S2 | manifest+有効日探索 最大6 API |
| R35 | P・D・通常下部ナビ | `/tools/yutai-candidates` | 28.3 / 251.7 | S3 | manifest/在庫/月データ 通常4 API、本人DBは別 |
| R36 | P・D | `/tools/yutai-dashboard` | 40.1 / 263.5 | S3 | 月表示通常4 API、全月m+3 API、本人DBは別。株価は完了後60秒で再取得（失敗も再試行、月不一致・古い実株価は採用しない）。更新時の通信量・実測時間は未測定 |
| R37 | P・D | `/tools/yutai-expiry` | 64.5 / 287.9 | C2 | 認証/DBまたはlocal版（回数未計測） |
| R38 | D（PoC、通常入口なし） | `/tools/yutai-expiry/scan-poc` | 6.6 / 230.1 | C1 | 入口API 0。画像送信は遷移外 |
| R39 | P・D | `/tools/yutai-memo` | 37.2 / 260.6 | C2 | 認証/DBまたはlocal版、信用参照（回数未計測） |
<!-- /navigation-contracts:pages -->

Profileは入口の表示責務に対応する。例えばC1のscan PoCは入口の予算であり、画像のアップロード/AI処理をこの予算へ含めない。Portfolioは入口/戻りの遷移境界のみを対象とし、意思決定やデータ契約の業務仕様は変更しない。

## 5. ページ間の共通辺

<!-- navigation-contracts:global -->
| ID | From | To | 遷移時の仕様 | 想定通信量・時間 |
| --- | --- | --- | --- | --- |
| G01 | 任意ページのロゴ/メニューHome | `/` | 通常Link。押下反応、待機時の共通bar | S1。取得済みassetは再利用 |
| G02 | 任意ページのNavDrawer | Pで列挙したtool | drawerを閉じてもheaderの移動中表示を残す | ToのProfile＋不足asset差分 |
| G03 | 非Premium画面の下部ナビ | `/`、`/tools/stock-notes`、`/tools/yutai-candidates`、`/tools/earnings-calendar`、`/tools/disclosure-radar` | activeは表示中画面、pendingは押した対象として別表示 | ToのProfile |
| G04 | Premium画面の下部ナビ | `/premium`、`/premium/portfolio`、`/premium/market`、`/premium/themes`、`/` | G03と同じ | ToのProfile |
| G05 | `/premium`のHub | Premium8機能と`/admin` | 通常Link＋共通pending。本人データを無条件prefetchしない | 各R行のProfile |
| G06 | 保護ページへ未認証で進入 | `/premium/login?next=<安全な元URL>` | 本人データ取得前にredirect。条件を復帰可能な範囲で保持 | 認証ページshell＋redirect、A1/To |
| G07 | Premium login成功 | next指定先 | Cookie反映の理由で全画面assignを維持。押下→認証→移動を表示 | POST≤8KiB + ToのHTML/asset。RSCだけとは計上しない |
| G08 | ブラウザーBack/Forward/直URL | 履歴または指定route | clickに依存せずfallback/error。可能な状態とscrollを復元 | cache hitなら0〜不足分、missならToのProfile |
| G09 | 外部原本/PDF/_blank/メール/共有/hash | 外部または同一画面見出し | 通常のbrowser動作。元画面を移動中のままにしない | 外部通信量は本仕様の予算外 |
<!-- /navigation-contracts:global -->

### 共通ナビ以外の関連画面リンク

以下も通常の内部遷移として受付/pendingを適用する。表の予算はToのR行/Profileと、Fromで取得済みのasset差分を使う。現在のaによるdocument移動は、認証等の理由を確認してからLinkへ統一する。

<!-- navigation-contracts:related -->
| ID | From | To | 条件・現状と対応 |
| --- | --- | --- | --- |
| E01 | Premium各子画面・`/admin` | `/premium` | 画面内の戻りリンク。S1 |
| E02 | `/premium/market` | `/tools/topix33` | 関連ツール。S2 |
| E03 | `/premium/tdnet-router` | `/tools/disclosure-radar`、`/account` | 通常版/認証案内。各ToのProfile |
| E04 | `/premium/theme-company-network` | `/premium/industry-map`、`/premium/company-network` | 関連マップ。S3 |
| E05 | `/premium/company-network` | `/premium/industry-map` | 関連マップ。S3 |
| E06 | `/premium/industry-map` | `/premium/themes` | テーマ一覧。V1 |
| E07 | `/premium/portfolio` | `/premium/company-network`、`/account` | 関連ツール/認証案内。業務データの変更を伴わない遷移のみ |
| E08 | `/tools/stock-notes` | `/premium/portfolio`、`/account` | 保有全体/認証案内。S3/C2 |
| E09 | `/tools/my-stocks` | `/premium/portfolio`、`/tools/stock-notes` | 旧画面の移行案内。S3/C2 |
| E10 | `/tools/disclosure-radar` | `/tools/stock-notes` | ウォッチ管理。C2 |
| E11 | `/tools/yutai-dashboard` | `/tools/yutai-memo` | 現在a。C2、document/Client遷移を区別して改善 |
| E12 | `/tools/yutai-expiry`、`/tools/yutai-memo` | `/tools/data-transfer` | DB preview flagが有効な場合のみ。現在a、C2 |
| E13 | `/account/reset-password` | `/account` | 成功/失敗画面からの復帰。C2 |
| E14 | `/admin`のデータ/ツール表 | `/tools/{topix33,nikkei-contribution,stock-ranking,us-stock-ranking,market-rankings,investor-flow,earnings-calendar,econ-calendar,edinet-documents,tdnet-disclosures,disclosure-radar,yutai-candidates,stock-notes,total,charcount,yutai-expiry,yutai-memo}` | 表の実在hrefに限る。各ToのProfile |
<!-- /navigation-contracts:related -->

## 6. 同一ページ内のFrom→Toと追加通信

query変更は新たな39ページとして数えないが、操作単位のpendingを必須にする。「0KiB」は追加JS/CSSであって、データ通信が0という意味ではない。

<!-- navigation-contracts:operations -->
| ID | From | To | 現状の追加通信見積り | 採用する遷移仕様・時間 |
| --- | --- | --- | --- | --- |
| Q01 | `/premium/themes`のページc | `/premium/themes?cursor=c2` | 追加asset通常0、RSC 1、U 1。U実測約6.8KiB、DB通常31 | V1。旧一覧保持、押下spinner、同条件retry |
| Q02 | テーマ一覧カード（cursor c） | `/premium/themes/[themeId]` | RSC 1、U 1。U実測約2.0〜9.2KiB、DB複数 | V2。loading、戻りのcursorを保持する方針 |
| Q03 | 詳細（一覧cursor cから進入） | 元の`/premium/themes?cursor=c` | RSC 0〜1（cache依存）、U 0〜1。追加asset通常0 | V1。詳細URLの検証済みcursorを使って元一覧へ戻る |
| Q04 | `/premium/market?month=m` | 同pathのmonth=m2 | RSC 1、U論理2+n。追加asset通常0 | S3。旧月と要求月を区別 |
| Q05 | `/tools/market-rankings?type=t&month=m` | 同pathのtype=t2/month=m2 | RSC 1、U論理2。追加asset通常0 | S2。既存hookを共通仕様に合わせる |
| Q06 | `/tools/investor-flow?start=s&end=e` | 同pathの別週 | RSC 1、U通常4。追加asset通常0 | S2。通常Linkにもpendingを追加 |
| Q07 | `/tools/edinet-documents?date=d` | 同pathのdate=d2 | RSC 1、U通常2。追加asset通常0 | S2。既存hook/正規化replaceの意味を維持 |
| Q08 | `/tools/tdnet-disclosures?date=d&range=r` | 同pathの条件変更/クリア | RSC 1、Uは期間条件依存 | S2。最新要求のみ表示、失敗で正常表示を保持 |
| Q09 | `/tools/yutai-candidates?month=m` | 同pathのmonth=m2 | RSC 1、U通常4、本人DBは別 | S3。月確定まで旧月表示に更新中を明記 |
| Q10 | `/tools/yutai-dashboard`の月/全月 | 同pathの月/表示query | RSC 1、U通常4またはm+3 | S3。全月を無制限に同期取得しない |
| Q11 | `/admin?view=v` | 同pathのview=v2 | RSC 1、現状18論理API（cache依存） | S3。view切替だけで全データ再取得しない設計へ |
| Q12 | `/premium/tdnet-router`のGET条件form | 同pathのstatus/event/limit query | 現状document GET 1、認証/DB。To assetは通常cache | S2。pending対応GET formへ、履歴/URL保持 |
| D01 | 国内/米国ランキング、日経、TOPIXの日付d | 同じ画面の選択日d2 | cacheあり0、なければbrowser JSON 1→U通常1。追加asset0 | C2。JSON≤256KiB、warm p95≤3秒、対象パネルだけ更新 |
| D02 | `/tools/econ-calendar`週/月 | 同画面の別週/月 | cacheあり0、なければ対象週数のJSON | C2。必要週だけ取得、古いrequest採用を抑制 |
| D03 | `/premium/company-network`グループ/企業 | 同画面の別scope | scope cacheあり0、なければ内部JSON API | C2。旧scopeに更新中表示、新scope取得後に確定 |
| D04 | `/tools/disclosure-radar`の期間/対象 | 同画面の別条件 | 取得済みのlocal絞込0、未取得日ならJSON追加 | C2またはL0を実際の処理で分ける |
| L01 | 決算の市場/月/日、既取得表/graph、mapの表示方式、各ツールのlocalタブ | 同routeの表示状態 | 0 bytes、0 request（追加データ不要の場合） | L0。ネットワークspinnerは出さない |
| X01 | `/account`のreset依頼 | メールの`/account/reset-password`→復帰先 | 認証メール/更新は操作。移動部分はTo profile | 認証の送信状態と移動中を分ける。自動再送なし |
| X02 | local/DB toolsの認証案内a/reload | `/account`または同route再読込 | document GET。RSC遷移の予算と分ける | 意図を確認してLink化、必要な全画面reloadは維持 |
| Q13 | テーマ詳細「本文を全文で読む」未取得/取得途中/失敗 | 同じ本文の次2,000文字／項目変更で未取得／409で最初から | ブラウザー→同origin proxy→stock-notes GET各1回/操作。本文最大2,000 Unicode文字（UTF-8最大8KB＋JSON metadata）。DB→APIは単一field全文。 | 即時pending、取得済み本文保持、12秒timeout・中断・同offset retry。版不一致は読み直し。統計未測定。 整形/原文はlocal切替、原文不変。日時付き選択、末尾完了と残数。追加時focus/scroll保持、先頭操作で見出しへfocus。 |
| L90 | `/tools/investor-flow` 最新週/過去週を表示中 | 同画面の公開更新確認 | GET data。本文・分析・直近12/13週。目安100KB以下、10秒timeout。 | visible時60秒/復帰時。旧表示保持、失敗通知・retry、過去週固定、abort。 |
<!-- /navigation-contracts:operations -->

## 7. 実測値と採用する予算の関係

2026-10-18、productionのCloud Run request log。APIのlatency/responseSizeであり、browserの全体描画時間やRSCサイズではない。responseSizeにはHTTP応答の付帯分を含むので、文字数上限と直接比較しない。

| 対象 | cache/起動状態 | U応答サイズ | U時間 | 現状評価 |
|---|---|---:|---:|---|
| 一覧10件 | 19:47〜49の確認、warm寄り | 7,362 bytes（約7.2KiB） | 0.815 / 1.401秒 | 当時の操作成功 |
| 続き10件 | 同確認 | 6,965 bytes（約6.8KiB） | 0.399秒 | 当時の操作成功 |
| 詳細2件 | 同確認 | 2,026 / 9,373 bytes | 0.284 / 0.575秒 | 当時の操作成功 |
| 同じ続きURL | 22:39、同一instanceが起動 | 未計測 | 5.355秒（startup約3.52秒） | MiniTools Server側の上流待ち5秒を超え、画像の失敗と整合 |

前回の少数成功から安定動作を認定しない。新しい10秒は現状のcold startを吸収するための待機予算で、APIの遅さを解消する施策とは別。上流8秒・下流10秒は処理全体の予算とし、個別queryごとに8秒を積み重ねない。

## 8. 押下から完了までの共通仕様

- **受付100ms以内**：押した対象の見た目を変える。新タブ/修飾クリックを奪わず、同じ要求の連打だけ抑える。
- **150ms継続**：対象の小spinnerとヘッダーの不定進捗bar。「移動中」と「データ更新中」を分ける。全画面overlayや無関係な操作の一律disabledは禁止。
- **3秒**：「取得に時間がかかっています」。既存データに日付/条件を残し、表示中と要求中の条件を混ぜない。
- **成功**：取得内容を確定し、見出し/件数/焦点/scrollを適切に更新。URL変更だけで全データ完了と判定しない。
- **失敗**：timeout/接続/401/403/413/429/5xx/契約不正を区別。旧正常表示を保持し、「同じ条件で再試行」「戻る」を出す。認証切れは安全なreturn URLを保持する。
- **中断/競合**：最新の移動要求を優先。古い完了が新しいpendingを消さない。pathnameだけでなくquery変更・redirect・Back/Forwardも扱う。
- **アクセシビリティ**：見た目＋aria-busy/role=status/aria-live=polite。キーボード操作、固定bottom nav、reduced-motionに対応。

実装は小さな共通Link部品（useLinkStatusの子要素）、既存useRouterTransitionの共通化、root/各segmentのloading、Client fetch状態で分担する。app全体をClient化せず、App Routerにないrouter.eventsを前提にしない。useLinkStatusは履歴更新までのpendingなので、データ取得中の状態へ引き継ぐ。

## 9. 実施順と完了判定

| 順序 | 対応 | 完了判定 |
|---|---|---|
| 1 | テーマViewer：8/10秒予算、timeout分類、同条件手動retry、Q01〜03のpending/旧一覧/戻り条件 | cold起動、5.5秒遅延、timeout、503で誤表示/条件喪失/無反応がない |
| 2 | 共通Linkとheader bar、Home/Drawer/BottomNav/Hub、themesを含むsegment loading、ClientOnly fallback | G01〜09・E01〜14とR01〜39を到達/戻り表で確認。権限境界と既存別作業を維持 |
| 3 | Q04〜12、D01〜04、local区分を統一。GET form/内部aの例外を処理 | 連打/中断/別要求/query/履歴でpendingが残らず、古い結果が上書きしない |
| 4 | 予算超過箇所を計測してcompact/遅延/batch化。Viewerの1+3n往復も対象 | browser量・U/DB往復・cold/warm時間・timeout率を分離して改善を確認 |

DB集約RPCやmigrationを要する最適化は別PRで設計・承認し、件数の不正確なbatch化はしない。常時起動の課金変更は別途承認。今回の決定は文書化までで、コード変更/設定変更/本番配備は別工程。

## 10. 計測と保守

- 遷移ID、route pattern、受付/有意味表示/完了、cache有無、cold/warm、status、サイズ区分だけを記録する。URL query値、本人本文、ID、token、passwordをログへ残さない。
- browserはHTML/RSC/JS/CSS/JSON/画像を分ける。U/DBも別計測し、API7KiBを画面全体7KiBと報告しない。
- 新page/リンク/GET formを追加したPRでFrom→To行とProfileを更新。削除済み入口も修正。リンク数やloadingファイル数だけで完了判定しない。
- root共通JS/CSSが見積りで約223KiBあるため、実転送とparse/long taskを計測してから分割を検討する。初回と再訪を混ぜない。

## 関連仕様と根拠

- [データ取得経路](market-tools-data-fetch-paths.md)、[Server/Client境界](react-server-client-boundaries.md)、[テーマViewer](../tools/theme-viewer.md)
- [既存router pending判断](../../decision-log/2026-05-30-router-transition-pending-feedback.md)、[既存loading判断](../../decision-log/2026-04-07-loading-ui-and-parallel-fetch.md)
- [Next.js useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status)、[loading](https://nextjs.org/docs/app/api-reference/file-conventions/loading)、[useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router)
- ソース：`app/layout.tsx`、`components/Header.tsx`、`NavDrawer.tsx`、`MobileBottomNav.tsx`、`app/ToolGridClient.tsx`、`lib/tools-catalog.ts`、`app/tools/_shared/use-router-transition.ts`、`use-daily-market-data.ts`、各`page.tsx`とClient、`app/premium/themes/data-loader.ts`。

## 2026-10-18 実装範囲

- rootのNavigationProvider、全内部Next Linkの共通wrapper、既存router hook、root loading/error、既存segment loading、ClientOnly chunk fallbackを接続。39ページの入口と共通/関連リンクに適用する。
- URL commitと実データ/fallbackの待機は別登録。最新nav IDだけを完了可能にし、query/refresh/redirect/履歴でも古い完了が新しい進捗を消さない。同一の待機中Linkの連打を抑止する。
- ヘッダーのPremium導線は従来のnative aから共通Linkへ統一し、不要なdocument再読込を避ける。native内部aとGET formはbrowser動作を保ったまま受付表示。同条件GET再読込も対象。外部、download、修飾クリック、同一documentのhashは元画面をpendingにしない。
- Viewerは**MiniTools側で上流HTTP応答を8秒、bodyのJSON読取までを合計10秒で打切る**。Cloud Run内の各DB処理へ新しいdeadlineを配布する変更は含めない。前回成功一覧はmounted session内のみ保持し、storage/共有cacheへ保存しない。
- 日付4画面、経済指標の週/月、開示条件、企業scopeに中断/時間制限/更新中を接続。日付と週/月は前回表示と要求条件を区別し、失敗を0件として確定しない。企業scopeは前回データと表示ラベル/中心企業/探索条件を一緒に保持し、新scopeへ混ぜない。旧図の操作だけを一時停止し、同条件retry/前回条件への復帰を図の外で提供する。取得結果はkeyで照合する。
- Premium login後のfull assign、logoutの既存認証処理は維持し、既存の送信中状態を共通表示へ接続。認証方式・RLS・保存処理は変更しない。
- データ予算/p95は引き続き受入目標であり、本番の全画面実測合格ではない。view別取得最適化、DB集約、root bundle分割は、計測で超過箇所を特定してから行う。

PortfolioについてはUI-4/V2 Phase 6の業務機能を拡張せず、既存入口/関連Linkへの共通feedback適用のみ。受入条件はPremium境界・既存hrefの維持と、無関係な保有操作/保存契約へ差分がないこと。

## 9. 遷移契約の変更時チェック

`config/navigation-contracts.json` をFrom/To表とsource候補の正本にする。節4〜6の表はマーカー内だけを `npm run navigation:docs` で生成する。候補を再収集して自動承認するコマンドは設けない。リンク・router・フォーム・Client通信・chunk/segment fallbackを変えるときは実際の仕様とテストを読んで登録する。

```powershell
npm run check:navigation -- --base origin/main
npm run test:navigation-contracts
# 契約の表を更新した場合だけ
npm run navigation:docs
```

- 未登録のページ/遷移サイト、仕様表の差分、共通Provider/loading/errorの欠落・loading接続の解除、next/linkの迂回、静的内部hrefの宛先欠落、理由なしのnative/document遷移・dynamic fallback例外、消えたテスト参照は失敗する。
- `--base` は実在commitへ解決してからgit diffを読む。変更されたUI/data pathをREVIEWとして出す。ローカルstate切替、変数から組み立てるhref、間接API/RPC、callback内の意味、実際の通信回数/時間は静的解析の保証外であり、Skill・独立レビュー・必要な実操作で補う。既存のsource署名は整形済み構文の一致を検査し、正しさの証明には使わない。
- `form-submit` はGETと断定できない操作フォームも含む候補、`client-request` はPOST等も含む候補。保存/送信を実行する指示ではない。読み取りか書込みかを確認し、確認対象外の動作を勝手に広げない。
- `coverage` の `entry-only` / `partial` / `unit` は登録したテストがどこまで扱うかを表す。参照が存在することと、テストの実行・実データの到達・全経路の合格は別。現時点で多数の遷移は入口のみ/部分的な自動確認であり、全81遷移の意味的な網羅を主張しない。
- normal checkは読み取り専用。`navigation:docs` だけが明示操作で仕様書の表を更新する。いずれも通信・秘密情報参照・DB書込み・CI起動・配備を行わない。既存workflowや強制checkは変更しない。

共通Skillは `claude-skills/.claude/skills/navigation-design-review/SKILL.md`。各製品の時間/容量予算と権限は当該リポジトリの契約・AGENTSに従う。

## 市場3画面の自動更新

2026-10-24: [鮮度契約](../../decision-log/2026-10-24-market-freshness.md)と[UAT](../../uat/market-freshness.md)を適用する。対象画面の再読み込みは更新の前提にしない。

### Portfolio構成軸のlocal切替（2026-10-31）

From: 保有一覧の業種／個別株のみ。To: 同画面の7分析軸・登録保有全体／個別株のみ。L01/L0に該当し、取得済みpositionsとinstrumentAnalysisの再集計のみ（追加request 0、追加転送0）。選択値と凡例・対象額を同じrenderで確定し、pendingやretry通信はない。空・0円は図を描かず、分類errorは説明と利用可能な軸を示す。資産クラスへ変更すれば分類エラーのない集計へ戻れる。キーボードはnative selectとaria-pressed付きbuttonを使用。初回取得・認証・再読込は既存routeの契約を維持する。回帰: allocation-donut.test.tsxとportfolio UAT。操作時間の実測は未測定。

### Portfolio連動分析（2026-10-31）

L01/L0: From保有一覧の軸/scope/分類 → To同pathの新しい共通選択。取得済みpositions・分類・配当viewだけで同期集計し、追加request/転送0。軸/scope変更は分類選択解除、同条件再押下は保持。分類の再押下/全体表示で解除。graph/配当/商品で同じscopeと選択を同時確定し、URL・Back履歴は追加しない。native buttonとaria-pressed・表示範囲のstatusを用い、通信spinnerを追加しない。通常の軸切替ではcard高を維持し、全明細は明示展開、軸/scope変更で閉じる。初期の読取待機/失敗/retryは既存route契約。分類errorは図・分類内訳を保留し、非分類軸へ戻れる。配当source/数量の不整合は0円に置き換えず保留。回帰はlinked-analysis.test.ts、allocation-donut.test.tsxとportfolio UAT。単発の合成画面操作の確認と、本番実測/認証UATを区別する。

### 配当構成グラフの選択（2026-10-31）

保有一覧の分類別配当button → 同一path・同一scope/軸の分類選択/解除。既存local stateのみ、追加通信0。分類名・配当額・商品範囲は同renderで更新し、上部保有全体サマリーは固定する。棒は確認済み予想額の内訳で、未確認分の全体額へ補完しない。データ未確認/error/対象なしは棒を出さず既存状態を表示する。軸/scope変更で分類を解除し、同軸再選択は保持。独立した待機spinnerや新たなretryは追加しない。分類取得失敗から資産クラス等への復帰は既存契約を維持する。回帰はdividend-display.test.tsxとportfolio UATを参照。

### 企業グループの専用ローカル画面（2026-10-31）

同一pathの詳細メニューbutton → 企業グループ画面。既取得のServer Component propsを表示するlocal切替で、追加通信0・待機UI不要。表示内容と選択中メニュー名を同renderで更新し、成功/取得失敗/公式保有なしは元の契約を維持する。保有一覧buttonで復帰し、企業グループは保有一覧へ重複描画しない。既存の同pathタブと同じくURL/historyは増やさない。回帰はportfolio UATの分離シナリオで確認する。

### 保有分析のAll初期表示（2026-11-01）

初回local stateを資産クラス/登録保有全体/分類未選択とする。従来の軸/scope/分類変更・解除と同じlocal切替で、追加通信なし。配当/商品と表示範囲を同renderで更新する。凡例は上揃えと通常ページスクロールを用い、先頭が隠れる内側の中央揃えスクロールを廃止する。回帰はportfolio UATを参照。


### 保有サマリーの対象／表示形式切替（2026-11-01）

L01/L0: 同一pathの上部4カード→対応する資産／配当と正規軸・scope・分類。グラフ／一覧button→同じ選択範囲の表示形式のみを変更。取得済みpropsの同期再集計で追加request・転送0、URL/history・新しい待機／retryなし。カード変更は表示形式を維持し、同カードでも分類絞込み中なら全範囲へ戻す。失敗・未取込・未知・対象なしの既存状態を維持し、分類errorは非分類軸へ復帰可能。native button、aria-pressed、範囲status、継続表示する解除buttonを使う。回帰はsummary-selection.test.tsx、allocation-donut.test.tsxとportfolio UAT。


### 配当対象期間と操作階層の整理（2026-11-01）

L01/L0: 上部の表示対象カード→表示形式→分類条件の順へ配置を整理する。同じlocal stateを同renderで反映し、7軸の常時到達、範囲保持、解除、native button/aria-pressedを維持。クリックで新しい通信・URL/history・pendingを追加しない。期間付き公表額は取得済みpropsの検証済み値のみで描画し、未知・失敗・年額除外を区別する。初回DB読取のoptional列が42703の場合のみ同条件で既存列を再読取し、その分1回のreadが増える。権限拒否は従来errorから回復を案内する。回帰はdividend-period.test.tsx、data.test.tsとportfolio UAT。
