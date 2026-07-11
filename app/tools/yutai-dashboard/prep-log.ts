// 仕込み実績（実際にクロス/現物を仕込んだ年月）の記録。
// 取得済み（アーカイブ）とは別に、ダッシュボード独立の LocalStorage で per-銘柄に持つ。
// 断念記録（取引停止・残数なし）は別途仕様化予定。
import { markChanged } from "@/lib/sync/client";

export const YUTAI_DASHBOARD_PREP_LOG_KEY = "yutai_dashboard_prep_log_v1";

// code → 実際に仕込んだ年月（"YYYY-MM"）の昇順ユニーク配列
export type PrepLog = Record<string, string[]>;

const YEAR_MONTH = /^\d{4}-\d{2}$/;

export function loadPrepLog(): PrepLog {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(YUTAI_DASHBOARD_PREP_LOG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const log: PrepLog = {};
    for (const [code, value] of Object.entries(parsed)) {
      if (!code || !Array.isArray(value)) continue;
      const months = Array.from(
        new Set(value.filter((entry): entry is string => typeof entry === "string" && YEAR_MONTH.test(entry))),
      ).sort();
      if (months.length > 0) log[code] = months;
    }
    return log;
  } catch {
    return {};
  }
}

export function savePrepLog(log: PrepLog) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(YUTAI_DASHBOARD_PREP_LOG_KEY, JSON.stringify(log));
  markChanged(YUTAI_DASHBOARD_PREP_LOG_KEY);
}

export function hasPrepEntry(log: PrepLog, code: string, yearMonth: string): boolean {
  return Boolean(code) && (log[code]?.includes(yearMonth) ?? false);
}

/** code の yearMonth("YYYY-MM") 仕込み実績をトグルした新しい PrepLog を返す。 */
export function togglePrepEntry(log: PrepLog, code: string, yearMonth: string): PrepLog {
  if (!code || !YEAR_MONTH.test(yearMonth)) return log;
  const current = log[code] ?? [];
  const nextList = current.includes(yearMonth)
    ? current.filter((entry) => entry !== yearMonth)
    : [...current, yearMonth].sort();
  const next = { ...log };
  if (nextList.length === 0) delete next[code];
  else next[code] = nextList;
  return next;
}
