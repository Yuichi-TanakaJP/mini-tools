import type { Reward } from "./contracts";
export type RewardPeriod = "all" | "thisMonth" | "later" | "overdue" | "noExpiry";
export type RewardSort = "expiryAsc" | "createdDesc" | "companyAsc";
export const rewardPeriods: Record<RewardPeriod, string> = { all: "すべて", thisMonth: "今月", later: "来月以降", overdue: "期限切れ", noExpiry: "期限未設定" };
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
/** Current balance only; missing denominations are not zero-valued assets. */
export function rewardBalanceSummary(rows: readonly Reward[], today: string) {
  const total = (selected: readonly Reward[]) => selected.reduce((sum, r) => {
    if (r.track_mode === "count" && r.unit_yen === null) sum.unknown += 1;
    else sum.yen += r.remaining_value * (r.track_mode === "amount" ? 1 : r.unit_yen!);
    return sum;
  }, { yen: 0, unknown: 0 });
  const active = rows.filter(r => !r.archived_at && r.remaining_value > 0);
  return {
    available: total(active.filter(r => !r.expires_on || r.expires_on >= today)),
    thisMonth: total(active.filter(r => r.expires_on?.slice(0, 7) === today.slice(0, 7))),
    overdue: total(active.filter(r => r.expires_on !== null && r.expires_on < today)),
  };
}
function inPeriod(r: Reward, period: RewardPeriod, today: string) {
  if (period === "all") return true;
  if (period === "noExpiry") return r.expires_on === null;
  if (!r.expires_on) return false;
  if (period === "thisMonth") return r.expires_on.slice(0, 7) === today.slice(0, 7);
  if (period === "later") return r.expires_on.slice(0, 7) > today.slice(0, 7);
  return r.expires_on < today;
}
export function rewardList(rows: readonly Reward[], options: { period: RewardPeriod; sort: RewardSort; query: string; month: string; archives: boolean; completed: boolean }, today: string) {
  const query = options.query.trim().toLocaleLowerCase("ja-JP");
  return rows.filter(r => (options.archives || !r.archived_at) && (options.completed || r.remaining_value > 0) &&
    inPeriod(r, options.period, today) && (!options.month || r.expires_on?.startsWith(options.month)) &&
    `${r.title} ${r.company} ${r.memo} ${r.link ?? ""}`.toLocaleLowerCase("ja-JP").includes(query))
    .sort((a, b) => {
      const order = options.sort === "companyAsc" ? a.company.localeCompare(b.company, "ja") :
        options.sort === "createdDesc" ? Date.parse(b.created_at) - Date.parse(a.created_at) : (a.expires_on ?? "9999-99-99").localeCompare(b.expires_on ?? "9999-99-99");
      return order || a.title.localeCompare(b.title, "ja") || a.id.localeCompare(b.id);
    });
}
/** Counts always describe active positive balances, independently of search. */
export function rewardPeriodCounts(rows: readonly Reward[], today: string): Record<RewardPeriod, number> {
  const active = rows.filter(r => !r.archived_at && r.remaining_value > 0);
  return Object.fromEntries((Object.keys(rewardPeriods) as RewardPeriod[]).map(period => [period, active.filter(r => inPeriod(r, period, today)).length])) as Record<RewardPeriod, number>;
}
