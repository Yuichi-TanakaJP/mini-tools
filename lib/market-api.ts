/**
 * market-info API のベース URL を返す。
 * MARKET_INFO_API_BASE_URL が未設定の場合は空文字列を返し、
 * 各 data-loader 側で fetch をスキップする判定に使う。
 */
export function getApiBaseUrl(): string {
  return process.env.MARKET_INFO_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
}
