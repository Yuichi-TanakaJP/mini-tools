# ポートフォリオ 仕様

> **実装状態:** 2026-08-23時点の画面は、最新snapshot、active policy・policy履歴、保存済みreview/recommendation/action、latest reflectionを読むUI-1〜UI-2初回版に、UI-3のreview履歴分離表示と外部口座・参考資産の読み取り表示を加えたものである。reviewが参照したpolicy versionも表示する。
> ポートフォリオ意思決定プラットフォームの完成品ではない。目標運用とUIの実装順序は
> [ポートフォリオ意思決定ワークスペース実装計画](../../plans/portfolio-decision-workspace-plan.md) を参照する。
> クロスリポジトリの現行正本はstock-notesの
> [V2正本設計](https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/docs/portfolio-platform-v2.md) であり、旧V1計画より優先する。

## 概要

- 2026-09-18: 国内株式の保有判定を銘柄分析・ホーム通知・開示レーダーと共有する。対象Portfolio・公式ready snapshotの選択は共通selector。CSV再取込は不要。詳細は[統合判断](../../decision-log/2026-09-18-portfolio-holdings-authority.md)。全資産の表示範囲は従来どおり。

- URL: `/premium/portfolio`
- 分類: Premium / 投資管理
- 現行の主な用途: ChatGPTで保存したポートフォリオ判断を「意思決定」画面で確認し、保有明細・履歴・DB確認を補助表示として利用する

## 対象ユーザー

- Premium仮ログインを通過し、同じSupabaseユーザーでstock-notesを利用している本人

## 画面仕様

### 主な画面要素

2026-09-19表示整理: 主タブは意思決定・保有一覧・履歴。口座・取込、方針、DB確認は詳細メニューに保持する。企業グループ集中は保有一覧内の展開詳細とし、方針・reviewの長文は明示した冒頭抜粋と全文展開で表示する。推薦条件・Action詳細・振り返りも展開可能で、保存済み情報は削除しない。

- **意思決定**: 判断状態、snapshot/reviewの基準日、全体要約、金額なしの補強・調査recommendation、未完了portfolio action
- **保有一覧**: 公式保有と外部参照資産を合算した総資産評価額、基準日・状態の口座別確認、公式保有の取得額・含み損益・商品別配分、分析軸を切り替えられる構成分析
- **口座・取込**: 最新の公式snapshotの口座別ポジション明細、過去の取込履歴、外部口座・参考資産の別明細。外部資産はiDeCo・企業型DC・海外口座・暗号資産・現金等を対象とする
- **方針**: active policyの版・原則・構造化ルール・変更履歴、現行reviewの一時判断、latest reflection
- **履歴**: snapshot履歴とreview履歴。reviewは`draft` / `finalized` / `superseded`を表示し、置換済みreviewは現行判断と分けて表示する
- **DB確認**: MiniToolsがSupabaseから取得したportfolio、snapshot、position、review、review itemの生行数・ID・基準日を読み取り専用で確認する。銘柄マスタ件数は、portfolio_idを持たないユーザー単位の取得結果として表示し、readyがない場合は最新取込snapshotのポジション行も確認する

### 入力

- 現段階では画面からの編集入力は持たない
- CSV取込はstock-notesの認証付きAPIを使用する
- 目標仕様でも主入力はMiniToolsのフォームではなく、ChatGPTとの相談とする
- ChatGPTが全体contextを取得し、ユーザー確認後にreview/actionを保存する経路は未実装
- policyのdraft作成・active化、reviewのfinalize、reflectionの保存はMiniToolsから行わない。GPT/APIの責務である
- 外部資産の登録・更新・削除もMiniToolsから行わない。ChatGPTで確認した内容をstock-notes APIへ保存し、MiniToolsは結果を読み取る
- MiniToolsの画面からrecommendation/actionを編集・保存する入力は持たない。保存済みデータの正本はstock-notes API/DBである

### 出力

- 「意思決定」では、保存済みreviewの基準日・状態・要約、recommendationの対象/優先順位/条件/理由、actionの状態/実行条件を表示する
- 「意思決定」では、reviewが参照したpolicy versionを表示する。旧reviewで参照先が未保存の場合は「未紐付け（legacy review）」と表示し、active policyと混同しない
- 「方針」では、現行review（`draft`または`finalized`）だけを表示する。`superseded`しか残っていない場合は現行reviewなしとして表示し、履歴タブへ案内する
- 「履歴」では、`superseded`を含む保存済みreviewを表示する。`superseded`は「未確定のまま新しいreviewに置き換えた履歴」であり、現在の判断には使わない
- `proposed_amount` と `proposed_pct` が未設定のrecommendationは「金額未指定」「金額を仮定しない」と明示する
- 株式・投資信託を商品単位で表示する
- 口座別の同一商品は「表示」では集約し、「記録」では分けて表示する
- 金額が未取得の場合は `—` とし、0円とは区別する
- 外部資産は、未登録・取得済み・取込中・取得失敗を別状態で表示する。最新取込が失敗・取込中でも、最後に成功した外部snapshotがあればそれを表示し、最新状態を警告として併記する。評価額未取得の明細も `—` とし、0円とは区別する
- 外部資産のsnapshotには `external_reference` scopeを表示し、基準日・取得元・口座種別・資産種別・数量または残高・通貨・評価額を確認できる
- 外部資産の「未紐付け」は国内株・海外株で `stock_id` がない場合だけを数え、現金・預金・暗号資産・iDeCo残高など銘柄マスターを必要としない資産を誤警告しない
- 外部資産の評価額は「保有一覧」の総資産評価額へ合算し、出所別の基準日・状態・明細は「口座・取込」で確認する
- 上部ドーナツは取得scopeではなく業種等の分析軸で表示し、凡例の金額と割合でも判別できるようにする
- `official` / `external_reference` は証券会社や口座の信頼度ではなく、snapshotに保存されたデータ管理scopeである
- 取得額・含み損益・公式保有の商品別構成比は、外部資産に原価や同一基準日の情報がない場合があるため、現段階では公式保有だけを対象とする
- 「保有資産の構成」は最新readyの公式snapshotを、資産クラス、口座種別、東証33業種、景気感応度、インカム特性、時価総額帯、銘柄別で切り替えて表示する
- 構成比は評価額を基準とし、分類できない評価額も「未分類」として分母に残す。評価額未取得は0円とせず、件数を注記して分母から除く
- 「個別株のみ」は `domestic_stock` / `foreign_stock` だけへ対象を絞る。対象内の分類欠損は引き続き「未分類」とする
- 分類数にかかわらずドーナツを使う。全分類の金額・構成比を凡例に残し、多い場合はスクロールできる
- 業種、景気感応度、インカム特性、時価総額帯はsnapshot取込日時点で有効なclassificationを使う。classification取得失敗は構成分析内に表示し、保有一覧全体を失敗させない
- role、theme、industry map、corporate groupは複数所属可能なExposureであり、合計100%を前提とするAllocationへ混ぜない

### 国内株の配当ランレート（Mini Tools #584 Phase 1）

「保有一覧」の「国内株の予想配当（税引前・年換算）」は、Stock Notes正本の stock_notes_portfolio_current_dividend_projection_v を、本人のログイン済みSupabaseセッションから**read-only**で取得する。公式ready Snapshotのportfolio_id・snapshot_idに限定し、viewの金額をそのまま使用する（MiniTools側へ配当Factを保存・再計算しない）。

- **対象**：国内個別株の会社予想DPS×保有数量の年間ランレートに限る。ETF分配金・MMF・預金・投信内部収益・税引後額・実際の受取配当金を含む「Portfolio Income全体」ではない。#584の拡張範囲は引き続き未完成。
- **鮮度・カバレッジ**：Snapshot基準日と予想の出典最終確認日、対象銘柄数/観測銘柄数を表示する。Snapshotが異なる、金額/数量/予想出典が欠損、予想出典が保有基準日より未来、対象国内株に取得漏れがある場合は金額合計を「—」にする。
- **増配寄与**：dividend_rate_effect_grossを「比較可能な銘柄の配当単価変化寄与」として表示する。比較不能銘柄は除き、その件数を明示する。**年間予想額の前年差や過去実入金と同一視しない**。直近実績DPSベース合計が1行でも不明なら、全体実績額を表示しない。
- **失敗時**：viewのRLS/権限/ネットワークエラー時は配当部分だけ「取得失敗」とし、0円に置き換えず、保有一覧の既存表示を続ける。公式ready Snapshotなし・国内個別株なしも別状態。
- **表示**：主指標と銘柄別表（モバイル横スクロール、詳細を開いたときのみ表示）。銘柄別DPS「実績」は過去の会社DPSであり、証券会社の配当入金証拠ではない。

これはサービスA3 Q2の「年間予想（国内株のみ）」部分を実現するPhase 1であり、**実入金Ledger・配当の総Income・時系列・買増効果/配当単価効果の完全分解・本番UAT**は未完了のまま。必要な次Gateはdocs/uat/portfolio.mdに記載。

### 現段階でできないこと

- MiniToolsからChatGPTの相談・保存を開始する
- MiniToolsからrecommendation/actionを作成・更新・完了する
- stock-notesのdecision-context全体をMiniTools専用の共通読み取り契約として集約する（現時点はSupabaseの本人行を読み取る暫定実装）
- ユーザーが金額配分を依頼した場合の新規資金の順位・配分を表示する（現在は金額なし候補の表示のみ）
- 前回reviewとの差分を表示する
- 銘柄ダッシュボードとportfolio方針を往復する
- 外部資産を商品別構成・意思決定context・配分分析へ統合する。通貨換算、重複排除、分析対象外ルールは後続で定義する
- role/theme等の重複Exposureを、今回のAllocation切替へ統合する

### DB確認タブの位置づけ

- `/premium/portfolio` の「DB確認」は、保存結果の確認・UAT用の読み取りビューである
- DBへの保存、更新、削除は行わない
- 画面に表示する件数は、現在の取得クエリが返した生行数であり、関連行の表示用整形で除外された行も含む。銘柄マスタはスキーマ上portfolio_idを持たないためユーザー単位、それ以外は現在のportfolio・snapshot・reviewに紐づく取得範囲である。DB全体の無条件スキャンではない
- 未取込・認証必須・ready snapshotなしを0件の成功状態と混同しない
- DBの正本はSupabaseであり、この画面は表示用の派生ビューである
- recommendation/actionの取得も本人のSupabase行だけを対象とし、取得失敗を「0件」として扱わない
- 外部資産の取得失敗も「未登録」や「0件」として扱わず、外部資産セクションだけにエラーを表示する。公式保有の表示は継続する

これらは「後からあると便利」な拡張ではなく、実装計画上の完成条件である。

## データ仕様

### 取得元

- Supabaseの `stock_notes_portfolios`、`stock_notes_portfolio_snapshots`、`stock_notes_portfolio_accounts`、
  `stock_notes_portfolio_instruments`、`stock_notes_portfolio_positions`、`stock_notes_portfolio_reviews`、
  `stock_notes_portfolio_review_items`、`stock_notes_portfolio_recommendations`、`stock_notes_portfolio_actions`、
  `stock_notes_portfolio_policy_versions`、`stock_notes_portfolio_policy_rules`、`stock_notes_portfolio_reflections`
- 外部資産は同じsnapshot・account・instrument・position系テーブルを使い、snapshotの `portfolio_scope=external_reference` で公式資産と分離する。positionの `valuation_mode`、native value/currency、FX情報も読み取る
- SupabaseログインセッションとRLSで本人の行だけを取得する
- CSV取込の正本はstock-notes側の `POST /portfolio/import`

### 保存先

- mini-toolsはポートフォリオデータを書き込まない
- 方針の主保存経路はChatGPTからstock-notes APIとする
- MiniToolsの編集UIはMVPの必須要件にしない

### fallback

- サンプルデータへのfallbackは行わない
- Supabase未設定・未ログインはログイン案内、portfolio未作成またはスナップショット未取込は未取込状態として表示する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| Premium未認証 | `/premium/login?next=/premium/portfolio` へ遷移 |
| Supabase未設定・未ログイン | Supabaseログインが必要であることを表示 |
| portfolio未作成・CSV未取込 | サンプルを表示せず、未取込メッセージを表示 |
| readyスナップショットあり | 5タブに実データを表示 |
| Supabase取得失敗 | Server Componentの取得エラーとして既存のNext.jsエラー処理に委ねる |

## premium / 権限制御

- Premium Cookie認証を必須とする
- 実データはSupabase Authユーザーが存在する場合だけ取得する

## 関連実装

- [portfolio page](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/page.tsx)
- [portfolio data loader](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/data.ts)
- [portfolio types](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/types.ts)
- [portfolio workspace](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/PortfolioWorkspace.tsx)
- [portfolio decision view](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/PortfolioDecision.tsx)
- [external asset display model](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/external-assets.ts)
- [portfolio allocation engine](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/allocation.ts)
- [portfolio analysis card](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/PortfolioAnalysisCard.tsx)

## 関連 docs

- UAT: [ポートフォリオ UAT](../../uat/portfolio.md)
- Decision Log: [ポートフォリオの「表示・記録・方針」構成](../../decision-log/2026-08-14-portfolio-record-display-policy.md)
- Decision Log: [ChatGPT起点の意思決定ワークスペース](../../decision-log/2026-08-15-portfolio-chat-first-operating-model.md)
- Decision Log: [ポートフォリオのWhatとpolicy/reflection表示](../../decision-log/2026-08-22-portfolio-what-and-policy-reflection-display.md)
- Decision Log: [外部資産の表示と公式集計の分離](../../decision-log/2026-08-23-portfolio-external-assets-display.md)
- Decision Log: [公式保有と外部参照資産の総資産評価額](../../decision-log/2026-08-28-portfolio-total-assets-valuation.md)
- Decision Log: [ポートフォリオ構成分析とExposureの分離](../../decision-log/2026-09-07-portfolio-allocation-analysis.md)
- Plan: [ポートフォリオ意思決定ワークスペース実装計画](../../plans/portfolio-decision-workspace-plan.md)
- Cross-repository source: [stock-notes Portfolio V2](https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/docs/portfolio-platform-v2.md)
- Acceptance checklist: [stock-notes Portfolio V2 checklist](https://github.com/Yuichi-TanakaJP/stock-notes/blob/main/docs/portfolio-platform-v2-checklist.md)


### 2026-10-31 配当の株数基準と完全合計（V2 Phase 6）

同じ本人セッションで `stock_notes_portfolio_dividend_totals_v` をportfolio/snapshot限定で読む。
年間合計は同snapshot・holding/confirmed件数一致・held_count=0・status=resolvedを確認したDBの完全合計だけを使用する。
projection行のcash_projection_statusがresolvedでない場合、raw_forecast_dpsを計算や表示DPSへのfallbackに使わず「基準未確認」とする。
完全合計NULL、totals欠落、DB未導入、権限失敗は未確認表示とし、旧viewの行合計・部分和・0円に置換しない。
株数の自前調整やFact保存は行わない。今回の受入範囲はPhase 6の共有読取契約と保有表示の一致で、プラットフォーム全体完成ではない。

### 2026-10-31: 保有資産の構成

保有一覧の上部は「保有資産の構成」とし、資産クラス／登録保有全体（All）／絞込みなしを初期表示する。資産クラス・口座種別・東証33業種・景気感応度（シクリカル等）・インカム特性・時価総額帯・銘柄別の7軸を、常にドーナツで表示する。ドーナツは上位6分類と残りの「その他」を基本とし、未分類は別枠に残す。全分類は展開して確認・選択できる。下部の重複分析は置かない。

対象は最新readyの登録保有で、「登録保有全体」または国内株・海外株の「個別株のみ」。外部参照資産は対象外で、上段の総資産評価額と分析対象額は区別する。未分類は分母に残し、評価額未取得は除外件数を示す。分類取得失敗時は分類の図を出さず、他の軸への切替を案内する。出所・基準日は「口座・取込」で確認する。上段の総資産集計は維持し、下の配当・商品構成は選択範囲へ連動する。

### 2026-10-31: 分析軸と配当・商品構成の連動

V2 Phase 6 / MiniTools UI-3の保有表示改善。受入条件は7軸の常時選択、同一分類・同一範囲の連動、未評価保有の維持、配当の保留契約維持。V2全体の完成条件は変更しない。

- 分析軸はドロップダウンではなく7個の常時表示button（aria-pressed）とする。軸変更で下部も同じ軸で分類する。
- 分類buttonで配当・商品構成を絞り込む。同じ分類の再押下・「すべて表示」で解除。軸・対象scopeを変更すると分類選択を解除する。現在と同じ軸/scopeの再押下では選択を維持する。
- グラフの分母はscope全体の既知評価額。分類選択時は該当sliceを強調し、中心に選択額を表示する。商品一覧の割合は表示中の範囲を分母にする旨を明示する。
- 多分類は上位6＋集約その他、未分類は独立。全明細から上位以外を選ぶと、その分類＋他の分類＋未分類へ描画し、細分化と選択の不能を避ける。原分類`other`と集約その他のkeyは別にする。
- PCのSVG枠は320px、モバイル300px。グラフ・凡例領域の高さを予約し、通常の軸切替でcardが伸縮しない。全明細の展開は明示操作による高さ変更として扱い、軸/scope変更時に閉じる。
- 商品のgroup/filterは評価額未取得も含む全ポジションから作る。グラフだけ未取得額を除く。評価額未取得を0円へ変換しない。
- 分類取得失敗では未分類100%を作らず、分類の図と分類別内訳を保留する。scope内の商品と配当の読取は維持し、分類不要の軸へ切替可能にする。

#### 選択範囲の配当

DB正本の補正済みinstrument別配当額を使用する。口座分類では「選択口座の数量／全口座の数量」でDB金額を分け、評価額比やraw DPSで配分しない。全数量が正で、選択数量が有限・非負・全数量以下、DB projection数量と全口座数量が一致することを確認する。元Fact・保有・原価への保存/変更は行わない。

subsetを確定する前提として、元sourceの一意coverage、snapshot、totals状態・件数・既知部分和/完全合計の金額一致をsourceIntegrityで検証する。これは内部読取証明であり、DBの新たな事実ではない。不整合・重複・空白数値・未知の数量を0円にせず保留する。全体のDB合計と行金額が不一致でも、どちらかを盲目的に採用せず保留する。

選択内の国内株が全て確認済みなら、選択外に保留があっても選択範囲の額のみ表示できる。scopeと分類名を配当/商品構成双方に表示し、ポートフォリオ全体額とは区別する。選択内に保留があれば合計NULLを維持する。国内株なしは「対象国内株なし」であり配当0円ではない。全体の範囲が一致するときは、整合確認されたDB完全合計を維持する。ETF/MMF/投信等は配当集計対象へ追加しない。

比較可能な国内株が0件の場合、単価変化の寄与は0円ではなく未確定（NULL）とする。年額が確認済みでも過去比較まで確定したことにはしない。

読取時にquantityKnownを保持し、nullableな元数量を表示用0へ正規化したことを既知数量の証拠にしない。配当按分は全口座・選択口座の数量が明示的に既知の場合だけ許可する。商品数量も未知なら「—」とする。

### 2026-10-31: 配当を上部サマリーと構成グラフへ追加

V2 Phase 6 / MiniTools UI-3。上部4指標を総資産評価額・年間予想配当（国内株）・取得額・含み損益とし、ポジション件数は総資産の補足へ移す。年間配当は国内個別株・税引前の予想で、実入金や全商品の収入ではない。上部は保有全体を維持し、下部の軸・scope・分類選択で変えない。

上部も既存の全保有数量検証を通す。完全合計はreadyのDB完全合計だけ。未確定時は見出しを「年間予想配当（確認済み分）」に変え、確認済み額を主表示する。確認済み/対象銘柄数・未確認件数と「全体合計は未確定」を併記し、完全合計と区別する。確認済み額がない場合だけ主値を「—」にする。sourceIntegrity、一意coverage、数量、予想日付、非負有限額の検証を満たさない金額は部分和にも使わない。既知無配0円、未知、対象なし、取得失敗を区別する。

下部の配当セクションは分類別の横棒グラフを先に表示し、その下に比較指標・銘柄別明細を置く。分類名・金額を押すと従来どおりグラフ・配当・商品が同じ範囲へ連動する。棒の長さ/割合の分母は表示範囲の確認済み予想配当額だけ。未確認銘柄は0円の棒や推測額にせず件数を明示し、部分和を全体の年間額と呼ばない。分類取得失敗では分類グラフを保留する。登録保有と分類の読取以外の通信・書込みは追加しない。

画面配置: 上部サマリー → 共通7軸/scope選択 → 資産ドーナツと配当横棒の2列比較 → 配当の比較指標・明細 → 商品構成。900px以下は1列にし、両グラフは同じ共通選択を使う。

### 2026-10-31: 配当額の視認性と上部リンク整理

確認済み分を小さい補足へ隠すと配当金が未表示に見えるため、部分和を「確認済み分」と明記した主表示へ変更する。完全合計NULL・DB正本の検証・対象国内株のみという契約は変えない。全体合計の確定を装うfallbackは追加しない。既知無配0円と未取得を引き続き区別する。

ページ固有の「← Premium ホーム」「優待銘柄メモ」の横長リンク列は削除する。共通ヘッダーのPremium導線・ツールメニュー・ブラウザーの戻る操作は維持し、新たな遷移や通信を追加しない。

### 2026-10-31: 企業グループ集中の表示場所

V2 Phase 6 / MiniTools UI-3。保有一覧の先頭にあった「企業グループ集中の詳細」は撤去し、「詳細メニュー → 企業グループ」の専用ローカル画面へ移す。保有一覧は資産・配当サマリーから始まる。主ナビ3項目は増やさず、企業グループは必要時だけ開ける。

URL/取得/RLS/集計は変更しない。既存のServer Componentから渡された内容を再利用し、選択時の追加通信は0。現在の詳細メニューに選択中の画面名を示し、「保有一覧」で戻れる。公式保有なしは表示不可理由、取得失敗は既存の局所エラーをそのまま表示する。新規ページ/API・自動処理は追加しない。

### 2026-11-01: All初期表示と凡例の見切れ修正

保有分析の初期選択は資産クラス・登録保有全体・分類選択なし。投資信託/国内株/海外株/現金等を最初から分析対象へ含める。配当計算の対象・外部参照資産の境界は従来どおりとする。

凡例の中央揃えと固定168pxスクロール領域により上側の分類が領域外へはみ出していたため、上揃え・自然な高さ・通常のページスクロールへ変更する。株や投信の名前は省略せず折返して表示する。通常の分類数ではPC360px/モバイル304pxの最小領域を確保して切替の伸縮を抑え、内容が多い/長いときは全表示を優先して伸長する。上位6＋その他・未分類独立・全明細からの小分類選択は維持する。
