# 銘柄分析ダッシュボード 仕様

## 概要

- URL: `/tools/stock-notes`
- 分類: yutai（優待・保有）/ Supabase 直読み・読み取り専用
- 主な用途: 別リポジトリ [stock-notes](https://github.com/Yuichi-TanakaJP/stock-notes)（カスタムGPTから記録する銘柄分析ツール）が Supabase に書き込んだ分析・見立て・アクションを俯瞰する。特に「保有しているのに分析記録が無い銘柄」をトップに出し、チャットでは表面化しない抜け漏れを可視化する

## 対象ユーザー

- stock-notes のカスタムGPTで銘柄分析を記録している本人（1名想定）
- 外出先など別端末から、これまでの分析状況・見立て・未消化アクションを確認したいとき

## 画面仕様

### 主な画面要素

0. **保有リストの同期状態**（画面上部）: `/api/sync` の `my_stocks_items_v1` の最終同期日時（`updated_at`）を「保有リストの同期: 2026-06-21（52日前）」のように表示する。30日以上前の場合は注意表示＋`/account`（「この端末を保存」）への導線を出す。詳細は「保有リスト同期の注意表示」節を参照
1. **未分析の保有銘柄**（最上段）: `my-stocks` の保有銘柄のうち、stock-notes 側に銘柄登録が無い、または分析が0件の銘柄。**決算が近い順**（決算日判明分を日付昇順、未判明は後ろにコード順）に並べる。コード・銘柄名・保有数量（あれば）・次回決算日の表示（下記）と「分析用プロンプトをコピー」ボタン。決算が3日以内の銘柄は強調表示する
2. **分析済み銘柄の一覧**: 分類タブ（保有 / ウォッチ / 新規調査 / アーカイブ）。行にコード・銘柄名・現在の見立て（強気/中立/弱気の色分け＋確信度）・最終分析日・鮮度バッジ・分析件数・未消化アクション数・次回決算日の表示（下記）。行をタップすると詳細を展開（アコーディオン）
3. **アクション受信箱**: 未消化（`status='open'`）のアクションを期限昇順で表示。期限切れは強調表示
4. **銘柄詳細**（一覧行の展開）: 現在の見立て（仮説・リスク・次回確認点・買い増し/撤退条件・as_of 日付）＋分析タイムライン（新しい順に結論・根拠・懸念・出典リンク）。会話原文（`body`）は「原文を表示」を押したときだけ個別取得する

### 次回決算日の表示

各銘柄行に「次回決算 8/14（あと3日）」のように日付と残り日数を表示する。表示は3パターンに区別する（「予定なし」とは書かない）。

| 状態 | 表示 |
|---|---|
| カレンダーのウィンドウ内に予定あり | 「次回決算 8/14（あと3日）」 |
| ウィンドウ内に予定が無い（未判明） | 「次回決算 未判明（カレンダーは約2ヶ月先まで）」 |
| `/api/stock-notes/earnings` 自体の取得に失敗 | 「決算情報を取得できませんでした」 |

決算カレンダーは約2ヶ月先までしか用意されていないため（`app/tools/earnings-calendar` の manifest `current_window` 参照）、ウィンドウ外は「決算が無い」のではなく「まだ判明していない」ことを表現する。理由の詳細は decision-log 参照。

### 保有リスト同期の注意表示

`my_stocks_items_v1` は LocalStorage が正本で、`/account` の「この端末を保存」を押したときだけクラウド（`tool_data`）へアップロードされる（自動同期ではない）。このダッシュボードは `/api/sync` 経由でクラウド側の保有リストを読むため、ローカルでの直近の編集が反映されていない場合がある。30日以上同期していない場合は注意表示を出し、「未分析◯件」等の数字が古い保有リストに基づく可能性があることを伝える。理由の詳細は decision-log 参照。

### 入力

- なし（読み取り専用）。「分析用プロンプトをコピー」はクリップボードへの書き込みのみで、Supabase への保存は行わない

### 出力

- 上記4セクションの表示のみ

## データ仕様

### 取得元

- `stock_notes_stocks` / `stock_notes_analyses` / `stock_notes_theses` / `stock_notes_actions`（Supabase、RLS で本人の行のみ）
  - `stock_notes_analyses` の一覧・タイムライン取得では `body`（会話原文、最大4.5万文字）を select しない。「原文を表示」を押したときだけ `id` 指定で `select("id, body")` を再クエリする
  - `stock_notes_actions` は `status='open'` のみ取得する
  - 4テーブルは個別クエリで取得し、`stock_id` で突き合わせる（SQLのjoinは使わない。理由は [decision-log](../../decision-log/2026-08-11-stock-notes-dashboard-design.md) 参照）
- 保有リスト（`my_stocks_items_v1`）: 既存の `/api/sync`（`tool_data` テーブル経由）から取得する。`my-stocks` の LocalStorage は直接読まない
- 次回決算日: `app/api/stock-notes/earnings/route.ts`（サーバールート）が `{market-info-api}/earnings-calendar/domestic/monthly/{YYYY-MM}`（当月＋翌月＋翌々月分。決算またぎ判定用に前月分も）を取得し、銘柄コードごとに畳み込んで返す。クライアントは `app/tools/stock-notes/data.ts` の `fetchEarnings` からこのルートを叩く（Supabase ではなく通常の fetch）（別端末からの利用を想定するため）

### 保存先

- なし（このツールは書き込みを行わない）

### fallback

- Supabase 未設定（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 未設定）時は「利用できません」の案内のみ表示する
- 各テーブル取得のいずれかが失敗した場合は、データを一切表示せず「取得に失敗しました」＋再読み込みボタンを表示する（部分表示はしない）
- 保有リスト取得元の `/api/sync` が **401（セッション切れ）** を返した場合は、他の取得失敗と区別し「セッションが切れています。ログインし直してください」＋再ログイン導線を表示する（`app/tools/stock-notes/load.ts` の `loadDashboardData`）。`/api/sync` の失敗を空配列へフォールバックすることはしない。フォールバックすると「保有0件」と「取得失敗」の区別がつかず、未分析銘柄が黙って0件表示になってしまうため
- ユーザー切替・ログアウトが短時間に連続しても、古いリクエストの結果で新しい画面を上書きしない（取得世代ガード。`app/tools/stock-notes/logic.ts` の `createLoadGuard`）。ログアウト時は表示中のデータを即座にクリアする
- 次回決算日（`/api/stock-notes/earnings`）の取得失敗は、他の4テーブル・保有リストの取得失敗とは別扱いにする。ダッシュボード本体（保有だが未分析、等）は決算日が無くても表示できるため、`app/tools/stock-notes/load.ts` の `loadDashboardData` はこの失敗だけを個別に catch し、`earnings: null` としてページ自体は正常表示する。決算日の表示箇所だけ「決算情報を取得できませんでした」になる（部分表示するのはこのケースのみ）

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
| 最終分析日より後に決算発表があった（`lastEarnings[code]` が最終分析日より新しい） | post-earnings | 「要更新（決算後未分析）」（red） |
| 上記に該当せず、経過日数が90日以内 | fresh | バッジなし |
| 上記に該当せず、経過日数が90日超180日以内 | warn | 「そろそろ確認」（amber） |
| 上記に該当せず、経過日数が180日超 | danger | 「要更新」（red） |
| 分析が0件 | unknown | バッジなし（未分析銘柄セクション側で扱う） |

決算日が判明していない銘柄（`lastEarnings` にキーが無い）は、決算またぎ判定をスキップし従来どおり経過日数のみで判定する。経過日数のみの判定関数 `freshnessLevel` は後方互換のため残している。

根拠: stock-notes の分析頻度は決算・ニュース起点の不定期更新のため、四半期決算1回分（≒90日）と半年・決算2回分（≒180日）を目安にした。決算またぎを優先する理由は、経過日数だけでは「直近で決算をまたいだのに未分析」という本来の警告を表現できないため。詳細は [decision-log](../../decision-log/2026-08-11-stock-notes-dashboard-design.md) を参照。

## premium / 権限制御

- premium ではなく、mini-tools の通常ログイン（Supabase Auth）が必須
- 未ログイン時はエラー画面にせず、`/account` のログイン導線を案内する（既存のクラウド同期ツールと同じ扱い）
- ログイン済みユーザー本人の行だけが Supabase の RLS（`auth.uid() = user_id`）で見える
- **読み取り専用**。この画面から `stock_notes_*` テーブルへの INSERT/UPDATE/DELETE は一切行わない
- 検索エンジンには掲載しない（`noindex, nofollow`）

## 関連実装

- [app/tools/stock-notes/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/page.tsx)
- [app/tools/stock-notes/ClientOnly.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/ClientOnly.tsx)
- [app/tools/stock-notes/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/ToolClient.tsx)
- [app/tools/stock-notes/data.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/data.ts)
- [app/tools/stock-notes/load.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/load.ts)
- [app/tools/stock-notes/logic.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/logic.ts)
- [app/tools/stock-notes/earnings-logic.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/earnings-logic.ts)
- [app/tools/stock-notes/earnings-types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/earnings-types.ts)
- [app/tools/stock-notes/types.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/stock-notes/types.ts)
- [app/api/stock-notes/earnings/route.ts](/c:/Users/yutaz/dev/mini-tools/app/api/stock-notes/earnings/route.ts)

## 関連 docs

- UAT: [銘柄分析ダッシュボード UAT](../../uat/stock-notes.md)
- Decision Log: [2026-08-11 銘柄分析ダッシュボード（stock-notes連携）の設計判断](../../decision-log/2026-08-11-stock-notes-dashboard-design.md)
