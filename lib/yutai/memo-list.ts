import type { Workspace } from "./contracts";

export type MemoListOptions = { query: string; inactive: boolean; month: number | null; axis: "entitlement" | "preparation"; tag: string; sort: "created_at" | "stock_code" | "display_name"; descending: boolean };
export function memoList(data: Pick<Workspace, "profiles" | "month_states" | "tags" | "profile_tags">, options: MemoListOptions) {
  const query = options.query.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
  const compare = new Intl.Collator("ja", { numeric: true }).compare;
  return data.profiles.filter(p => {
    if (!options.inactive && !p.active) return false;
    const months = data.month_states.filter(s => s.profile_id === p.id);
    const tags = data.profile_tags.filter(t => t.profile_id === p.id).map(t => t.tag_id);
    if (options.tag && !tags.includes(options.tag)) return false;
    if (options.axis === "preparation") {
      if (!months.some(s => s.preparation_months_before !== null &&
        (options.month === null || ((s.entitlement_month - 1 - s.preparation_months_before + 12) % 12) + 1 === options.month))) return false;
    } else if (options.month !== null && !months.some(s => s.entitlement_month === options.month)) return false;
    return [p.stock_code, p.display_name, p.memo, p.cross_strategy, p.entry_timing, p.tenure_rule,
      p.related_url, p.official_benefit_url, p.one_share_started_on, p.one_share_started_legacy_text,
      ...months.map(s => s.month_memo), ...data.tags.filter(t => tags.includes(t.id)).map(t => t.name)]
      .join(" ").normalize("NFKC").toLocaleLowerCase("ja-JP").includes(query);
  }).sort((a, b) => {
    const order = options.sort === "created_at" ? Date.parse(a.created_at) - Date.parse(b.created_at) : compare(a[options.sort], b[options.sort]);
    return (options.descending ? -order : order) || Date.parse(b.created_at) - Date.parse(a.created_at) || compare(a.id, b.id);
  });
}
