# 銘柄分析ダッシュボード 仕様

## 概要

- URL: `/tools/stock-notes`
- 分類: yutai（優待・保有）/ Supabase 直読み。`stock_notes_stocks`（追跡対象と分類の正本）のみ書き込み可
- 主な用途: 別リポジトリ [stock-notes](https://github.com/Yuichi-TanakaJP/stock-notes)（カスタムGPTから記録する銘柄分析ツール）が Supabase に書き込んだ分析・見立て・アクションを俯瞰する。特に「次に何を確認すべきか（要対応）」をトップに出し、チャットでは表面化しない抜け漏れを可視化する。また、追跡対象銘柄（`stock_notes_stocks`）の登録・分類変更・アーカイブ・削除をこの画面から行える（分析していない銘柄も含めて GPT 側から見えるようにするための入口。詳細は decision-log 参照）

## 対象ユーザー

- stock-notes のカスタムGPTで銘柄分析を記録している本人（1名想定）
- 外出先など別端末から、これまでの分析状況・見立て・未消化アクションを確認したいとき

## 画面仕様

画面最上部（目立たない位置）に、現在表示しているデータの取得時刻を「最終更新 12:05」のように表示し、隣に手動更新ボタン（「今すぐ更新」）を置く。裏で再取得中は「更新中…」に切り替わる。手動更新ボタンを押すとキャッシュの有無に関わらず即座に再取得する。詳細は「キャッシュ（stale-while-revalidate）」節を参照。

### 主な画面要素

0. **保有リストの同期状態**（画面上部）: `/api/sync` の `my_stocks_items_v1` の最終同期日時（`updated_at`）を「保有リストの同期: 2026-06-21（52日前）」のように表示する。30日以上前の場合は注意表示＋`/account`（「この端末を保存」）への導線を出す。詳細は「保有リスト同期の注意表示」節を参照
1. **未分析の保有銘柄**（最上段）: `my-stocks` の保有銘柄のうち、stock-notes 側に銘柄登録が無い、または分析が0件の銘柄。**決算が近い順**（決算日判明分を日付昇順、未判明は後ろにコード順）に並べる。コード・銘柄名・保有数量（あれば）・次回決算日の表示（下記）と「分析用プロンプトをコピー」ボタン。決算が3日以内の銘柄は強調表示する
1.5. **マイ銘柄リストからの一括取り込みバナー**（タブの外）: `my_stocks_items_v1` の `tab === "holding"` のうち `stock_notes_stocks` に未登録のものが1件以上あるとき、「マイ銘柄リストに未登録の保有が N 件あります」と表示する。「まとめて登録」を押すと対象一覧（コード・銘柄名・保有数量）を展開表示し、確認したうえで「N件を『保有』としてまとめて登録」を押すと `category='holding'` で一括登録する。いきなり書き込まず、対象一覧を確認できる2段階にする。失敗した銘柄があれば個別にメッセージを表示し、成功分はそのまま登録された状態を保つ（詳細は「銘柄の登録・分類変更・アーカイブ・削除」節）
2. **銘柄一覧**: 5つのタブ（**要対応** / 保有 / ウォッチ / 新規調査 / アーカイブ）。既定表示は「要対応」。各タブのラベルには件数を表示する（例: 「要対応 15」）。行にコード・銘柄名・現在の見立て（強気/中立/弱気の色分け＋確信度）・最終分析日・鮮度バッジ・分析件数・未消化アクション数・次回決算日の表示（下記）。行をタップすると詳細を展開（アコーディオン）。展開部の末尾に分類変更・削除の操作を置く。タブの右に「＋ 銘柄を登録」ボタンがあり、証券コード・銘柄名・分類を入力して新規登録できる（詳細は「銘柄の登録・分類変更・アーカイブ・削除」節）
3. **アクション受信箱**: 未消化（`status='open'`）のアクションを期限昇順で表示。期限切れは強調表示
4. **銘柄詳細**（一覧行の展開）: 現在の見立て（仮説・リスク・次回確認点・買い増し/撤退条件・as_of 日付）＋分析タイムライン（新しい順に結論・根拠・懸念・出典リンク）。会話原文（`body`）は「原文を表示」を押したときだけ個別取得する

### 5タブ構成（要対応 / 保有 / ウォッチ / 新規調査 / アーカイブ）

| タブ | 対象 | 並び順 |
|---|---|---|
| 要対応（既定） | アーカイブを除く全銘柄のうち、次のいずれかに該当するもの: (1) 分析0件 (2) 最終分析日より後に決算があった（決算またぎ、鮮度バッジの `post-earnings` 判定と同じ） (3) 期限切れ・期限間近（7日以内、`ACTION_DUE_SOON_DAYS`）の未消化アクションがある | 次回決算日が近い順（未判明は後ろ）→最終分析日の古い順（未分析が最上位） |
| 保有 | `category = holding` | 最終分析日の古い順（未分析が最上位） |
| ウォッチ | `category = watch` | 同上 |
| 新規調査 | `category = research` | 同上 |
| アーカイブ | `category = archived` | 同上 |

判定・並び替えロジックは `app/tools/stock-notes/logic.ts` の `stocksForTab` / `computeActionRequiredStocks` /
`sortActionRequiredStocks` / `sortStocksByLastAnalyzedAsc`（純関数、ユニットテスト済み）に切り出している。
**アーカイブは要対応を含む他のどのタブにも一切出さない**（`computeActionRequiredStocks` はアーカイブを
最初に除外する）。削除しなくても一覧から追い出せることがアーカイブの存在意義であるため。

### 銘柄の登録・分類変更・アーカイブ・削除

- **登録**: 「＋ 銘柄を登録」から証券コード・銘柄名・分類（保有/ウォッチ/新規調査。アーカイブは新規登録の選択肢に出さない）を入力して登録する。証券コードを入力すると、銘柄マスター（`app/api/stock-notes/stock-master/route.ts` 経由、`MARKET_INFO_API_BASE_URL` の `/stock-master/latest` を `my-stocks` と同じ方法で取得）から一致する銘柄名を自動補完する。マスターに無いコード（米国株等）は銘柄名欄を手入力すれば登録できる。既に登録済みのコードはクライアント側で事前チェックして登録させず、それをすり抜けた場合（`stock_notes_stocks` の `unique(user_id, code)` 制約違反）もエラーメッセージで案内する
- **分類変更**: 一覧行を展開すると分類セレクトがあり、holding/watch/research/archived のいずれにも変更できる。変更すると `category_changed_at` を更新時刻に更新する
- **アーカイブ**: 分類を `archived` に変更する操作と同じ。変更時に任意でアーカイブ理由を入力でき、入力があれば `category_change_reason` に保存する。**アーカイブが基本、削除は例外**という位置づけで、UI上は分類変更の一つとして提供する（専用の削除より優先して案内する）
- **削除**: 一覧行の展開部に削除ボタンがある。**分析が1件でもある銘柄は削除できない**（ボタンを無効化し、「分析N件が連鎖削除されるため削除できません。アーカイブしてください」と表示する）。スキーマが `on delete cascade` のため、削除すると分析・見立て・アクションが全部消えてしまうことを防ぐための制限。削除できるのは分析0件の銘柄だけで、実行前に確認ダイアログ（`window.confirm`）を出す

書き込み関数は `app/tools/stock-notes/data.ts` の `insertStock` / `updateStockCategory` /
`deleteStockById` / `bulkInsertHoldingsAsStocks`。`user_id` はログイン中のユーザーIDを呼び出し側
（`ToolClient.tsx`）から明示的に渡す（RLSの insert ポリシーが `auth.uid() = user_id` のため）。
楽観的更新はしない。書き込み成功後は必ず `invalidateStockNotesCache(userId)` を呼んでキャッシュを
破棄し、`revalidateData`（stale-while-revalidateの再取得関数）で再取得する。分類判定・削除可否・
重複チェックは `app/tools/stock-notes/logic.ts` の純関数（`canDeleteStock` / `deleteBlockedReason` /
`isCodeAlreadyRegistered` / `validateNewStockInput`）としてユニットテストしている。
**`stock_notes_analyses` / `stock_notes_theses` への書き込みは一切行わない**（分析はGPTの領域）。
詳細な経緯は decision-log 参照。

### 次回決算日の表示

各銘柄行に「次回決算 8/14（あと3日）」のように日付と残り日数を表示する。表示は3パターンに区別する（「予定なし」とは書かない）。

| 状態 | 表示 |
|---|---|
| 予定が見つかった | 「次回決算 8/14（あと3日）」 |
| 予定が見つからず、かつ月次データの取得が完全（`complete: true`） | 「次回決算 未判明（カレンダーは9/30まで）」（`windowTo` を具体的な日付として文言に反映する） |
| `/api/stock-notes/earnings` 自体の取得に失敗、または一部の月（`missingMonths`）の取得だけ失敗した（`complete: false`） | 「決算情報を取得できませんでした」（一部失敗の場合は「（一部期間が未取得）」を付す） |

決算カレンダーは約2ヶ月先までしか用意されていないため（`app/tools/earnings-calendar` の manifest `current_window` 参照）、ウィンドウ外は「決算が無い」のではなく「まだ判明していない」ことを表現する。ただし、月次データの取得が一部失敗している状態（`complete: false`）で「未判明」と表示すると、実際には欠落した月にその銘柄の決算が入っていた可能性を隠してしまうため、この場合は「未判明」ではなく「取得できませんでした」側に倒す。理由の詳細は decision-log 参照。

### 前回決算（過ぎてしまった決算）の表示

未分析の保有銘柄・分析済み銘柄の各行に、次回決算に加えて前回決算も表示する。次回決算が未判明の銘柄では前回決算が唯一の決算関連の手がかりになるため、次回の判明状況によって表示の重みを変える。

| 状態 | 表示 |
|---|---|
| 前回決算が判明しており、かつ次回決算も判明している | 「前回決算 8/4（1Q）」（経過日数は付けない。次回情報が主役のため、補助情報として控えめに表示） |
| 前回決算が判明しており、次回決算は未判明 | 「前回決算 8/4（1Q・7日前）」（経過日数を付けて目立たせる。唯一の決算関連の手がかりになるため） |
| 前回決算も判明していない（`lastEarnings` にキーが無い） | 前回決算の行自体を出さない（「不明」と書き足しても情報量が無いのに行が増えるだけのため） |

`lastEarnings` は日付だけでなく決算区分（`announcementType`）・発表状況（`publishStatus`）も持つ（次回決算の `earnings` と同じ形）。経過日数は `app/tools/stock-notes/logic.ts` の `daysSinceEarnings`（純関数、JSTの日付境界で計算）を使う。

`earnings.complete === false`（月次データの一部取得に失敗）の場合、その `lastEarnings` は欠落月にもっと新しい決算があった可能性があり確定情報ではないため、表示に「（一部期間が未取得のため不確実）」を付す（決算またぎ警告自体は抑制しない。理由は decision-log 参照）。

`/api/stock-notes/earnings` のレスポンスには `Cache-Control: public, max-age=300` が付いているため、デプロイ直後は古いキャッシュ済みレスポンス（`lastEarnings` が旧形式=日付文字列のみだった時代のもの）をクライアントが受け取る場合がある。`app/tools/stock-notes/data.ts` の `fetchEarnings` は受信直後に `normalizeLastEarnings` で形式を正規化し（文字列なら `{date, announcementType: "", publishStatus: ""}` に変換、壊れた値は無視）、クラッシュしないようにしている。

決算またぎの警告（鮮度バッジ「要更新（決算後未分析）」）にも前回決算日を入れ、「8/4の決算後、未分析」のように表示する（`FreshnessBadge`、`app/tools/stock-notes/ToolClient.tsx`）。日付が入ることで、利用者が何を確認すべきかが即座に分かる。

### 保有リスト同期の注意表示

`my_stocks_items_v1` は LocalStorage が正本で、`/account` の「この端末を保存」を押したときだけクラウド（`tool_data`）へアップロードされる（自動同期ではない）。このダッシュボードは `/api/sync` 経由でクラウド側の保有リストを読むため、ローカルでの直近の編集が反映されていない場合がある。

同期状態は3種類に区別する。

| 状態 | 条件 | 表示 |
|---|---|---|
| fresh | 同期から30日未満 | 注意表示なし |
| stale | 同期から30日以上 | 「同期が30日以上前です。…」＋`/account`導線 |
| unknown | 同期日時が無い（一度も同期していない）、または不正な値 | 「保有リストの同期日時を確認できません。…」＋`/account`導線（「30日以上前」とは言わない） |

「未分析◯件」等の数字が古い、または確認できない保有リストに基づく可能性があることを伝える。理由の詳細は decision-log 参照。

### キャッシュ（stale-while-revalidate）

このツールは読み取り専用で、分析データ（`stock_notes_*`）は週に数回しか増えないため、開くたびに毎回全件取得する必要はない。`app/tools/stock-notes/cache.ts` が localStorage に TTL 15分のキャッシュを持つ。

- 保存内容: `app/tools/stock-notes/load.ts` の `DashboardData`（銘柄・分析サマリー・見立て・アクション・保有リスト・保有リスト同期日時・決算情報）＋取得時刻（`fetchedAt`）＋スキーマバージョン。会話原文（`body`）は一覧取得に元々含まれないため、キャッシュにも含まれない
- キーにログインユーザーIDを含める（`stock_notes_dashboard_cache_v1_<userId>`）。別アカウントのキャッシュは読めない
- TTL は15分。分析は週に数回しか増えず、`/api/stock-notes/earnings` は既に `Cache-Control: max-age=300`（5分）でキャッシュ済みのため。根拠: `app/tools/stock-notes/cache.ts` の `CACHE_TTL_MS` コメント、decision-log
- スキーマバージョン（`version: 1`）を持つ。過去に `lastEarnings` の形式変更でキャッシュ互換性の問題を起こしたことがあるため、`DashboardData` の形を変えたら version を上げて古いキャッシュを無効化する
- 読み出しは防御的に行う。JSON parse 失敗・version不一致・userId不一致・形の不正（`earnings` の入れ子構造の不正も含む）・TTL超過のいずれでも例外を投げず `null` を返し、通常取得にフォールバックする。書き込み失敗（容量超過・プライベートモード等）も握りつぶす
- `view` / `confidence` / `analysisType` のような enum 相当のフィールドは、キャッシュ層では構造レベルの検証にとどめ、個々の値の妥当性チェックはしない。想定外の値（キャッシュ由来・Supabaseからの直接取得由来の両方でありうる）は描画側（`ToolClient.tsx`）で安全な既定値にフォールバックする（`logic.ts` の `withFallback`）

マウント時（ログイン確認直後）にまずキャッシュを読み、あれば即座に描画してから裏で再取得して差し替える（stale-while-revalidate、`ToolClient.tsx` の `startForUser`）。キャッシュが無ければ従来どおりローディング表示 → 取得（`loadData`）。裏の再取得（自動・手動更新ボタンとも `revalidateData` を使う）が失敗した場合はキャッシュ表示を維持し、「最新の取得に失敗しました（表示はHH:MM時点）」と伝える（キャッシュを消して真っ白にはしない）。ただし裏の再取得が401相当（セッション切れ。`/api/sync` の401、または `stock_notes_*` のSupabase直読みでの `isSessionExpiredSupabaseError`）で失敗した場合は例外で、表示中のデータとローカルキャッシュを破棄してログイン画面へ切り替える（表示中のデータが無効なセッションのものになるため）。既存の取得世代ガード（`createLoadGuard`）は `loadData` / `revalidateData` の両方で使い、古いリクエストの結果で上書きしないようにする。

マウント時に発行する `supabase.auth.getUser()` の結果は、認証状態の世代ガード（`authGuardRef`、`createLoadGuard` を再利用）で保護している。`getUser()` の応答が届く前に `onAuthStateChange`（アカウント切替）が先に発火した場合、遅れて届いた `getUser()` の結果（古いユーザーのuid）は一切 state に反映しない。反映すると、実際のセッションは切り替わっているのに古いuidで取得・キャッシュ保存してしまう（別アカウントのデータ混入）ため。

ログアウト時（`onAuthStateChange` でセッションが null になったタイミング）は、表示中のデータのクリアに加えて、直前のユーザーのローカルキャッシュも `invalidateStockNotesCache(userId)` で削除する。同じ端末を他人が使う場合に前のユーザーの分析内容が残らないようにするため。

将来この画面に銘柄登録・分類変更・アーカイブ等の書き込み機能を追加する場合、書き込み成功後に必ず `invalidateStockNotesCache(userId)` を呼ぶこと。呼び忘れると、TTL内は古いキャッシュがそのまま表示され続け「登録したのに画面に反映されない」不具合になる。詳細は decision-log 参照。

### 入力

- 銘柄の登録（証券コード・銘柄名・分類）、分類変更・アーカイブ（分類・任意の理由）、削除（分析0件の銘柄のみ）、マイ銘柄リストからの一括取り込み（対象確認後に実行）。いずれも `stock_notes_stocks` への書き込みのみ
- 「分析用プロンプトをコピー」はクリップボードへの書き込みのみで、Supabase への保存は行わない

### 出力

- 上記のセクション表示、および `stock_notes_stocks` への書き込み結果（画面の再表示）

## データ仕様

### 取得元

- `stock_notes_stocks` / `stock_notes_analyses` / `stock_notes_theses` / `stock_notes_actions`（Supabase、RLS で本人の行のみ）
  - `stock_notes_analyses` の一覧・タイムライン取得では `body`（会話原文、最大4.5万文字）を select しない。「原文を表示」を押したときだけ `id` 指定で `select("id, body")` を再クエリする
  - `stock_notes_actions` は `status='open'` のみ取得する
  - 4テーブルは個別クエリで取得し、`stock_id` で突き合わせる（SQLのjoinは使わない。理由は [decision-log](../../decision-log/2026-08-11-stock-notes-dashboard-design.md) 参照）
- 保有リスト（`my_stocks_items_v1`）: 既存の `/api/sync`（`tool_data` テーブル経由）から取得する。`my-stocks` の LocalStorage は直接読まない（別端末からの利用を想定するため）
- 次回決算日・前回決算日: `app/api/stock-notes/earnings/route.ts`（サーバールート）が `{market-info-api}/earnings-calendar/domestic/monthly/{YYYY-MM}`（未来側は当月＋翌月＋翌々月分、過去側は当月＋過去3ヶ月分。決算またぎ判定と前回決算表示の両方に使うため、四半期決算の間隔（約3ヶ月）を取りこぼさない範囲にしている）を全て `Promise.all` で並列取得し、銘柄コードごとに畳み込んで返す。クライアントは `app/tools/stock-notes/data.ts` の `fetchEarnings` からこのルートを叩く（Supabase ではなく通常の fetch）。呼び出し側（`app/tools/stock-notes/load.ts`）は stocks・holdings 取得後に確定する対象銘柄コード（保有＋分析済み、通常は数十件）を `?codes=` クエリで渡し、サーバー側でその銘柄だけに絞り込んでもらう（全銘柄を返すと実測1,039銘柄・約140KBになるため）。`codes` が空（=表示する銘柄が無い）場合はこのルートを呼ばない

### 保存先

- `stock_notes_stocks`（Supabase、RLS で本人の行のみ書き込み可）。登録・分類変更・アーカイブ・削除・一括取り込みで書き込む
- `stock_notes_analyses` / `stock_notes_theses` / `stock_notes_actions` への書き込みは行わない（分析はGPTの領域）
- `my_stocks_items_v1`（`tool_data`）への書き込みは行わない（`my-stocks` は無改修）

### fallback

- Supabase 未設定（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 未設定）時は「利用できません」の案内のみ表示する
- 各テーブル取得のいずれかが失敗した場合は、データを一切表示せず「取得に失敗しました」＋再読み込みボタンを表示する（部分表示はしない）
- 保有リスト取得元の `/api/sync` が **401（セッション切れ）** を返した場合、および `stock_notes_*` の Supabase 直読みが**セッション切れ相当のエラー**（PostgRESTの `PGRST301` = JWT expired 等、`app/tools/stock-notes/data.ts` の `isSessionExpiredSupabaseError`）を返した場合は、どちらも同じ「セッション切れ」として扱い、他の取得失敗と区別して「セッションが切れています。ログインし直してください」＋再ログイン導線を表示する（`app/tools/stock-notes/load.ts` の `loadDashboardData`）。`/api/sync` の失敗を空配列へフォールバックすることはしない。フォールバックすると「保有0件」と「取得失敗」の区別がつかず、未分析銘柄が黙って0件表示になってしまうため
- ユーザー切替・ログアウトが短時間に連続しても、古いリクエストの結果で新しい画面を上書きしない（取得世代ガード。`app/tools/stock-notes/logic.ts` の `createLoadGuard`）。ログアウト時は表示中のデータを即座にクリアする
- 次回決算日（`/api/stock-notes/earnings`）の取得失敗は、他の4テーブル・保有リストの取得失敗とは別扱いにする。ダッシュボード本体（保有だが未分析、等）は決算日が無くても表示できるため、`app/tools/stock-notes/load.ts` の `loadDashboardData` はこの失敗だけを個別に catch し、`earnings: null` としてページ自体は正常表示する。決算日の表示箇所だけ「決算情報を取得できませんでした」になる（部分表示するのはこのケースのみ）
- `/api/stock-notes/earnings` は、当月分の月次JSON取得に失敗した場合はエラーレスポンス（502）を返す。当月以外（前月・翌月・翌々月）の月次JSON取得だけが一部失敗した場合は200のまま返すが、レスポンスに `complete: false` と `missingMonths`（取得できなかった月の一覧）を含める。呼び出し側はこれを見て、欠落した月にその銘柄の決算が入っていた可能性を「未判明」と誤解させないよう「取得できませんでした」寄りの表示にする
- 銘柄マスター（`/api/stock-notes/stock-master`）の取得に失敗した場合、登録フォームの名称自動補完ができないだけで、名称欄を手入力すれば登録は続けられる（画面全体をエラーにしない）
- 書き込み（登録・分類変更・アーカイブ・削除・一括取り込み）が失敗した場合は、画面をエラー表示に倒さず、フォーム内または `window.alert` でエラーメッセージを表示する（表示中の一覧データは維持する）。重複コードの登録は事前チェック（`isCodeAlreadyRegistered`）に加え、それをすり抜けた場合の DB エラー（`unique(user_id, code)` 違反、`isDuplicateStockError` で判定）も専用のメッセージで案内する
- 分析が1件でもある銘柄の削除は、サーバーへのリクエスト自体を送らずクライアント側で防ぐ（削除ボタンを無効化）。`on delete cascade` によって分析・見立て・アクションが連鎖削除されることを避けるための安全策

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| Supabase 未設定 | 「このツールは現在この環境では利用できません」 |
| 認証確認中 | 「読み込み中…」 |
| 未ログイン | 「ログインしてください」＋ `/account` へのログイン導線 |
| データ取得中 | 「データを取得中…」 |
| データ取得失敗（`/api/sync` の401以外） | 「データの取得に失敗しました」＋再読み込みボタン |
| セッション切れ（`/api/sync` が401） | 「セッションが切れています。ログインし直してください」＋再ログイン導線（`/account`）。一般的な取得失敗とは別の状態として区別する |
| 保有銘柄（tab='holding'）が0件 | 「保有銘柄が登録されていません。マイ銘柄リストで保有銘柄を登録すると…」（ウォッチのみ登録がある場合もこの文言。`holdings.length` ではなく `tab='holding'` の件数で判定する） |
| 未分析の保有銘柄が0件 | 「保有銘柄はすべて分析済みです」 |
| 分類タブに該当銘柄が0件 | 「この分類の銘柄はまだありません」 |
| アクション受信箱が0件 | 「未消化のアクションはありません」 |

## 鮮度バッジの基準

最終分析日より後に決算があったかどうか（決算またぎ）を優先し、経過日数（90日/180日）は補助として使う（`app/tools/stock-notes/logic.ts` の `freshnessLevelWithEarnings`）。

| 条件 | レベル | 表示 |
|---|---|---|
| 最終分析日より後に決算発表があった（`lastEarnings[code].date` が最終分析日より新しい） | post-earnings | 「8/4の決算後、未分析」のように決算日を入れる（red）。`lastEarnings[code]` が無い等で日付が組み立てられない場合のみ「要更新（決算後未分析）」にフォールバックする |
| 上記に該当せず、経過日数が90日以内 | fresh | バッジなし |
| 上記に該当せず、経過日数が90日超180日以内 | warn | 「そろそろ確認」（amber） |
| 上記に該当せず、経過日数が180日超 | danger | 「要更新」（red） |
| 分析が0件 | unknown | バッジなし（未分析銘柄セクション側で扱う） |

決算日が判明していない銘柄（`lastEarnings` にキーが無い）は、決算またぎ判定をスキップし従来どおり経過日数のみで判定する。経過日数のみの判定関数 `freshnessLevel` は後方互換のため残している。

根拠: stock-notes の分析頻度は決算・ニュース起点の不定期更新のため、四半期決算1回分（≒90日）と半年・決算2回分（≒180日）を目安にした。決算またぎを優先する理由は、経過日数だけでは「直近で決算をまたいだのに未分析」という本来の警告を表現できないため。詳細は [decision-log](../../decision-log/2026-08-11-stock-notes-dashboard-design.md) を参照。

## premium / 権限制御

- premium ではなく、mini-tools の通常ログイン（Supabase Auth）が必須
- 未ログイン時はエラー画面にせず、`/account` のログイン導線を案内する（既存のクラウド同期ツールと同じ扱い）
- ログイン済みユーザー本人の行だけが Supabase の RLS（`auth.uid() = user_id`）で見える・書き込める
- この画面から `stock_notes_stocks` への INSERT/UPDATE/DELETE ができる（登録・分類変更・アーカイブ・削除）。`stock_notes_analyses` / `stock_notes_theses` / `stock_notes_actions` への書き込みは一切行わない（読み取り専用のまま）
- 検索エンジンには掲載しない（`noindex, nofollow`）

## 関連実装

- [app/tools/stock-notes/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/page.tsx)
- [app/tools/stock-notes/ClientOnly.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/ClientOnly.tsx)
- [app/tools/stock-notes/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/ToolClient.tsx)
- [app/tools/stock-notes/cache.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/cache.ts)
- [app/tools/stock-notes/data.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/data.ts)
- [app/tools/stock-notes/load.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/load.ts)
- [app/tools/stock-notes/logic.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/logic.ts)
- [app/tools/stock-notes/earnings-logic.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/earnings-logic.ts)
- [app/tools/stock-notes/earnings-types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/earnings-types.ts)
- [app/tools/stock-notes/types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/types.ts)
- [app/tools/stock-notes/useStockNotesStockMaster.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/useStockNotesStockMaster.ts)
- [app/api/stock-notes/earnings/route.ts](/c:/Users/yutaz/dev/mini-tools/app/api/stock-notes/earnings/route.ts)
- [app/api/stock-notes/stock-master/route.ts](/c:/Users/yutaz/dev/mini-tools/app/api/stock-notes/stock-master/route.ts)

## 関連 docs

- UAT: [銘柄分析ダッシュボード UAT](../../uat/stock-notes.md)
- Decision Log: [2026-08-11 銘柄分析ダッシュボード（stock-notes連携）の設計判断](../../decision-log/2026-08-11-stock-notes-dashboard-design.md)
