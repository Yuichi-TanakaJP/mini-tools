# Docs Index

このディレクトリは、`mini-tools` の **現在仕様**、**確認手順**、**意思決定の記録**、**作業ログ** を辿るための入口です。  
「今どう動くべきか」「どう確認するか」「なぜそうしたか」「どう進めたか」を後から追えることを目的としています。

docs の置き場所と相互リンクのルールは [Docs Writing Workflow](./docs-writing-workflow.md) を参照します。

---

## 📘 Decision Log（設計判断）

設計・方針・トレードオフの判断理由を記録します。

- [2026-06-26 ホーム通知の初期対象を開示イベント新着にする](./decision-log/2026-06-26-home-disclosure-notifications.md)
- [2026-06-22 ログイン直後の自動同期を止める判断](./decision-log/2026-06-22-manual-sync-after-login.md)
- [2026-06-21 ローカルデータの任意ログイン同期方針（オプトイン・クロスデバイス）](./decision-log/2026-06-21-localstorage-optional-login-sync-policy.md)
- [2026-06-14 ShareButtons 共有URLのハイドレーション対応（origin はマウント後注入）](./decision-log/2026-06-14-sharebuttons-hydration-origin.md)
- [2026-06-18 ホーム画面のツール配置カスタマイズ](./decision-log/2026-06-18-home-tool-order-customization.md)
- [2026-06-14 マイ銘柄リスト 比率グラフの種別切り替え（帯/円/四角ヒートマップ）](./decision-log/2026-06-14-my-stocks-ratio-chart-types.md)
- [2026-06-14 開示レーダーの日付別JSONとブラウザHTTPキャッシュ](./decision-log/2026-06-14-disclosure-radar-http-cache.md)
- [2026-06-14 全ツール切り替え用ハンバーガー＋ドロワー](./decision-log/2026-06-14-global-nav-drawer.md)
- [2026-06-14 開示レーダーの履歴表示と確認済み管理](./decision-log/2026-06-14-disclosure-radar-history-and-read-state.md)
- [2026-06-13 開示イベントレーダーとモバイル下部ナビ](./decision-log/2026-06-13-disclosure-radar-and-mobile-nav.md)
- [2026-05-31 日興一般「在庫0」判定を available_shares 基準に変更](./decision-log/2026-05-31-nikko-out-of-stock-shares-based.md)
- [2026-06-01 投資主体別売買動向の分析API優先表示](./decision-log/2026-06-01-investor-flow-analysis-api-view.md)
- [2026-06-15 投資主体別売買動向のダッシュボード鮮度基準](./decision-log/2026-06-15-investor-flow-dashboard-freshness.md)
- [2026-06-15 管理ダッシュボードのスケジュール連動鮮度判定](./decision-log/2026-06-15-schedule-aware-dashboard-freshness.md)
- [2026-05-30 日興信用バッジの記号化と「売可だが在庫0」追加](./decision-log/2026-05-30-nikko-general-out-of-stock-badge.md)
- [2026-05-30 ルーター遷移の押下フィードバック共通化（useRouterTransition + pendingKey）](./decision-log/2026-05-30-router-transition-pending-feedback.md)
- [2026-05-28 yutai-candidates の「パス」アクションとカードレイアウト見直し](./decision-log/2026-05-28-yutai-candidates-pass-action.md)
- [2026-05-06 ペンギン・エイリアンシューター 敵キャラクター変更](./decision-log/2026-05-06-penguin-alien-enemy-visual.md)
- [2026-05-16 TDNET適時開示一覧の初期実装方針](./decision-log/2026-05-16-tdnet-disclosures-page.md)
- [2026-05-19 優待期限台帳 UI と入出力データ方針](./decision-log/2026-05-19-yutai-expiry-ui-and-data-policy.md)
- [2026-05-20 優待期限台帳 消費モデル（枚数/金額・履歴）](./decision-log/2026-05-20-yutai-expiry-consumption-model.md)
- [2026-06-14 優待期限台帳 アーカイブ機能](./decision-log/2026-06-14-yutai-expiry-archive.md)
- [2026-05-09 ペンギンシューター豪華版・新技術トライアル方針](./decision-log/2026-05-09-penguin-shooter-rich-game-trial.md)
- [2026-05-09 ペンギンシューター 100小ステージデータ構造](./decision-log/2026-05-09-penguin-shooter-stage-data-structure.md)
- [2026-05-09 ペンギンシューター ボス設計とPR8凍結](./decision-log/2026-05-09-penguin-shooter-boss-design-and-pr8-freeze.md)
- [2026-05-09 ペンギンシューター 背景・ボス演出強化](./decision-log/2026-05-09-penguin-shooter-visual-boss-polish.md)
- [2026-05-10 ペンギンシューター ステージボス専用デザイン](./decision-log/2026-05-10-penguin-shooter-dedicated-stage-bosses.md)
- [2026-05-10 ペンギンシューター 通常ステージ障害物システム](./decision-log/2026-05-10-penguin-shooter-obstacle-system.md)
- [2026-05-10 ペンギンシューター ボス攻撃のステージ別設計](./decision-log/2026-05-10-penguin-shooter-boss-attack-per-stage.md)
- [2026-05-10 ペンギンシューター ボス攻撃のレーザー・誘導弾追加](./decision-log/2026-05-10-penguin-shooter-boss-laser-missile.md)
- [2026-05-11 ペンギンシューター 古代遺跡とバリアアイテム](./decision-log/2026-05-11-penguin-shooter-ruins-barrier.md)
- [2026-05-06 ペンギン・エイリアンシューター コンボとスコア演出](./decision-log/2026-05-06-penguin-combo-score-feedback.md)
- [2026-05-05 docs 直下ファイルの分類方針](./decision-log/2026-05-05-docs-root-classification.md)
- [2026-05-05 baseline-browser-mapping warning 対応](./decision-log/2026-05-05-baseline-browser-mapping-warning.md)
- [2026-05-05 ペンギン自機の宇宙船化](./decision-log/2026-05-05-penguin-ship-player-visual.md)
- [2026-05-04 mini-tools 仕様書構成の初期方針](./decision-log/2026-05-04-mini-tools-spec-docs-structure.md)
- [2026-05-04 yutai-memo と優待カレンダー連携フィールド整理](./decision-log/2026-05-04-yutai-memo-calendar-import-field-policy.md)
- [2026-05-02 決算カレンダーへの銘柄検索機能追加](./decision-log/2026-05-02-earnings-calendar-search.md)
- [2026-04-25 premium 保有銘柄ダッシュボードの初期方針](./decision-log/2026-04-25-premium-portfolio-dashboard.md)
- [2026-04-20 ペンギン・バニーシューター タッチパネルレイアウト設計](./decision-log/2026-04-20-penguin-touch-panel-layout.md)
- [2026-04-23 yutai-candidates の権利付き最終日 UI 表示](./decision-log/2026-04-23-yutai-candidates-kenri-last-date-ui.md)
- [2026-04-18 Git ブランチ整理のガードレール追加](./decision-log/2026-04-18-git-branch-cleanup-guardrail.md)
- [2026-04-17 ペンギン・バニーシューター最短導入方針](./decision-log/2026-04-17-penguin-rabbit-shooter-minimal-intro.md)
- [2026-04-12 米国株ランキング phase 1 のデータ contract と実装方針](./decision-log/2026-04-12-us-stock-ranking-phase1.md)
- [2026-04-11 共通化 Issue の着手順メモ](./decision-log/2026-04-11-commonization-priority.md)
- [2026-04-11 JSON 同梱データと fallback 方針整理](./decision-log/2026-04-11-json-fallback-policy.md)
- [2026-04-11 小さな入力系 tool の page shell 共通化](./decision-log/2026-04-11-small-tools-page-shell-commonization.md)
- [2026-04-11 dev 環境 UI スモークテスト基盤](./decision-log/2026-04-11-ui-smoke-test-foundation.md)
- [2026-04-11 ローディングUIのスピナー2段パターン統一](./decision-log/2026-04-11-loading-spinner-pattern.md)
- [2026-04-11 市場ランキング月次ツールの追加方針](./decision-log/2026-04-11-market-rankings-monthly-tool.md)
- [2026-04-07 loading.tsx 追加と並列 fetch 化](./decision-log/2026-04-07-loading-ui-and-parallel-fetch.md)
- [2026-04-05 yutai-candidates の SBI 短期対象表示ルール](./decision-log/2026-04-05-yutai-candidates-sbi-short-handling.md)
- [2026-04-05 海外決算カレンダー統合方針](./decision-log/2026-04-05-overseas-earnings-calendar-integration.md)
- [2026-04-04 market tools の API 統一方針](./decision-log/2026-04-04-market-tools-api-unification-plan.md)
- [2026-04-05 jpx-closed endpoint の確定事項](./decision-log/2026-04-05-jpx-closed-endpoint-finalization.md)
- [2026-04-04 TOPIX33 premium 可視化の見せ方方針](./decision-log/2026-04-04-topix33-premium-visualization-plan.md)
- [2026-04-04 premium ログイン導線の暫定実装方針](./decision-log/2026-04-04-premium-login-placeholder-flow.md)
- [2026-04-03 有料機能プレースホルダーの追加方針](./decision-log/2026-04-03-premium-feature-placeholder.md)
- [2026-03-31 TOPIX33業種データ追加と market tools 導線の方針](./decision-log/2026-03-31-topix33-market-tool-plan.md)
- [2026-03-29 market tools の日付 UI と休場日扱いの整理](./decision-log/2026-03-29-market-tools-date-ui-and-holiday-handling.md)
- [2026-03-29 dev 環境の WSL 移行方針と OneDrive 運用解消](./decision-log/2026-03-29-dev-env-wsl-migration-and-onedrive-exit.md)
- [2026-03-29 ヘッダー QR ボタンの視認性とモーダル位置](./decision-log/2026-03-29-header-qr-visibility-and-modal-position.md)
- [2026-03-28 日経225寄与度ツールのデータ連携と UI 判断](./decision-log/2026-03-28-nikkei-contribution-data-and-ui.md)
- [2026-03-22 決算カレンダーのデータ contract と運用メモ](./decision-log/2026-03-22-earnings-calendar-data-contract.md)
- [2026-03-17 yutai-memo 銘柄マスタ JSON 更新運用](./decision-log/2026-03-17-yutai-memo-master-update-ops.md)
- [2026-03-26 株価ランキングのデータ連携手順メモ](./decision-log/2026-03-26-stock-ranking-data-update-ops.md)
- [2026-03-13 yutai-memo 取得リスト年月アコーディオン設計](./decision-log/2026-03-13-yutai-memo-acquired-list-accordion-design.md)
- [2026-03-12 SSR / Hydration / localStorage 運用ガイド](./decision-log/2026-03-12-ssr-localstorage-hydration-guidelines.md)
- [2026-01-17 yutai-memo タグ対応と hydration 問題](./decision-log/2026-01-17-yutai-memo-user-tags-and-hydration.md)
- [2026-01-11 QR 共有モーダル実装の設計判断](./decision-log/2026-01-11-qr-share-modal.md)
- [2026-01-10 cherry-pick 分割判断](./decision-log/2026-01-10_cherry-pick-split.md)

---

## 🧪 Dev Log（作業ログ）

日々の開発作業や試行錯誤の記録です。

- [2026-04-11 commonization PR handoff](./devlog/2026-04-11-commonization-handoff.md)
- [2026-04-05 market tools 本番確認メモ](./devlog/2026-04-05-market-tools-production-verification.md)
- [2026-01-11 QR 共有 UI 改善ログ](./devlog/2026-01-11-qr-share-ui-improvement.md)
- [2026-01-10 Git 学習ログ](./devlog/2026-01-10_git-learning-log.md)

---

## 📎 Specs（仕様メモ）

- [mini-tools プロダクト仕様](./product-spec.md)
- [ツール別仕様インデックス](./specs/index.md)
  - [株価ランキング 仕様](./specs/tools/stock-ranking.md)
  - [日経225寄与度 仕様](./specs/tools/nikkei-contribution.md)
  - [TOPIX33業種 仕様](./specs/tools/topix33.md)
  - [優待銘柄メモ帳 仕様](./specs/tools/yutai-memo.md)
  - [決算カレンダー 仕様](./specs/tools/earnings-calendar.md)
  - [TDNET適時開示一覧 仕様](./specs/tools/tdnet-disclosures.md)
  - [開示イベントレーダー 仕様](./specs/tools/disclosure-radar.md)
  - [投資主体別売買動向 仕様](./specs/tools/investor-flow.md)
  - [ペンギンシューター 仕様](./specs/tools/penguin-shooter.md)
- [横断仕様インデックス](./specs/cross-cutting/index.md)
  - [mini-tools システム構成概要](./specs/cross-cutting/system-architecture-overview.md)
  - [React Server / Client 責任境界](./specs/cross-cutting/react-server-client-boundaries.md)
  - [Market Tools データ取得経路一覧](./specs/cross-cutting/market-tools-data-fetch-paths.md)（market_info / market-info-api への横断参照入口を含む）
  - [QR 共有 URL 仕様](./specs/cross-cutting/share-url-spec.md)
  - [UI カラーパレット仕様](./specs/cross-cutting/ui-color-palette.md)
  - [株価ランキング UI JSON CLI 仕様](./specs/cross-cutting/stock-ranking-ui-json-cli-spec.md)

---

## 🗺️ Plans（計画・移行）

- [Plans インデックス](./plans/index.md)
  - [月100円マネタイズ計画](./plans/month-100-yen-monetization-plan.md)
  - [月100円プロジェクト進捗チェックリスト](./plans/month-100-yen-progress-checklist.md)
  - [ペンギンシューター新ゲーム作成計画](./plans/penguin-shooter-new-game-plan.md)
  - [プロジェクト継続・撤退判断基準](./plans/project-continuation-criteria.md)
  - [株価ランキング外部データ移行計画](./plans/stock-ranking-external-data-migration-plan.md)

---

## 🧾 Backlog（未着手候補）

- [Backlog インデックス](./backlog/index.md)
  - [TDNET 複数日検索 range API 化 検討メモ](./backlog/tdnet-range-api-architecture.md)
  - [yutai-expiry UI / data model backlog](./backlog/yutai-expiry-ui-data-model.md)

---

## 🧪 UAT チェックリスト（動作確認手順）

PR マージ後・リリース前の確認観点をツールごとにまとめたチェックリストです。

- [UAT インデックス](./uat/index.md)
  - [決算カレンダー](./uat/earnings-calendar.md)
  - [米国株ランキング](./uat/us-stock-ranking.md)
  - [市場ランキング](./uat/market-rankings.md)
  - [投資主体別売買動向](./uat/investor-flow.md)
  - [TDNET適時開示一覧](./uat/tdnet-disclosures.md)
  - [開示イベントレーダー](./uat/disclosure-radar.md)
  - [株価ランキング](./uat/stock-ranking.md)
  - [日経225寄与度](./uat/nikkei-contribution.md)
  - [TOPIX33業種](./uat/topix33.md)
  - [優待カレンダー](./uat/yutai-candidates.md)
  - [株主優待期限帳](./uat/yutai-expiry.md)
  - [優待銘柄メモ帳](./uat/yutai-memo.md)
  - [ペンギンシューター](./uat/penguin-shooter.md)

---

## 運用ルール（簡易）

- **Decision Log**：設計判断が発生したときだけ追加
- **Dev Log**：区切りの良い作業単位で追加
- 仕様や議論結果の残し方は [Docs Writing Workflow](./docs-writing-workflow.md) を参照
- ファイル名は `YYYY-MM-DD-内容.md` 形式
