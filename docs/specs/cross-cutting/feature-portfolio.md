# mini-tools 機能ポートフォリオ台帳

最終確認: 2026-09-13

対象: `app/` の主要画面、`lib/tools-catalog.ts`、現在の導線、Tool Spec、Decision Log で確認できる機能

## 結論

機能の所属は、URLの置き場所ではなく「誰のどの仕事を完了させるか」と認証境界で次の3つに分ける。

| 所属 | 定義 | 現行の入口 |
|---|---|---|
| 通常 | 単独で日常の入力・検索・市場確認を完了できる公開機能。Supabaseログインを任意または機能固有で要求しても、Premium Cookieを要求しないものを含む | 通常ホーム、共通ドロワー、モバイル下部ナビ |
| Premium投資 | 保有・投資判断・高度な市場/企業分析を横断する本人向け機能。原則Premium Cookieでゲートする | Premiumホーム「投資分析」、Premium下部ナビ |
| Workspace | 個人開発Product、Repository、運用、更新状態を管理・俯瞰する本人向け機能。投資判断の成果物とは分離する | Premiumホーム「Workspace」 |

`/tools/yutai-dashboard` はURLが通常ツール配下でもPremium Cookie必須なので「Premium投資」とする。一方、`/tools/stock-notes` はSupabase本人認証を要求するが、通常ホームから使う銘柄単位の分析確認であり、現時点では「通常」に置く。

## 判定語

- **実装済み**: 現行コードに画面・主要データ経路があり、仕様またはテストで意図を確認できる。利用実績や本番稼働の確認済みを意味しない。
- **静的のみ**: 画面は実装済みだが、表示元がrepo内の固定定義で、ライブ状態や実行実績ではない。
- **合成表示あり**: ライブデータがない場合に、実データではない固定の例示値を描画する経路がある。実装済み・本番到達済みの根拠にはしない。
- **要確認**: コードや仕様だけでは本番データ到達、利用状況、正本との同期、完成条件を確認できない。
- **方針候補**: `維持` / `改善` / `統合候補` / `分割候補` / `廃止候補` / `判断保留`。この台帳だけで廃止を決定しない。
- **優先度**: P0=境界や誤認を先に解消、P1=主要導線を次に整理、P2=維持しつつ改善判断、P3=利用実績を確認して判断。

## 全機能台帳

保存先の「なし」はユーザー固有データを保存しない意味であり、API側の生成・キャッシュまで否定しない。

| 機能（URL） | 利用目的 → 得る結果 | データ取得・保存先 | 認証 | モバイル | 所属 | 状態 | 方針候補 | 理由 | 優先度 |
|---|---|---|---|---|---|---|---|---|---|
| ホーム / 通知 (`/`) | 機能を選ぶ、期限・開示・決算・経済指標の要点を知る → 次に開く画面が決まる | カタログ、各通知API、端末内の優待・マイ銘柄・既読。配置はLocalStorage | 不要。Premium時のみ外部TODO表示 | 適 | 通常 | 実装済み・本番到達は要確認 | 改善 | 複数機能の要約ハブで、個別機能を置換しない | P1 |
| マイ銘柄リスト (`/tools/my-stocks`) | 保有/ウォッチを登録 → 決算・優待月・構成を一覧化 | 株マスタAPI、LocalStorage。バックアップ/任意同期対象 | 不要、同期時Supabase | 適 | 通常 | 実装済み・利用状況要確認 | 改善 | 通知・銘柄分析・将来Portfolio連携の端末側入口 | P0 |
| 銘柄分析ダッシュボード (`/tools/stock-notes`) | GPTで保存した銘柄分析を確認・追跡対象を管理 → 未分析/要対応が分かる | Supabase `stock_notes_*`、保有取得、LocalStorageキャッシュ | Supabase必須 | 適 | 通常 | 実装済み・実データUAT要確認 | 改善・統合候補 | マイ銘柄とは追跡正本、Portfolioとは個別分析/全体判断で責務が異なる | P0 |
| 保有銘柄分析 (`/premium/portfolio`) | 保存済み方針・保有・履歴を横断確認 → 次の投資判断が分かる | Supabase portfolio系。MiniToolsからは原則読取のみ | Premium + Supabase | 適（UAT未確認部分あり） | Premium投資 | 実装済みだが完成条件未達・要確認 | 改善・統合候補 | 単なる保有表ではなく意思決定Workspace。銘柄分析との双方向連携が未完成 | P0 |
| 株主優待期限帳 (`/tools/yutai-expiry`) | 受領優待の残高・期限・利用履歴を管理 → 失効を防ぐ | LocalStorage + Supabase優待DB表示/復元、Premium時scan | 基本不要。DB/scanは各認証条件 | 適（専用mobile layout） | 通常 | 実装済み・切替後運用要確認 | 維持・統合候補 | 取得前ではなく受領後の消費管理。ホーム期限通知の正本 | P0 |
| 優待銘柄メモ帳 (`/tools/yutai-memo`) | 銘柄別の早取り・長期・失敗等を記録 → 次回準備に再利用 | LocalStorage + 任意Supabase同期/DB表示 | 基本不要、同期時Supabase | 適 | 通常 | 実装済み・DB切替後運用要確認 | 維持・統合候補 | 銘柄知識と準備履歴を扱い、候補検索・取得管理とは別責務 | P0 |
| 優待カレンダー (`/tools/yutai-candidates`) | 月別候補を探索 → ピック/パスしメモへ送る | market API、非本番fallback、選択/メモはLocalStorage、DB連携あり | 不要（連携先でSupabase可） | 適 | 通常 | 実装済み・本番データ要確認 | 維持・統合候補 | 優待の発見入口。Dashboardと重複する操作範囲は整理対象 | P0 |
| 優待ダッシュボード (`/tools/yutai-dashboard`) | 候補・証券在庫・仕込み・取得・効率をPC表で横断 → 月次判断をまとめる | market API、優待DB、LocalStorage選択、private株価/公式条件route | Premium必須 + 一部Supabase | PC向け、限定的 | Premium投資 | 実装済み・実データUAT要確認 | 改善・統合候補・分割候補 | 4機能の横断面だが、入力正本を重複させない整理が必要 | P0 |
| データ引っ越し (`/tools/data-transfer`) | 端末データを退避/復元 → 端末移行・DB全件照合ができる | JSONファイル、LocalStorage、認証時Supabase | ローカルは不要、DBはSupabase | 適 | 通常 | 実装済み・復元運用要確認 | 維持 | データ保全の独立境界。安易な統合/廃止対象にしない | P0 |
| アカウント・同期 (`/account`) | ログイン・任意同期 → 対応データを端末間で共有 | Supabase Auth / `tool_data` | Supabase | 適 | 通常 | 実装済み・利用状況要確認 | 維持・改善 | 通常機能共通の補助導線で、Premium認証とは別物 | P1 |
| 決算カレンダー (`/tools/earnings-calendar`) | 国内外の予定を日付/銘柄で探索 → 詳細な予定を確認 | market API、国内は非本番fallback | 不要 | 適 | 通常 | 実装済み・本番データ要確認 | 維持 | 探索・検索の正画面。ホーム通知は今日/明日の要約 | P1 |
| 経済指標カレンダー (`/tools/econ-calendar`) | 今週の重要指標を比較 → 発表時刻・予想・結果を確認 | market API | 不要 | 適 | 通常 | 実装済み・本番データ要確認 | 維持 | ホーム通知の詳細遷移先 | P2 |
| TDNET適時開示一覧 (`/tools/tdnet-disclosures`) | 全開示を日付・語句・種別で探索 → 原文リンクへ到達 | TDNET API。ユーザー保存なし | 不要 | 可（表主体） | 通常 | 実装済み・本番データ要確認 | 維持 | 網羅検索の正画面。重要イベント抽出とは別責務 | P1 |
| 開示イベントレーダー (`/tools/disclosure-radar`) | 優待変更とマイ銘柄重要開示を優先確認 → 見落としを減らす | 正規化イベントAPI、マイ銘柄/既読はLocalStorage | 不要 | 適（下部ナビ） | 通常 | 実装済み・分類精度/利用状況要確認 | 維持・統合候補 | TDNETの派生通知面。原文網羅ではなく優先順位付け | P1 |
| TOPIX33業種 (`/tools/topix33`) | 日次の33業種騰落を見る → 当日の上昇/下落主導を把握 | market API、非本番fallback | 不要 | 適 | 通常 | 実装済み・本番データ要確認 | 維持 | Premium業種モメンタムとは時間軸と分析深度が異なる | P1 |
| 業種モメンタム (`/premium/market`) | 月内推移・継続性を見る → 業種トレンドを比較 | TOPIX33 API系列。取得不可時は固定の例示値を描画。ユーザー保存なし | Premium必須 | 適 | Premium投資 | 実装済み・合成表示あり・本番データ要確認 | 改善・統合候補 | 通常TOPIX33からの分析深化。実データと例示値の誤認防止、名称と導線の差を明示する | P0 |
| 株価ランキング (`/tools/stock-ranking`) | 国内市場の日次上昇/下落/売買高を見る → 動いた銘柄を発見 | market API、非本番fallback | 不要 | 適 | 通常 | 実装済み・本番データ要確認 | 維持 | 汎用の日次探索 | P2 |
| 米国株ランキング (`/tools/us-stock-ranking`) | 米国株の日次ランキングを見る → 動いた銘柄を発見 | market API、fallbackなし | 不要 | 適 | 通常 | 実装済み・本番データ要確認 | 維持 | 国内版と市場/データ契約が異なる | P2 |
| 市場ランキング (`/tools/market-rankings`) | 国内市場別の時価総額/利回りを見る → 月次比較 | market API、fallbackなし | 不要 | 適 | 通常 | 実装済み・本番データ要確認 | 維持 | 株価ランキングとは指標と頻度が異なる | P2 |
| 日経225寄与度 (`/tools/nikkei-contribution`) | 指数寄与を日次で見る → 日経平均の変動要因を把握 | market API、非本番fallback | 不要 | 適 | 通常 | 実装済み・本番データ要確認 | 維持 | 指数要因分析として独立 | P2 |
| 投資主体別売買動向 (`/tools/investor-flow`) | 週次需給を主体別に見る → 海外/個人等の売買傾向を把握 | market API、fallbackなし | 不要 | 適 | 通常 | 実装済み・分析API要確認 | 維持 | 価格系とは異なる週次需給 | P2 |
| EDINET書類一覧 (`/tools/edinet-documents`) | 法定開示を検索 → 有報/大量保有報告等へ到達 | market API | 不要 | 可（一覧主体） | 通常 | 実装済み・仕様書/本番データ要確認 | 判断保留 | 導線はあるが独立Tool Specと利用状況の根拠が不足 | P2 |
| 合計計算 (`/tools/total`) | 数値列を合計 → 即時に合計値を得る | LocalStorage | 不要 | 適 | 通常 | 実装済み・利用状況要確認 | 維持 | 小さく自己完結し保守負担が低い | P3 |
| 文字数カウント (`/tools/charcount`) | 投稿文の長さを確認 → 文字数/残数を得る | LocalStorage | 不要 | 適 | 通常 | 実装済み・利用状況要確認 | 維持 | 小さく自己完結し保守負担が低い | P3 |
| ペンギン・エイリアンシューター (`/tools/penguin-rabbit-shooter`) | 軽いゲーム → 娯楽体験 | クライアント状態 | 不要 | 適 | 通常 | 実装済み・利用状況要確認 | 判断保留・統合候補 | 新旧ゲームの重複価値を利用実績なしで判断できない | P3 |
| ペンギンシューター (`/tools/penguin-shooter`) | ステージ制ゲーム → 娯楽体験 | クライアント状態、消音のみLocalStorage | 不要 | 適 | 通常 | 実装済み・利用状況要確認 | 判断保留・統合候補 | 旧作との棲み分け確認が先 | P3 |
| Premiumホーム/ログイン (`/premium`, `/premium/login`) | 本人向け分析/管理を選ぶ → 投資とWorkspaceの入口を得る | Premium Cookie | Premium簡易認証 | 適 | Premium投資/Workspace共通 | 実装済み・会員/課金は未実装 | 改善 | 二領域を分けて提示するランチャー | P1 |
| テーマViewer (`/premium/themes`) | 投資テーマの根拠・履歴を見る → テーマ仮説を確認 | Supabase `stock_notes_*` | Premium + Supabase | 適 | Premium投資 | 実装済み・実データ要確認 | 維持・改善 | 投資テーマの読み取り面 | P2 |
| 業界マップ (`/premium/industry-map`) | 産業構造と企業経済圏を見る → 関係を複数表現で探索 | Supabase stock-notes関係データ | Premium + Supabase | 可（pan/zoom対応） | Premium投資 | 実装済み・実データUAT要確認 | 維持・統合候補 | 企業関係系3画面の入口整理余地あり | P2 |
| 企業関係マップ (`/premium/company-network`) | 企業グループ/出資関係を見る → 個社周辺の構造を理解 | Supabase stock-notes関係データ/RPC | Premium + Supabase | 可 | Premium投資 | 実装済み・実データUAT要確認 | 維持・統合候補 | 業界マップと表示軸は異なるがデータ領域が近い | P2 |
| テーマ×企業関係 (`/premium/theme-company-network`) | テーマと企業関係を横断 → テーマ内の企業配置を理解 | Supabase stock-notesテーマ/企業関係 | Premium + Supabase | 可 | Premium投資 | 実装済み・実データUAT要確認 | 統合候補・判断保留 | 独立入口が必要か、テーマViewer内のビューかを要判断 | P2 |
| Workspace Dashboard (`/premium/product-map/dashboard`) | Product状態を俯瞰 → 対応優先度を判断 | Workspace Core API/Supabase read model | Premium必須 | 適 | Workspace | 実装済み・ライブ鮮度要確認 | 維持・改善 | Product Mapの意思決定サマリー | P1 |
| Product Map (`/premium/product-map`) | Product/Repository/Provider関係を探索 → 依存関係を確認 | Workspace Core API/Supabase read model | Premium必須 | 適 | Workspace | 実装済み・ライブ鮮度要確認 | 維持 | Dashboardの詳細探索面 | P1 |
| ルーティン一覧 (`/premium/routines`) | 定期作業量を棚卸し → 減らす/まとめる判断材料を得る | repo内 `routines.ts`。保存なし | Premium必須 | 閲覧可、表は横スクロール | Workspace | 静的のみ・現状同期要確認 | 改善・判断保留 | 実行実績ではなく棚卸し時点の設定。鮮度誤認を避ける | P1 |
| 管理コンソール (`/admin`) | データ更新/SLAを監視 → 運用異常候補を把握 | 各manifest/APIと静的スケジュール定義 | Premium必須 | 可（情報量多） | Workspace | 実装済み・監視網羅性要確認 | 改善 | 利用者向け機能ではなく運用面 | P1 |
| 外部TODO (`https://todo-app-ten-rose-62.vercel.app/`) | 別アプリのタスクを開く → TODOを管理 | 別アプリ、mini-toolsとは別管理 | Premium時のみ入口表示、外部側は別認証 | 外部依存 | Workspace | 外部導線のみ・利用状況要確認 | 判断保留 | mini-tools機能ではなくリンク。所属/必要性は利用実績確認後 | P3 |

## 明確化した境界

### マイ銘柄 / 銘柄分析 / 保有銘柄分析

- **マイ銘柄**: 端末内の軽量な「保有・ウォッチ」リスト。通知照合にも使う。
- **銘柄分析**: 銘柄単位の分析・見立て・追跡対象の正本を読む/管理する。
- **保有銘柄分析**: 全資産・方針・review・actionを横断する意思決定面。銘柄分析の強弱とPortfolio上の追加優先度を混同しない。
- 推奨: 3機能を今すぐ統合せず、相互deep linkと正本表示をP0で設計する。

### 優待4機能

- **優待カレンダー**=発見、**優待メモ**=銘柄知識/準備、**優待ダッシュボード**=横断判断、**優待期限帳**=受領後の消費管理。
- 推奨: 4画面は維持し、同じピック/メモ/取得データを重複保存しないよう正本と遷移を明示する。DashboardはPC横断面、各通常画面はモバイルで単一作業を終える面とする。

### 通常TOPIX33 / Premium業種モメンタム

- 通常は**指定日の日次スナップショット**、Premiumは**月内の推移・継続性分析**。
- 推奨: データ契約は共用し、通常画面から「期間で見る」導線を置く。名称は「TOPIX33（日次）」と「業種モメンタム（月内）」相当まで具体化する。

### 決算カレンダー / ホーム通知

- カレンダーは検索・日付移動・国内外の詳細確認、ホームは今日/明日と本人関連の要約。
- 推奨: 通知カードは独自の正本にせず、同じAPI結果を要約してカレンダーへdeep linkする。

### TDNET一覧 / 開示イベントレーダー

- TDNET一覧は**全件の探索と原文到達**、レーダーは**正規化・分類した優先確認と既読管理**。
- 推奨: 両方維持し、レーダーから対応するTDNET/公開元へ遷移できる関係を強める。分類不能を「重要でない」と扱わない。

## このPRで決めないこと

- 利用状況を示す分析結果は取得していない。したがって利用数を根拠にした廃止候補は付けない。
- 本番API、Supabase、Workspace Coreのライブデータ到達は実行していない。「実装済み」はコード/仕様上の状態に限る。固定の例示値を表示する業種モメンタムもライブ到達の証拠にしない。
- 所属変更、導線変更、データ移行、機能廃止は行わない。

## 次の判断ポイント

1. **マイ銘柄の正本**: A. LocalStorageを維持（推奨、通知のプライバシーと軽さを維持） / B. `stock_notes_stocks`へ統合 / C. ログイン時だけ明示同期。
2. **優待Dashboardの役割**: A. PC用横断ビューに限定（推奨） / B. 4機能を単一画面へ統合 / C. 月次判断と実績管理に分割。
3. **企業関係3画面の入口**: A. 独立画面を保ち共通ランチャー化（推奨） / B. 業界マップへ統合 / C. テーマViewer配下へ再編。
4. **静的ルーティン一覧**: A. 棚卸し日を強調して維持（推奨） / B. 実行ログ連携へ改善 / C. Workspace Dashboardへ統合。
5. **外部TODOリンク**: A. Workspaceに明示して維持 / B. 利用状況確認まで保留（推奨） / C. mini-tools導線から除外。

## 主な根拠

- 実装: `lib/tools-catalog.ts`, `app/page.tsx`, `app/HomeNotifications.tsx`, `app/premium/page.tsx`, `app/tools/**`, `app/premium/**`, `app/admin/page.tsx`
- 現在仕様: `docs/product-spec.md`, `docs/specs/tools/**`, `docs/specs/cross-cutting/market-tools-data-fetch-paths.md`
- 判断履歴: `docs/decision-log/**`
- Portfolio完成条件: `docs/plans/portfolio-decision-workspace-plan.md`, `docs/specs/tools/portfolio.md`
