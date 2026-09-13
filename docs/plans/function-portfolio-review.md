# mini-tools 機能ポートフォリオ台帳

最終確認: 2026-09-14

## 結論と所属定義

利用状況を示す計測データがないため、機能を推測で廃止しない。機能はURLではなく、主目的・得られる結果・保存責務・認証境界で分類する。

- **通常**: 認証なしでも使える日常ツール、または任意ログインで通常ツールのデータを同期する機能
- **Premium投資**: Premium認証下で個人の投資判断・資産・投資テーマを扱う機能。URLが `/tools` でも目的が該当すれば含む
- **Workspace**: 開発Product、Repository、運用、データ更新状態を管理する機能。投資判断の画面には混ぜない

この分類は情報設計上の所属であり、URL移動や課金変更を直ちに意味しない。

## 表記

- **実装済み**: routeと主要UIまたはデータ取得処理をコードで確認した。本番正常性・利用頻度は示さない
- **静的のみ**: 実装はあるが、結果の正本が同梱データ・静的台帳でありライブ更新を確認していない
- **要確認**: routeだけでは運用・利用実態・データ鮮度を確定できない。廃止判断には使わない
- 優先度 `P0` は中心導線、`P1` は隣接判断、`P2` は補助・単機能、`P3` は娯楽または外部リンク。開発着手順ではない

## 全機能台帳

### 通常

| 機能 / URL | 目的・得られる結果 | 保存先・主データ | 認証 | モバイル | 実装状態 | 判定・理由 | 優先度 | 未確認事項 |
|---|---|---|---|---|---|---|---|---|
| マイ銘柄 `/tools/my-stocks` | 保有メモ・ウォッチ、取得額比率、決算/優待バッジ | localStorage正本、任意同期はSupabase `tool_data` | 不要、同期のみ任意 | 高 | 実装済み | 維持。正確な資産管理でなく軽量入口 | P0 | 利用頻度、同期利用率 |
| 優待期限帳 `/tools/yutai-expiry` | 受領優待の残高・期限・消費、ホーム通知 | localStorage / Supabase優待DB（移行中） | 基本不要、DB/scanは条件あり | 高 | 実装済み | 維持。受領後の使い忘れ防止 | P0 | DB移行完了条件、scan実運用 |
| 優待メモ帳 `/tools/yutai-memo` | 取得前の仕込み・注意、取得/失敗履歴 | localStorage / Supabase優待DB（移行中） | 基本不要、同期/一部取得は条件あり | 高 | 実装済み | 維持。期限帳とは取得前/後で別責務 | P0 | DB正本への切替完了条件 |
| 銘柄分析 `/tools/stock-notes` | GPT分析の抜け・鮮度・見立て・action | Supabase `stock_notes_*`、端末キャッシュ | Supabase必須 | 高 | 実装済み | 維持。個別判断であり資産配分とは別 | P0 | 利用件数、Portfolio双方向連携 |
| 開示レーダー `/tools/disclosure-radar` | 自分に関係する開示抽出、既読、履歴 | market-info API、既読はlocalStorage | 不要 | 高 | 実装済み | 維持。TDNET全件より判断対象を絞る | P0 | upstream運用、通知到達率 |
| 優待カレンダー `/tools/yutai-candidates` | 月別候補、権利日、信用在庫、ピック/パス | market-info API、選択はlocalStorage / 任意同期 | 基本不要 | 高 | 実装済み | 維持。4機能の候補探索段階 | P0 | production fallback、在庫更新 |
| 決算カレンダー `/tools/earnings-calendar` | 国内外の予定を月・日・銘柄で探索 | market-info API | 不要 | 高 | 実装済み | 維持。ホーム通知の詳細先 | P0 | 更新SLA、欠落率 |
| 経済指標カレンダー `/tools/econ-calendar` | 主要国の予定・予想・結果を確認 | market-info API | 不要 | 高 | 実装済み | 維持。市場日程の固有結果 | P1 | 更新SLA |
| 市場ランキング `/tools/market-rankings` | 時価総額・配当利回りの月次順位 | market-info API | 不要 | 中 | 実装済み | 要確認。用途はあるが利用実態不明 | P2 | 利用頻度、月次価値 |
| 投資主体別 `/tools/investor-flow` | 投資主体別需給と分析 | market-info API | 不要 | 中 | 実装済み | 維持。市場全体需給の固有結果 | P1 | 分析鮮度、利用頻度 |
| 株価ランキング `/tools/stock-ranking` | 国内株の騰落・売買高順位 | market-info API | 不要 | 中 | 実装済み | 要確認。意思決定導線との接続不明 | P2 | 利用頻度、回遊 |
| 米国株ランキング `/tools/us-stock-ranking` | 米国株の騰落・売買代金順位 | market-info API | 不要 | 中 | 実装済み・要確認 | 要確認。publish運用を断定不可 | P2 | 更新運用、本番鮮度 |
| 日経225寄与度 `/tools/nikkei-contribution` | 指数を動かした銘柄・寄与・影響度 | market-info API | 不要 | 中 | 実装済み | 維持。指数変動要因の固有結果 | P1 | 利用頻度 |
| TOPIX33 `/tools/topix33` | 当日の33業種騰落 | market-info API | 不要 | 高 | 実装済み | 維持。Premiumは期間推移で別結果 | P0 | Premiumへの遷移率 |
| EDINET `/tools/edinet-documents` | 法定開示の一覧・絞込 | market-info API | 不要 | 中 | 実装済み・要確認 | 要確認。自動日次運用を断定不可 | P2 | 更新運用、利用頻度 |
| TDNET一覧 `/tools/tdnet-disclosures` | 全適時開示の検索・PDF確認 | market-info API | 不要 | 中 | 実装済み | 維持。レーダーの根拠/取りこぼし確認 | P1 | 更新運用、レーダーからの遷移 |
| 旧ペンギンゲーム `/tools/penguin-rabbit-shooter` | 軽いゲーム | ブラウザ | 不要 | 高 | 実装済み | 要確認。利用状況なしで廃止しない | P3 | 新旧ゲームの利用差、保守負荷 |
| ペンギンシューター `/tools/penguin-shooter` | ステージ型ゲーム | ブラウザ、設定はlocalStorage | 不要 | 高 | 実装済み | 要確認。娯楽/技術試行として独立 | P3 | 新旧ゲームの利用差、保守負荷 |
| 合計計算 `/tools/total` | 貼り付け数値の合計 | localStorage | 不要 | 高 | 実装済み | 維持。小さく自己完結 | P2 | 利用頻度 |
| 文字数 `/tools/charcount` | 投稿文の文字数・残数 | ブラウザ | 不要 | 高 | 実装済み | 維持。小さく自己完結 | P2 | 利用頻度 |
| データ引っ越し `/tools/data-transfer` | 端末データのexport/import、DB照合 | ローカルファイル / 各保存先 | 基本不要、一部DBは条件あり | 中 | 実装済み | 維持。localStorage機能の復旧境界 | P0 | DB移行後も残す範囲 |
| アカウント `/account` | 任意ログイン、手動保存/復元、PW管理 | Supabase Auth / `tool_data` | Supabase | 高 | 実装済み | 維持。通常ツールを認証必須にしない同期基盤 | P0 | 同期対象の拡大方針 |
| 外部TODO（ホーム限定） | 別アプリのTODOを開く | 外部サービス | Premium時だけ表示、外部は別認証 | 要確認 | 実装済み（外部リンク） | 要確認。mini-toolsの責務外 | P3 | 継続利用、管理責任 |

### Premium投資

| 機能 / URL | 目的・得られる結果 | 保存先・主データ | 認証 | モバイル | 実装状態 | 判定・理由 | 優先度 | 未確認事項 |
|---|---|---|---|---|---|---|---|---|
| 保有銘柄分析 `/premium/portfolio` | 方針、保有/損益、policy、review/action、履歴 | Supabase `stock_notes_portfolio_*`、MiniToolsは読取専用 | Premium + Supabase本人 | 中 | 実装済み（未完成あり） | 維持・中核。軽量リスト/個別分析を資産全体へ統合 | P0 | GPT保存E2E、差分、銘柄往復、実データUAT |
| 業種モメンタム `/premium/market` | 月内の業種推移・複数業種比較 | TOPIX33 manifest/day data | Premium | 高 | 実装済み | 維持。通常版の当日値とは異なる期間分析 | P0 | 利用頻度、比較期間 |
| テーマViewer `/premium/themes` | 投資テーマの概要・根拠・指標・履歴 | Supabase stock-notes read model | Premium + Supabase本人 | 中 | 実装済み | 維持。テーマ仮説の閲覧 | P1 | 更新運用、Portfolio接続 |
| 業界マップ `/premium/industry-map` | 産業構造を5表現で探索 | Supabase専用read model | Premium + Supabase本人 | 中 | 実装済み | 維持。産業分類の独立視点 | P1 | モバイル実機、更新運用 |
| 企業関係 `/premium/company-network` | 出資・親子・企業groupを探索 | Supabase read model/RPC | Premium + Supabase本人 | 中 | 実装済み | 維持。企業間関係の独立視点 | P1 | 大規模性能、モバイル実機 |
| テーマ×企業 `/premium/theme-company-network` | テーマ起点の企業network | Supabase read model | Premium + Supabase本人 | 中 | 実装済み | 要確認。2画面との重複度を要実測 | P1 | 固有タスク、利用頻度、統合可否 |
| 優待ダッシュボード `/tools/yutai-dashboard` | 候補・仕込み・クロス・取得の年間横断管理 | market-info API + localStorage / Supabase優待DB | Premium | 低（PC向け） | 実装済み | 維持。個別3画面を置換せず横断表示 | P0 | 4機能の正本境界、スマホ方針 |

### Workspace

| 機能 / URL | 目的・得られる結果 | 保存先・主データ | 認証 | モバイル | 実装状態 | 判定・理由 | 優先度 | 未確認事項 |
|---|---|---|---|---|---|---|---|---|
| Workspace Dashboard `/premium/product-map/dashboard` | Service→Product→Implementationの状態俯瞰 | workspace-core API/Supabase | Premium、server権限 | 中 | 実装済み | 維持・入口。詳細より先に全体判断 | P0 | 利用頻度、状態定義の鮮度 |
| Product Map `/premium/product-map` | Product/Repo/技術/Provider関係の探索 | workspace-core API/Supabase | Premium、server権限 | 低〜中 | 実装済み | 維持。Dashboardの詳細探索先 | P1 | relation更新、モバイル実機 |
| ルーティン `/premium/routines` | 定期作業の週間棚卸し | リポジトリ内静的台帳 | Premium | 高 | 静的のみ | 要確認。実行状態/完了履歴と未接続 | P2 | 正本、更新者、実行記録接続 |
| 管理コンソール `/admin` | データ更新・schedule・SLA監視 | market-info API + 静的schedule | Premium | 低 | 実装済み | 維持。投資画面ではなく内部運用 | P0 | upstreamの実運用 |

## 重点機能の境界と推奨

| 組み合わせ | 境界 | 推奨 |
|---|---|---|
| マイ銘柄 / 銘柄分析 / 保有銘柄分析 | 軽量リスト / 個別分析の鮮度・action / 資産全体の方針・配分 | 3機能を維持し、同一銘柄の往復と鮮度表示を優先 |
| 優待カレンダー / メモ / ダッシュボード / 期限帳 | 候補探索 / 取得前知識 / 年間横断 / 取得後の残高・期限 | 正本とライフサイクルを明示して維持。全部入り1画面にはしない |
| 通常TOPIX33 / Premium業種モメンタム | 当日スナップショット / 月内推移と比較 | 共通データ契約を保ち、通常から期間分析へ接続 |
| 決算カレンダー / ホーム通知 | 探索・検索・詳細 / 今日・明日の要約 | 通知は詳細を複製せずカレンダーへ遷移 |
| TDNET一覧 / 開示レーダー | 全件検索 / 関係イベント抽出・既読 | レーダーを日常入口、TDNETを根拠・取りこぼし確認にする |

## 今回確定しない論点

1. privacyを守った利用計測の方法。保有コードやメモ本文を送らない設計が必要。
2. 優待4機能の将来ナビ。責務は分けられるが、URL移動やPremium配下への統合は行わない。
3. テーマ×企業画面の独立性。利用実態なしでは統合しない。
4. 旧ゲームの扱い。利用差・保守コスト確認までは凍結/廃止しない。
5. 外部TODOの所属。Workspaceへ移すか通常から外すかは利用目的を確認する。

## 根拠

- 導線: [`lib/tools-catalog.ts`](../../lib/tools-catalog.ts)、[`app/premium/page.tsx`](../../app/premium/page.tsx)、[`components/MobileBottomNav.tsx`](../../components/MobileBottomNav.tsx)
- 現在仕様: [`docs/product-spec.md`](../product-spec.md)、[`docs/specs/index.md`](../specs/index.md)
- ポートフォリオ正本との接続: [`portfolio.md`](../specs/tools/portfolio.md)、[`portfolio-decision-workspace-plan.md`](./portfolio-decision-workspace-plan.md)
- クロスリポジトリ正本: stock-notes `docs/portfolio-platform-v2.md` と `docs/portfolio-platform-v2-checklist.md`。V2では金額配分を必須成果にせず、active policyに対する現在地・不足・補強方向・履歴を中心にする。MiniTools側plan内に残る旧V1参照との整理は別PRの要確認事項
- 重点仕様: [`stock-notes.md`](../specs/tools/stock-notes.md)、[`yutai-dashboard.md`](../specs/tools/yutai-dashboard.md)、[`topix33.md`](../specs/tools/topix33.md)、[`earnings-calendar.md`](../specs/tools/earnings-calendar.md)、[`tdnet-disclosures.md`](../specs/tools/tdnet-disclosures.md)、[`disclosure-radar.md`](../specs/tools/disclosure-radar.md)
- 判断履歴: [`my-stocks-public-watchlist`](../decision-log/2026-05-31-my-stocks-public-watchlist.md)、[`yutai-dashboard-positioning`](../decision-log/2026-07-05-yutai-dashboard-positioning.md)、[`workspace-core-boundary`](../decision-log/2026-08-30-workspace-core-boundary.md)

## 対象外route

`/` と `/premium` は入口、`/premium/login` と `/account/reset-password` は認証補助、`/tools/yutai-expiry/scan-poc` は検証用routeとして独立項目に数えない。不要という意味ではない。
