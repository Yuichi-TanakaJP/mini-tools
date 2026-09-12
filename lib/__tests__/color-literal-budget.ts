/**
 * 直書き色の残数（ファイル別の上限）。#hex と rgb() / rgba() の両方を数える。
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
  "app/layout.tsx": 1,
  "app/premium/LogoutButton.tsx": 1,
  "app/premium/PremiumPreviewChart.tsx": 6,
  "app/premium/company-network/ClaudeUi.module.css": 7,
  "app/premium/company-network/CompanyNetwork.module.css": 12,
  "app/premium/company-network/FunctionViews.module.css": 17,
  "app/premium/company-network/presentation.ts": 3,
  "app/premium/company-network/views/FunctionRelationRadialView.tsx": 1,
  "app/premium/company-network/views/GroupRadialView.tsx": 1,
  "app/premium/company-network/views/RadialView.tsx": 1,
  "app/premium/industry-map/IndustryMap.module.css": 16,
  "app/premium/industry-map/presentation.ts": 5,
  "app/premium/login/LoginForm.tsx": 3,
  "app/premium/login/page.tsx": 4,
  "app/premium/market/page.tsx": 20,
  "app/premium/page.tsx": 11,
  "app/premium/portfolio/PortfolioDashboard.tsx": 16,
  "app/premium/portfolio/PortfolioWorkspace.tsx": 13,
  "app/premium/product-map/ProductMapClient.tsx": 23,
  "app/premium/product-map/dashboard/ProductPortfolioCockpit.module.css": 21,
  "app/premium/routines/RoutinesView.tsx": 10,
  "app/premium/shared/radial/RadialHierarchyCanvas.module.css": 3,
  "app/premium/theme-company-network/ThemeCompanyNetworkClient.tsx": 5,
  "app/premium/themes/ThemeViewer.tsx": 6,
  "app/tools/charcount/ToolClient.tsx": 1,
  "app/tools/data-transfer/ToolClient.tsx": 1,
  "app/tools/earnings-calendar/ToolClient.tsx": 14,
  "app/tools/earnings-calendar/loading.tsx": 1,
  "app/tools/econ-calendar/ToolClient.tsx": 22,
  "app/tools/investor-flow/ToolClient.tsx": 42,
  "app/tools/market-rankings/ToolClient.tsx": 23,
  "app/tools/my-stocks/ToolClient.tsx": 9,
  "app/tools/nikkei-contribution/ToolClient.tsx": 40,
  "app/tools/nikkei-contribution/loading.tsx": 1,
  "app/tools/stock-notes/ToolClient.tsx": 23,
  "app/tools/stock-ranking/ToolClient.tsx": 5,
  "app/tools/topix33/ToolClient.tsx": 10,
  "app/tools/topix33/loading.tsx": 1,
  "app/tools/us-stock-ranking/ToolClient.tsx": 5,
  "app/tools/yutai-candidates/ToolClient.tsx": 60,
  "app/tools/yutai-candidates/loading.tsx": 4,
  "app/tools/yutai-dashboard/ToolClient.tsx": 76,
  "app/tools/yutai-dashboard/loading.tsx": 4,
  "app/tools/yutai-expiry/ToolClient.module.css": 56,
  "app/tools/yutai-expiry/scan-poc/page.tsx": 1,
  "app/tools/yutai-memo/ToolClient.module.css": 24,
  "app/tools/yutai-memo/ToolClient.tsx": 4,
  "components/LoadingSpinner.module.css": 1,
  "components/MobileBottomNav.module.css": 1,
  "components/MonetizeBar.tsx": 1,
};
