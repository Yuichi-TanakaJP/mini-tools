// ルーティン定義の正本。
//
// 出所:
// - auto / semi: Windows タスクスケジューラの登録内容
//   （`market_info/scripts/register_tasks.ps1` ほか）
// - manual: 各リポジトリの `.claude/skills/*/SKILL.md`
//
// 実行実績を自動で取り込む仕組みは持たない。棚卸ししたときに手で更新する。
// 最終棚卸し: 2026-08-08

import type { Routine } from "../types";

/** この定義を最後に実機と突き合わせた日。画面に鮮度として出す。 */
export const ROUTINES_SURVEYED_ON = "2026-08-08";

export const ROUTINES: Routine[] = [
  // ---- 自動: 毎日 ----
  {
    id: "econ-weekly-scrape-daily",
    label: "経済指標カレンダー取得",
    description: "週次の経済指標スケジュールを毎日スクレイプして最新化する。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "daily", times: ["00:35"] },
    source: "econ_weekly_scrape_daily",
    repo: "market_info",
  },
  {
    id: "gmo-gaika-econ-calendar",
    label: "GMO外貨 経済カレンダー更新",
    description: "GMO外貨の経済カレンダーを取り込み、指標データを補完する。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "daily", times: ["06:10"] },
    source: "gmo_gaika_econ_calendar_refresh",
    repo: "market_info",
  },
  {
    id: "edinet-daily",
    label: "EDINET 書類取得",
    description: "EDINET の提出書類一覧を日次で取得して公開データへ反映する。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "daily", times: ["06:30"] },
    source: "edinet_daily_run",
    repo: "market_info",
  },
  {
    id: "econ-indicator-alias",
    label: "指標名エイリアス候補抽出",
    description: "表記ゆれのある経済指標名の名寄せ候補を洗い出す。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "daily", times: ["06:35"] },
    source: "econ_indicator_alias_candidates",
    repo: "market_info",
  },
  {
    id: "youtube-stocks-line",
    label: "株YouTube 監視 → LINE",
    description: "株系YouTubeの新着を文字起こしし、言及銘柄と見立てを LINE へ送る。",
    mode: "auto",
    domain: "line-notify",
    schedule: { kind: "daily", times: ["08:00", "20:00"] },
    source: "YouTubeStocksLINE_Watch",
    repo: "test_line_news",
  },
  {
    id: "youtube-stocks-line-kamioka",
    label: "株YouTube 監視 → LINE（2）",
    description: "別プロフィール設定での株YouTube監視。",
    mode: "auto",
    domain: "line-notify",
    schedule: { kind: "daily", times: ["11:30"] },
    source: "YouTubeStocksLINE_Watch_Kamioka",
    repo: "test_line_news",
  },
  {
    id: "market-news-line",
    label: "市場ニュースまとめ → LINE",
    description: "その日の市場ニュースを調査し、まとめを LINE へ送る。",
    mode: "auto",
    domain: "line-notify",
    schedule: { kind: "daily", times: ["20:00"] },
    source: "MarketNewsLINE_Daily",
    repo: "test_line_news",
  },
  {
    id: "youtube-stocks-line-bitasen",
    label: "株YouTube 監視 → LINE（3）",
    description: "別プロフィール設定での株YouTube監視。",
    mode: "auto",
    domain: "line-notify",
    schedule: { kind: "daily", times: ["20:30"] },
    source: "YouTubeStocksLINE_Watch_Bitasen",
    repo: "test_line_news",
  },
  {
    id: "tdnet-meta-daily",
    label: "TDnet 開示メタ取得",
    description: "TDnet の適時開示メタデータを日次で取得する。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "daily", times: ["21:30"] },
    source: "tdnet_meta_daily",
    repo: "market_info",
  },

  // ---- 自動: 週次 ----
  {
    id: "earnings-schedule-weekly",
    label: "決算予定 週次更新",
    description: "国内決算スケジュールを週明けに再取得する。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "weekly", weekdays: [1], times: ["06:00"] },
    source: "earnings_schedule_weekly",
    repo: "market_info",
  },
  {
    id: "jpx-investor-flow-publish",
    label: "投資部門別売買 公開",
    description: "JPX の投資部門別売買状況を取得して公開データへ反映する。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "weekly", weekdays: [4], times: ["16:30"] },
    source: "jpx_investor_flow_publish",
    repo: "market_info",
  },

  // ---- 自動: 月次 ----
  {
    id: "earnings-schedule-monthly",
    label: "決算予定 月次更新",
    description: "月初に決算スケジュール全体を組み直す。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "monthly", daysOfMonth: [1], times: ["06:00"] },
    source: "earnings_schedule_monthly",
    repo: "market_info",
  },
  {
    id: "yutai-monthly-run",
    label: "優待マスタ 月次更新",
    description: "株主優待の銘柄マスタを月初に更新する。",
    mode: "auto",
    domain: "market-data",
    schedule: { kind: "monthly", daysOfMonth: [1], times: ["08:00"] },
    source: "yutai_monthly_run",
    repo: "market_info",
  },
  {
    id: "jpx-listed-companies-monthly",
    label: "JPX 上場銘柄マスタ更新",
    description:
      "前月末スナップショットの公開後に上場銘柄マスタを取り直す。公開時期がぶれるため 3〜10 日で再試行する。",
    mode: "auto",
    domain: "market-data",
    schedule: {
      kind: "monthly",
      daysOfMonth: [3, 4, 5, 6, 7, 8, 9, 10],
      times: ["12:00"],
    },
    source: "jpx_listed_companies_monthly",
    repo: "market_info",
  },

  // ---- 半自動: リマインダー起点 ----
  {
    id: "credit-inventory-nikko",
    label: "信用在庫 取得（日興）",
    description:
      "リマインダーを受けて日興の一般信用売り在庫を取得し publish する。/weekend-credit-inventory を使う。",
    mode: "semi",
    domain: "market-data",
    schedule: { kind: "weekly", weekdays: [6], times: ["09:00"] },
    source: "credit_inventory_reminder_nikko",
    repo: "market_info",
  },
  {
    id: "credit-inventory-sbi",
    label: "信用在庫 取得（SBI）",
    description:
      "リマインダーを受けて SBI の一般信用売り在庫を取得し publish する。/weekend-credit-inventory を使う。",
    mode: "semi",
    domain: "market-data",
    schedule: { kind: "weekly", weekdays: [0], times: ["09:00"] },
    source: "credit_inventory_reminder_sbi",
    repo: "market_info",
  },
  {
    id: "monthly-rankings",
    label: "月次ランキング取得",
    description:
      "月初のポップアップを受けて信用残・売買代金ランキングの月次取得を手で流す。",
    mode: "semi",
    domain: "market-data",
    schedule: { kind: "monthly", daysOfMonth: [1], times: ["09:00"] },
    source: "monthly_rankings_reminder",
    repo: "market_info",
  },

  // ---- 手動: X 投稿 ----
  {
    id: "portfolio-post-daily",
    label: "X 日次ポートフォリオ投稿",
    description:
      "当日ニュースを調べて日次のX投稿ドラフトを作り、投稿する。/portfolio-post。",
    mode: "manual",
    domain: "x-post",
    schedule: { kind: "weekday", times: [] },
    source: "/portfolio-post",
    repo: "portfolio_x_post",
  },
  {
    id: "portfolio-post-weekly",
    label: "X 週間振り返り投稿",
    description: "その週の市場総括をまとめて投稿する。/portfolio-post-weekly。",
    mode: "manual",
    domain: "x-post",
    schedule: { kind: "weekly", weekdays: [6], times: [] },
    source: "/portfolio-post-weekly",
    repo: "portfolio_x_post",
  },
  {
    id: "portfolio-post-preview",
    label: "X 今週のポイント投稿",
    description:
      "翌週の重要指標・決算予定から注目テーマを選び、予告として投稿する。/portfolio-post-preview。",
    mode: "manual",
    domain: "x-post",
    schedule: { kind: "weekly", weekdays: [0], times: [] },
    source: "/portfolio-post-preview",
    repo: "portfolio_x_post",
  },
  {
    id: "yutai-post",
    label: "X 優待体験レポ投稿",
    description: "実際に使った優待の体験を投稿する。/yutai-post。",
    mode: "manual",
    domain: "x-post",
    schedule: { kind: "adhoc" },
    source: "/yutai-post",
    repo: "portfolio_x_post",
  },
  {
    id: "note-writer",
    label: "note 記事執筆",
    description: "過去記事の文体に寄せた note 記事ドラフトを作る。/note-writer。",
    mode: "manual",
    domain: "x-post",
    schedule: { kind: "adhoc" },
    source: "/note-writer",
    repo: "portfolio_x_post",
  },

  // ---- 手動: 開発・運用 ----
  {
    id: "dev-status",
    label: "全リポジトリ仕掛かり棚卸し",
    description: "~/dev 配下の未完了作業と open PR/issue を突合して確認する。/dev-status。",
    mode: "manual",
    domain: "dev-ops",
    schedule: { kind: "adhoc" },
    source: "/dev-status",
    repo: "claude-skills",
  },
  {
    id: "ideas-review",
    label: "アイデア台帳レビュー",
    description: "ideas リポジトリの滞留・判定期限・重複を点検する。/ideas-review。",
    mode: "manual",
    domain: "dev-ops",
    schedule: { kind: "adhoc" },
    source: "/ideas-review",
    repo: "claude-skills",
  },
  {
    id: "mini-tools-master-import",
    label: "mini-tools へのマスタ取り込み",
    description:
      "market_info の成果物を mini-tools 側へ反映する（JPX 上場銘柄 JSON、ランキング CSV など）。",
    mode: "manual",
    domain: "dev-ops",
    schedule: { kind: "adhoc" },
    source: "手作業",
    repo: "mini-tools",
  },
];
