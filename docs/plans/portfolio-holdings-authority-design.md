# Portfolio保有正本とマイ銘柄・銘柄分析・通知の連携設計

調査日: 2026-09-17 / 状態: **設計提案。実装・データ移行・権限変更は未実施。採用確認前に切り替えない。**

## 1. 結論と今回の受入条件

取込済み保有の正本には、マイ銘柄のLocalStorageではなく **Portfolioのsnapshot/positionを使う**ことを提案する。数量・取得額・評価額・損益・口座・取込履歴を持つためであり、単なる保存場所の変更ではない。

ただし、これは「選択したPortfolioの取込基準日時点の保有」であって、全口座の現在保有を保証しない。ウォッチ、銘柄分析、投資方針は別の責務として残す。

- 対象: [MiniTools実行計画](./portfolio-decision-workspace-plan.md)のUI-4銘柄連携、stock-notes V2 Phase 6の連携基盤設計。ホーム・開示レーダーはその保有読み取り契約の利用候補。
- 今回の受入条件: 現行取得経路、正本の範囲、鮮度・欠損、認証境界、画面責務、移行/復旧、実装順と検証条件を文書化する。
- V2全体の完成条件やPhaseは変更しない。保有表の連携だけで意思決定ワークスペース完成とは扱わない。
- 方針・review・recommendation・reflectionは既存V2契約を維持し、個別銘柄分析を全体判断の主入力に戻さない。

## 2. 調査範囲と根拠

静的コード調査であり、本番DBの件数、口座網羅性、最新取込日、ログイン後の実画面は未確認。以下の実装が本番に配備済みとは断定しない。個人の保有データや認証情報を取得・保存していない。

- MiniTools: `40fdc15985b83c41045c60861c0db9dca5de82e5`（調査時origin/main）
- stock-notes: `8b2b7c0eebe35f0bf4dda2c5eac3b2f60632df63`（GitHub mainを固定参照）。手元の別作業中checkoutは変更していない。
- 正本: [V2設計](https://github.com/Yuichi-TanakaJP/stock-notes/blob/8b2b7c0eebe35f0bf4dda2c5eac3b2f60632df63/docs/portfolio-platform-v2.md)、[V2実装計画](https://github.com/Yuichi-TanakaJP/stock-notes/blob/8b2b7c0eebe35f0bf4dda2c5eac3b2f60632df63/docs/portfolio-platform-v2-implementation-plan.md)、[適合チェックリスト](https://github.com/Yuichi-TanakaJP/stock-notes/blob/8b2b7c0eebe35f0bf4dda2c5eac3b2f60632df63/docs/portfolio-platform-v2-checklist.md)。保有数量・取得額・評価額・口座の正本は既にsnapshot/positionと定義されている。

| 対象 | 確認した実装 | 設計上の意味 |
|---|---|---|
| マイ銘柄 | `app/tools/my-stocks/{types,storage}.ts`。`my_stocks_items_v1`にholding/watch、数量、取得単価、口座区分、メモ | 手入力情報。評価額・損益・取込snapshotは持たない |
| 手動同期 | `lib/sync/{client,registry}.ts`。キー単位の時刻比較による同期。空配列のpush抑止あり | クラウドコピーは保有の鮮度保証ではない。既存同期を移行処理に流用しない |
| ホーム通知 | `app/HomeNotifications.tsx`の`loadItems()`。holding/watch両方のcodeを使用 | Portfolio取込だけでは通知対象に反映されない |
| 開示レーダー | `app/tools/disclosure-radar/ToolClient.tsx`も`loadItems()` | ホームと同じ対象解決器へ寄せる必要がある |
| 銘柄分析 | `app/tools/stock-notes/{data,load}.ts`。`fetchHoldings()`は`/api/sync`のクラウドコピーを取得 | 端末側ともPortfolioとも不一致になり得る |
| 分析分類 | `app/tools/stock-notes/logic.ts`。categoryでタブ・優先順位を制御し、archivedを要対応から除外 | categoryだけでは現在保有を判定できない |
| Portfolio | `app/premium/portfolio/data.ts`。snapshot、position、account、instrumentを読み取り | 口座別数量・単価・評価額・損益・通貨・stock_idを再利用可能 |
| 取込 | stock-notes `app/portfolio_import.py`、`app/portfolio_csv.py` | 国内株・投信を処理。最新取込は公式scope全体のsnapshotであり、口座別追記ではない |
| 分類への副作用 | stock-notes `app/services.py`の`_ensure_stock_category()` | CSV取込は既存watch/research/archivedもholdingへ変更する。単なる参照連携とは別の既存挙動 |
| 外部資産 | stock-notes `app/portfolio_external_assets.py`、MiniTools `data.ts` | external_referenceは公式保有と別scope。総資産評価への合算と、個別銘柄通知への採用は別問題 |
| 共有API | stock-notes `app/portfolio_decision_context.py` | readyを先に絞る。MiniToolsとdefault選択・scopeの扱いに差がある。現状の取得明細だけでは口座別数量の共通契約にならない |

### 重要な制約

1. 公式CSV取込は新snapshotをready化し、同一Portfolioのそれ以前のready公式snapshotをsupersededにする。部分口座CSVを「差分追加」と誤解すると旧口座が見えなくなる。画面で全口座網羅を推測しない。
2. CSVに保有行がなければ現行parserはエラーにする。現在の経路で「全売却・保有ゼロ」を確定する手段はない。将来の明示的ゼロ保有取込は別契約が必要。
3. 取込リクエストの基準日時が未指定の場合、取込処理は現在日時を補う。既存`as_of`だけから証券会社の観測日が検証済みとは言えない。
4. MiniToolsは最新20snapshotを取得後にreadyを探す。新しい失敗等が20件以上あると以前のreadyを見落とし得る。共有化ではこの探索方法を踏襲しない。
5. MiniToolsはdefault以外へのfallback、旧scope=nullの公式扱いがある一方、decision-contextはdefault・officialを明示する。共通化前に互換方針を決める必要がある。

## 3. 責務と正本の提案

| 情報 | 提案する正本 | 更新主体 / 他画面での扱い |
|---|---|---|
| 取込済み保有、口座、数量、金額 | Portfolio snapshot/position | 既存取込。マイ銘柄・分析では読み取り専用 |
| 手入力ウォッチと自由メモ | 当面マイ銘柄LocalStorage＋既存任意同期 | 利用者。Portfolioへ自動コピーしない |
| 旧手入力保有とそのメモ | 既存LocalStorage・同期コピーを保全 | 「旧手入力保有」として確認可能。採用後の主保有とは合算しない |
| 個別分析・thesis・分析上の管理分類 | stock-notes | 既存分析フロー。実保有判定とは別フィールド |
| 方針・全体判断・次の行動・振り返り | Portfolio V2 | GPT＋明示確認。今回変更しない |

最初から全データを1テーブルへ統合しない。マイ銘柄watchの自由メモとstock-notesのwatch分類は同じデータではなく、片方で他方を上書きしない。

保有を表す派生値を`heldInSnapshot`と呼び、stock-notesの`category`と分離する。分析対象から除外した銘柄も、保有していれば保有として扱う。allocation除外を通知除外に流用しない。

CSV取込のcategory昇格は既存の書き込み挙動として残るため、独立したstock-notes側変更が必要。提案は「取込は保有事実とstock_idの接続を担当し、既存の編集分類は変更しない」。新規銘柄の初期分類と旧categoryの互換は同リポの設計確認・回帰テスト後に決め、今回一括修正や過去categoryの推測復元をしない。

## 4. 共有読み取り契約案

### 経路と所有者

MiniToolsに認証付きの保有projectionを1つ設け、Portfolio・マイ銘柄・分析・通知が同じ選択規則を使う。`GET /api/portfolio/holdings`は**仮称・未実装**。

- stock-notesがsnapshot選択・保有事実の契約を所有する。V2の`GET /portfolio/decision-context`は全体判断用に継続する。
- 保有projectionはその補助契約であり、policy/exposure等の代替APIではない。通知のために全体判断・分析本文を一括取得しない。
- 初期実装候補はMiniToolsのSupabaseユーザーセッションを使うサーバー共通loader。stock-notesと共通fixtureで選択結果を照合する。恒久的な共有契約/APIへの切出しを同時に両repoで合意することを着手条件とする。
- owner固定のstock-notesクライアントを一般ログインユーザーの代理として流用しない。ユーザー委譲の保証がないAPIを直接proxyしない。

### 選択規則

1. 検証済みユーザーと選択portfolio IDを必須の境界にする。未選択ならdefaultを取得し、複数defaultやdefaultなしは選択要求にする。更新日時の新しい別Portfolioへ黙ってfallbackしない。
2. `official AND ready`で絞ってから`as_of DESC, imported_at DESC, id DESC`の先頭1件を取得する。新しい試行状態は別取得して警告する。旧scope=nullは件数・来歴を確認するまで自動採用せず、互換対応待ちとする。
3. snapshot IDを固定して全position・必要なaccount/instrumentをページング取得し、user/portfolio/snapshotの一致を検証する。参照欠落や途中取得失敗を正常な部分一覧にしない。
4. 取込競合でsnapshot状態が変わった場合は再取得し、一貫したsnapshotを返せなければ再試行可能エラーにする。別時点の明細を混ぜない。
5. 新しいfailed/importingがあっても以前のreadyを表示できるが、基準日と新取込未反映を必ず表示する。直前readyの存在とAPI障害時の古いキャッシュfallbackを混同しない。

### 最小レスポンス（フィールド案、DDLではない）

| フィールド | 意味 |
|---|---|
| `schemaVersion` | 契約の版。初期案は1 |
| `state` | `ready / no_portfolio / selection_required / no_snapshot / unavailable / legacy_scope_pending`。HTTP 401/403は別途扱う |
| `portfolioId, snapshotId, scope` | ready時の出典。初期scopeはofficial |
| `asOf, importedAt, fetchedAt` | 取込上の基準日時、保存日時、取得日時を区別 |
| `asOfEvidence` | `source_confirmed / import_default / unknown`。既存の根拠不明値はunknown |
| `coverage` | `unknown / user_confirmed`と対象account ID一覧。初期はunknown。確認記録の永続化は別途設計し、取得だけでconfirmedにしない |
| `latestAttempt` | snapshot ID・状態・日時。取込失敗の生エラー/個人情報は返さない |
| `positions[]` | accountId、instrumentId、stockId nullable、assetType、identifier、name、currency、quantity、unitCost、quoteUnit、costBasis、marketValue、unrealizedPnl |
| `warnings[]` | 根拠不明基準日、取込未完了、範囲未確認、通知非対応商品などの構造化コード |

金額・数量はdecimal文字列、欠測はnullを維持する。nullを0にしない。notification側はコード集合と状態・基準日だけを使用し、ログ・URL・公開キャッシュに金額を含めない。将来の最小audience projectionも同じloaderから派生させる。

### 同定・集計

- 行の同定はsnapshot＋account＋instrument。口座をまたぐ表示集計はinstrument ID単位とし、口座別明細を保持する。
- 国内株はstock_idを優先接続し、欠損時のみ国内株と確認できるidentifierを正規化して照合する。名前の類似や外国株の裸tickerで結合しない。
- 通知コード集合は正の数量を持つ対応国内株から重複除去して生成する。投信・現金・暗号資産等のidentifierを国内株コードとして扱わない。
- 通貨/単位が異なる値を加算しない。取得単価は単純平均しない。取得額・数量が揃う場合のみ商品の単位規則に従い算出し、不足時は不明とする。
- external_referenceは初期通知対象に混ぜない旨を表示する。公式との重複、商品同定、数量の信頼性を解決した後の拡張であり、既存総資産表示やV2全資産対応の完成条件を縮小しない。

## 5. 画面と状態

| 利用先 | Portfolioモードでの提案 |
|---|---|
| Portfolio | 全体判断を主画面に保ち、基準日・対象口座・取込警告を提示。保有明細から個別分析へ |
| マイ銘柄 | 「保有」は読み取り専用のPortfolio明細。「ウォッチ」は既存編集。「旧手入力保有」は別表示。旧メモは消さない |
| 銘柄分析 | holdingタブと実保有バッジは`heldInSnapshot`から派生。分析管理categoryと別表示。stock未接続なら「分析未登録」 |
| ホーム・開示レーダー | 初期提案は「Portfolio保有＋この端末のウォッチ」。保有のみ/ウォッチのみの内訳を表示。旧手入力holdingは重ねない |

archivedかつ保有中の場合、アーカイブを勝手に解除せず「保有中・分析はアーカイブ」を保有タブと確認対象に出す。categoryをholdingに書き換えることで画面を整えない。保有から消えても売却と断定せず、watch/research/archiveへの自動変更は行わない。

往復リンクの案はportfolio ID・instrument/stock ID・snapshot IDを引き継ぎ、現在保有と当時の判断を区別する。現在はこの往復仕様は未実装。実装時は所有権とIDを検証し、戻り先はアプリ内allowlistに限定する。最新の明示的recommendationのみを個別評価と区別して表示するV2方針を維持する。

### 利用モードと失敗

- 初回は現行legacyモードを維持。利用者が比較結果を見て「Portfolioを保有元にする」を明示選択する。ログインだけで自動移行しない。
- 設定はユーザー＋portfolio単位。初期は端末内の版付き設定のみとし、別端末への自動適用はしない。ログアウト・ユーザー切替で保有と設定の適用を解除する。端末watchはアカウント所有データと誤表示しない。
- Portfolioモード中の401/403はログイン/権限案内、未取込は取込案内、通信失敗は再試行にする。古いlocal holdingへの無言fallbackはしない。
- readyで通知対象国内株が0件（例: 投信だけ）と、snapshotなし、API失敗、全資産保有ゼロは別表示にする。
- 失敗時もwatchだけの通知は表示可能だが、「保有分は取得できていません」を表示し、全体0件・全件確認済みとは扱わない。
- 更新は画面表示、明示更新、ログイン/ユーザー/portfolio切替、フォーカス復帰を契機とする。リクエスト競合は破棄し古い応答で新ユーザーを上書きしない。常駐監視・自動取込は追加しない。
- 基準日からの経過日数を表示する。暫定の「7日で古い」等は固定しない。利用者の取込頻度と期待鮮度が決まるまで「最新保有」と称しない。

## 6. 認証・プライバシー

Supabaseスキルの指針と[公式RLS文書](https://supabase.com/docs/guides/database/postgres/row-level-security)に従い、ログイン済みという条件だけでなくowner境界を検証する。

- 現行PortfolioのPremium判定＋Supabaseログインを、新しいサーバールートでも維持する。公開ホームから呼べることを認可緩和の理由にしない。Supabaseのみで提供する変更は別途ユーザー判断が必要。
- user IDをクライアント指定で信用せず、検証済みセッションから得る。RLSとowner/portfolio条件を併用し、他ユーザーID指定・期限切れセッションをテストする。
- service_roleをブラウザに渡さない。サーバーでもユーザー読み取りを広権限キーで迂回しない。新規view/RPCが必要なら実行権限・RLSを別レビューする。
- 初期はHTTP `private, no-store`、メモリ内のみ。公開CDN・LocalStorage・既存tool_dataへ取得保有を書かない。銘柄分析の既存永続キャッシュにもPortfolio保有を混入させない。
- ホーム/開示レーダーは従来どおり公開イベントを広く取得して端末内で絞る。保有コード集合をmarket-infoの公開APIへ送らない。分析側の既存自サーバーへの銘柄問い合わせとは境界を区別する。
- 優待期限通知、日経225等の市場全体通知、既存開示既読IDの意味は変更しない。

## 7. 移行と復旧（実行前に承認）

1. 読み取り比較: 利用者の環境でlocal・同期コピー・Portfolioの件数、コード、口座、基準日を比較する。どれも同一時点と仮定しない。本番データをrepo/PRへ貼らない。
2. 保全: 既存export機能の収録範囲を確認して、localとクラウドコピーをそれぞれ退避する。件数・メモ・watch・口座区分の保存と復元を確認してから選択を案内する。
3. 差分確認: 一致、旧手入力のみ、Portfolioのみ、口座照合不能、数量差を区別する。コード一致だけで複数口座のメモを移動しない。旧側のみを売却済み扱いしない。
4. 明示切替: version付き設定を保存し、複数画面でsnapshot ID・対象コードの一致を確認する。既存`my_stocks_items_v1`とtool_dataは削除/上書きしない。
5. 復旧: 設定をlegacyへ戻せば従来の取得経路へ戻れる。legacy側のデータが古い可能性を表示する。Portfolioの取込履歴を巻き戻したり消したりしない。

初期移行はコピーではなく参照元の切替である。LocalStorageの数量でPortfolioを上書きしない。watchのDB統合、旧holdingの削除、旧同期キー廃止は本設計の初期実装に含めず、個別の承認・復元確認が必要。

## 8. 実装順・品質ゲート

以下は後続候補であり、今回実装したという意味ではない。各PRは依存順で小さく分ける。

| 順序 | 目的 | 着手/完了条件 |
|---|---|---|
| 0 今回 | 調査・設計提案（Tier 0） | 根拠、未確認、契約、責務、復旧、未決事項を文書化。差分・リンク確認 |
| 1 両repo | 正本選択とprojection契約/fixture | default/null-scope/ready/部分口座/ゼロ保有を合意。decision-contextと同じsnapshotになるテスト。未合意なら実装開始しない |
| 2 MiniTools | 認証付き共通loaderと参照元設定（Tier 3） | owner/RLS/権限・ログアウト・キャッシュ隔離・復旧確認、関連フルテスト/build/高強度レビュー。初期off |
| 3 stock-notes | categoryと実保有の分離 | CSV昇格・新規登録・archived・旧APIの互換を確認。過去分類は推測修復しない。書き込み変更の承認後に実施 |
| 4 MiniTools | マイ銘柄・分析の読み取り連携（Tier 2以上） | 複数口座集計、旧メモ保全、archived保有、未登録分析、往復をUAT。category変更への依存を明示 |
| 5 MiniTools | ホーム・開示レーダー共通audience（Tier 2） | 両画面一致、watch継続、失敗時部分表示、公開APIに個人コード送信なし |
| 6 個別承認 | 実データ比較・利用者ごとの切替 | 比較/退避/復元確認、基準日と対象範囲の理解、同一snapshot表示。切替後も旧データ保全 |

Tier 2以上は対象lint/影響範囲テスト/必要build・独立レビュー・変更挙動UATを実施し、恒久手順を同PRのUAT文書へ追加、実施結果はPR本文に残す。認証・データ移行に波及すればTier 3へ上げる。今回のdocs-only PRで本番確認を代替しない。

### 必須テスト例

- 同一株が特定100株＋NISA200株: 通知1コード、保有合計300株、口座明細2行。単価を単純平均しない。
- 新しいfailed/importingが21件以上: 以前のreadyを取得して警告する。readyなしとは区別。
- 部分口座CSV: 消えた口座を売却・非保有と断定せず、範囲未確認を表示。
- as_of補完/不明、同日時snapshot、旧null-scope、defaultなし/複数、ページング上限超過。
- 投信のみ、数量/金額欠測、通知対応外資産、外部scopeとの重複候補を区別。
- archived＋保有、新規stock未接続、watchとholdingの重複、旧メモの残存。
- API失敗と正常な対象0件、401/403、取得途中失敗、logout中の遅延応答、ユーザーAからBへの切替。
- Portfolio画面・分析・通知のsnapshot/コード一致、取込中の一貫性、focus/manual更新。
- legacyへ戻した後の既存動作、既読状態・市場全体通知・優待期限通知の非回帰。

## 9. 採用前に確認する判断

推奨の初期案は「Portfolioの公式取込保有を主にする」「ウォッチと旧メモは残す」「権限は現行維持」「取込基準日と範囲を必ず見せる」である。

実装前の確認事項:

1. この役割分担と、Portfolioモードへの明示切替を採用するか。
2. 現行Premium境界を維持して開始してよいか。一般ログインへの開放は別製品判断とする。
3. 日常のCSVが全対象口座を含むか。期待する取込頻度と、基準日時の信頼できる取得方法は何か。
4. stock-notes側のcategory昇格を止める互換方針、および補助読み取り契約を両repoで承認できるか。

ウォッチの永続正本統合とexternal_referenceの通知対応は後続判断でよく、初期設計に自動移行を混ぜない。
