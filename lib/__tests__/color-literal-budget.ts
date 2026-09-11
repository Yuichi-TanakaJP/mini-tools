/**
 * 直書き色の残数（ファイル別の上限）。
 *
 * 目的は「これ以上増やさないこと」。減らしたら値を下げる。増やす方向の更新は、
 * グラフ系列・ブランド・ゲーム固有表現など理由を説明できる場合だけにする。
 * 新しく色リテラルを書いたファイルは、ここに載っていないので必ず落ちる。
 *
 * 対象外（意図的な例外）:
 *   - app/globals.css          … トークン定義そのもの
 *   - app/admin/**             … 常時 Dark。値の意味が他画面と逆になる
 *   - penguin 系ゲーム          … ゲーム固有パレット
 *   - テストファイル
 */
export const COLOR_LITERAL_BUDGET: Readonly<Record<string, number>> = {
  "app/account/AccountClient.tsx": 3,
  "app/account/reset-password/ResetPasswordClient.tsx": 2,
  "app/layout.tsx": 2,
  "app/premium/PremiumPreviewChart.tsx": 11,
  "app/premium/company-network/ClaudeUi.module.css": 7,
  "app/premium/company-network/CompanyNetwork.module.css": 6,
  "app/premium/company-network/FunctionViews.module.css": 7,
  "app/premium/company-network/presentation.ts": 3,
  "app/premium/company-network/views/FunctionRelationRadialView.tsx": 1,
  "app/premium/company-network/views/GroupRadialView.tsx": 3,
  "app/premium/company-network/views/RadialView.tsx": 1,
  "app/premium/industry-map/IndustryMap.module.css": 7,
  "app/premium/industry-map/presentation.ts": 5,
  "app/premium/login/LoginForm.tsx": 2,
  "app/premium/login/page.tsx": 4,
  "app/premium/market/page.tsx": 15,
  "app/premium/page.tsx": 7,
  "app/premium/portfolio/PortfolioDashboard.tsx": 22,
  "app/premium/portfolio/PortfolioWorkspace.tsx": 24,
  "app/premium/product-map/ProductMapClient.tsx": 39,
  "app/premium/product-map/dashboard/ProductPortfolioCockpit.module.css": 19,
  "app/premium/routines/RoutinesView.tsx": 4,
  "app/premium/theme-company-network/ThemeCompanyNetworkClient.tsx": 4,
  "app/premium/themes/ThemeViewer.tsx": 9,
  "app/tools/charcount/ToolClient.tsx": 5,
  "app/tools/data-transfer/ToolClient.tsx": 1,
  "app/tools/earnings-calendar/ToolClient.tsx": 3,
  "app/tools/econ-calendar/ToolClient.tsx": 4,
  "app/tools/investor-flow/ToolClient.tsx": 9,
  "app/tools/market-rankings/ToolClient.tsx": 5,
  "app/tools/my-stocks/ToolClient.tsx": 4,
  "app/tools/nikkei-contribution/ToolClient.tsx": 22,
  "app/tools/stock-notes/ToolClient.tsx": 17,
  "app/tools/stock-ranking/ToolClient.tsx": 3,
  "app/tools/topix33/ToolClient.tsx": 6,
  "app/tools/total/ToolClient.tsx": 1,
  "app/tools/us-stock-ranking/ToolClient.tsx": 3,
  "app/tools/yutai-candidates/ToolClient.tsx": 13,
  "app/tools/yutai-dashboard/ToolClient.tsx": 11,
  "app/tools/yutai-expiry/ToolClient.module.css": 3,
  "app/tools/yutai-expiry/scan-poc/page.tsx": 1,
  "app/tools/yutai-memo/ToolClient.module.css": 28,
  "app/tools/yutai-memo/ToolClient.tsx": 4,
  "components/ColorThemeSelector.tsx": 2,
};
