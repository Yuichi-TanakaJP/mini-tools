import type { StockMonitoringMetadata, StockWatchPurpose } from "./types";

export const WATCH_PURPOSE_LABELS: Record<StockWatchPurpose, string> = {
  shareholder_benefit: "優待", dividend: "配当", growth: "業績・成長",
  recovery: "業績回復・事業転換", event: "イベント・技術実用化",
  value_improvement: "企業価値・資本効率改善",
};
export const WATCH_PURPOSES = Object.keys(WATCH_PURPOSE_LABELS) as StockWatchPurpose[];

/** Never coerce a malformed value into a monitoring OFF decision. */
export function parseMonitoringMetadata(purposes: unknown, credit: unknown): StockMonitoringMetadata {
  if (!Array.isArray(purposes) || !purposes.every((p) => typeof p === "string" && WATCH_PURPOSES.includes(p as StockWatchPurpose)) || new Set(purposes).size !== purposes.length) {
    throw new Error("注目目的のデータ形式が不正です。再取得してください。");
  }
  if (credit !== null && typeof credit !== "boolean") {
    throw new Error("信用残監視のデータ形式が不正です。再取得してください。");
  }
  return { watchPurposes: [...purposes] as StockWatchPurpose[], creditMonitoringEnabled: credit as boolean | null };
}

export function monitoringLabel(credit: boolean | null | undefined): string {
  if (credit === true) return "信用残：対象";
  if (credit === false) return "信用残：対象外";
  return "信用残：未指定";
}
