import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import {
  classifyFreshnessDate,
  getAgeDaysFromDate,
  jstDateString,
  type Freshness,
} from "./freshness";

export const metadata: Metadata = {
  title: "Admin Dashboard | mini-tools",
  description: "各ツールのデータソース・更新ルール・実更新日を確認する管理画面。",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin" },
};

// `dynamic = "force-dynamic"` は付けない:
// このページは cookies() を読むため自動的に動的レンダリング扱いになる。
// 一方 force-dynamic を付けると fetch の next.revalidate が事実上 no-store 化されて
// Data Cache が効かなくなり、リロード / タブ切替のたびに全 manifest を再取得してしまう。

// ============== Types ==============

type Category = "stocks" | "calendars" | "disclosures" | "yutai" | "credit" | "reference" | "local";

type Schedule =
  | { kind: "daily-cron"; description: string; expectedMaxDays: number }
  | { kind: "weekly-fixed"; weekday: number; description: string; expectedMaxDays: number } // 0=Sun..6=Sat
  | { kind: "weekly-task"; description: string; expectedMaxDays: number }
  | { kind: "monthly-start"; description: string; expectedMaxDays: number }
  | { kind: "manual-wrapper"; description: string; expectedMaxDays: null }
  | { kind: "ad-hoc"; description: string; expectedMaxDays: null }
  | { kind: "user-input"; description: string; expectedMaxDays: null };

type ToolRow = {
  name: string;
  href: string;
  source: string;
  rule: string;
  category: Category;
  schedule: Schedule;
  note?: string;
  latest?: string | null;
  freshnessDate?: string | null;
  fetchedAt?: string;
  /** manifest が dates[]/weeks[] を持つ場合の実履歴 (YYYY-MM-DD)。空配列 = 履歴なし */
  history?: string[];
};

// ============== Data Fetch Helpers ==============

async function fetchManifestLatest(
  endpoint: string,
  pick: (json: unknown) => string | null,
  pickHistory?: (json: unknown) => string[],
  options: { cache?: RequestCache; pickFreshnessDate?: (json: unknown) => string | null } = {},
): Promise<{ latest: string | null; freshnessDate: string | null; fetchedAt: string; history: string[] }> {
  const apiBase = getApiBaseUrl();
  const fetchedAt = new Date().toISOString();
  if (!apiBase) return { latest: null, freshnessDate: null, fetchedAt, history: [] };
  try {
    // 管理画面なので fresh 性より通信量を優先: 10 分 (600s) キャッシュ。
    // 1 ユーザー (= ほぼ自分のみ) が連続でタブを切替えても、各 manifest は 10 分に 1 回しか実 API を叩かない。
    // 例外: 2MB を超えるレスポンス (例: /stock-master/latest) は Data Cache に載らず
    // 「Failed to set Next.js data cache」を毎回吐くため、呼び出し側で cache:"no-store" を指定する。
    const json = await fetchJson<unknown>(`${apiBase}${endpoint}`, 600, { cache: options.cache });
    return {
      latest: pick(json),
      freshnessDate: options.pickFreshnessDate?.(json) ?? null,
      fetchedAt,
      history: pickHistory ? pickHistory(json) : [],
    };
  } catch {
    return { latest: null, freshnessDate: null, fetchedAt, history: [] };
  }
}

function pickDatesArray(obj: unknown, key: string): string[] {
  if (obj && typeof obj === "object" && key in obj) {
    const arr = (obj as Record<string, unknown>)[key];
    if (Array.isArray(arr)) {
      return arr.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
    }
  }
  return [];
}

function pickString(obj: unknown, key: string): string | null {
  if (obj && typeof obj === "object" && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/** 配列レスポンス (例: /stock-master/latest) の各要素から key を集め最大値を返す */
function pickArrayMaxField(obj: unknown, key: string): string | null {
  if (!Array.isArray(obj)) return null;
  const values = obj
    .map((record) =>
      record && typeof record === "object" && key in record
        ? (record as Record<string, unknown>)[key]
        : null,
    )
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  if (values.length === 0) return null;
  return values.reduce((max, current) => (current > max ? current : max));
}

function pickLatestDate(obj: unknown): string | null {
  if (obj && typeof obj === "object" && "dates" in obj) {
    const dates = (obj as Record<string, unknown>).dates;
    if (Array.isArray(dates)) {
      const stringDates = dates.filter((d): d is string => typeof d === "string");
      if (stringDates.length === 0) return null;
      return stringDates.reduce((max, current) => (current > max ? current : max));
    }
  }
  return null;
}

function pickInvestorFlowLatestStart(obj: unknown): string | null {
  if (obj && typeof obj === "object" && "latest" in obj) {
    const latest = (obj as Record<string, unknown>).latest;
    if (latest && typeof latest === "object" && "start_date" in latest) {
      const startDate = (latest as Record<string, unknown>).start_date;
      if (typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return startDate;
      }
    }
  }
  return null;
}

function pickInvestorFlowWeeks(obj: unknown): string[] {
  if (obj && typeof obj === "object" && "weeks" in obj) {
    const weeks = (obj as Record<string, unknown>).weeks;
    if (Array.isArray(weeks)) {
      return weeks
        .map((week) => {
          if (week && typeof week === "object" && "start_date" in week) {
            const startDate = (week as Record<string, unknown>).start_date;
            return typeof startDate === "string" ? startDate : null;
          }
          return null;
        })
        .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
    }
  }
  return [];
}

// ============== Schedule presets ==============

const SCHED_DAILY: Schedule = { kind: "daily-cron", description: "毎日 00:35 JST (econ_weekly_scrape_daily)", expectedMaxDays: 2 };
const SCHED_SAT: Schedule = { kind: "weekly-fixed", weekday: 6, description: "毎週土曜朝 手動 (run_nikko_inventory_and_publish.ps1)", expectedMaxDays: 8 };
const SCHED_SUN: Schedule = { kind: "weekly-fixed", weekday: 0, description: "毎週日曜朝 手動 (run_sbi_inventory_and_publish.ps1)", expectedMaxDays: 8 };
const SCHED_WEEKLY: Schedule = { kind: "weekly-task", description: "weekly task 運用", expectedMaxDays: 8 };
const SCHED_MONTHLY: Schedule = { kind: "monthly-start", description: "月初の手動月次 CLI", expectedMaxDays: 35 };
const SCHED_MANUAL_NAITO: Schedule = { kind: "manual-wrapper", description: "run_naito_and_backup.ps1 wrapper (手動)", expectedMaxDays: null };
const SCHED_AD_HOC: Schedule = { kind: "ad-hoc", description: "運用未確認", expectedMaxDays: null };
const SCHED_REF: Schedule = { kind: "ad-hoc", description: "随時参照データ", expectedMaxDays: null };
const SCHED_USER: Schedule = { kind: "user-input", description: "ユーザー入力 (ローカル保存)", expectedMaxDays: null };

// ============== Load rows ==============

async function loadRows(): Promise<ToolRow[]> {
  const [
    topix33, nikkei, stockRanking, usRanking,
    earningsDom, earningsOv, econ, edinet, yutai,
    marketCap, dividendYield, investorFlow,
  ] = await Promise.all([
    fetchManifestLatest("/topix33/manifest", (j) => pickString(j, "latest_date") ?? pickLatestDate(j), (j) => pickDatesArray(j, "dates")),
    fetchManifestLatest("/nikkei/manifest", (j) => pickString(j, "latest_date") ?? pickLatestDate(j), (j) => pickDatesArray(j, "dates")),
    fetchManifestLatest("/ranking/manifest", (j) => pickString(j, "latest") ?? pickLatestDate(j), (j) => pickDatesArray(j, "dates")),
    fetchManifestLatest("/us-ranking/manifest", (j) => pickString(j, "latest") ?? pickLatestDate(j), (j) => pickDatesArray(j, "dates")),
    fetchManifestLatest("/earnings-calendar/domestic/manifest", (j) => pickString(j, "as_of_date")),
    fetchManifestLatest("/earnings-calendar/overseas/manifest", (j) => pickString(j, "as_of_date")),
    fetchManifestLatest("/econ-calendar/weekly/manifest", (j) => pickString(j, "generated_at"), (j) => pickDatesArray(j, "weeks")),
    fetchManifestLatest("/edinet/document-list/manifest", (j) => pickLatestDate(j), (j) => pickDatesArray(j, "dates")),
    fetchManifestLatest("/yutai/manifest", (j) => pickString(j, "generated_at")),
    fetchManifestLatest("/market-rankings/market-cap/manifest", (j) => pickString(j, "generatedAt") ?? pickString(j, "latest")),
    fetchManifestLatest("/market-rankings/dividend-yield/manifest", (j) => pickString(j, "generatedAt") ?? pickString(j, "latest")),
    fetchManifestLatest(
      "/investor-flow/manifest",
      pickInvestorFlowLatestStart,
      pickInvestorFlowWeeks,
      { pickFreshnessDate: (j) => pickString(j, "generated_at_jst") },
    ),
  ]);
  const [nikkoCredit, sbiCredit, tdnet, jpxClosed, disclosureEvents, stockMaster] = await Promise.all([
    fetchManifestLatest("/nikko/credit", (j) => pickString(j, "date") ?? pickString(j, "generated_at")),
    fetchManifestLatest("/sbi/credit/latest", (j) => pickString(j, "date") ?? pickString(j, "generated_at")),
    fetchManifestLatest("/tdnet/disclosures/latest", (j) => pickString(j, "target_date")),
    fetchManifestLatest("/market-calendar/jpx-closed", (j) => pickString(j, "as_of_date")),
    fetchManifestLatest("/disclosure-events/manifest", (j) => pickString(j, "latest") ?? pickLatestDate(j), (j) => pickDatesArray(j, "dates")),
    fetchManifestLatest("/stock-master/latest", (j) => pickArrayMaxField(j, "as_of_date"), undefined, { cache: "no-store" }),
  ]);

  return [
    { category: "stocks", name: "TOPIX33業種", href: "/tools/topix33", source: "/topix33/manifest", rule: SCHED_MANUAL_NAITO.description, schedule: SCHED_MANUAL_NAITO, latest: topix33.latest, fetchedAt: topix33.fetchedAt, history: topix33.history },
    { category: "stocks", name: "日経225寄与度", href: "/tools/nikkei-contribution", source: "/nikkei/manifest", rule: SCHED_MANUAL_NAITO.description, schedule: SCHED_MANUAL_NAITO, latest: nikkei.latest, fetchedAt: nikkei.fetchedAt, history: nikkei.history },
    { category: "stocks", name: "株価ランキング", href: "/tools/stock-ranking", source: "/ranking/manifest", rule: SCHED_MANUAL_NAITO.description, schedule: SCHED_MANUAL_NAITO, latest: stockRanking.latest, fetchedAt: stockRanking.fetchedAt, history: stockRanking.history },
    { category: "stocks", name: "米国株ランキング", href: "/tools/us-stock-ranking", source: "/us-ranking/manifest", rule: "生成は --with-us-ranking。publish 運用は要確認。", schedule: SCHED_AD_HOC, latest: usRanking.latest, fetchedAt: usRanking.fetchedAt, history: usRanking.history },
    { category: "stocks", name: "市場ランキング (時価総額)", href: "/tools/market-rankings", source: "/market-rankings/market-cap/manifest", rule: SCHED_MONTHLY.description, schedule: SCHED_MONTHLY, latest: marketCap.latest, fetchedAt: marketCap.fetchedAt },
    { category: "stocks", name: "市場ランキング (配当利回り)", href: "/tools/market-rankings", source: "/market-rankings/dividend-yield/manifest", rule: SCHED_MONTHLY.description, schedule: SCHED_MONTHLY, latest: dividendYield.latest, fetchedAt: dividendYield.fetchedAt },
    { category: "stocks", name: "投資主体別売買動向", href: "/tools/investor-flow", source: "/investor-flow/manifest", rule: SCHED_WEEKLY.description, schedule: SCHED_WEEKLY, latest: investorFlow.latest, freshnessDate: investorFlow.freshnessDate, fetchedAt: investorFlow.fetchedAt, history: investorFlow.history },

    { category: "calendars", name: "決算カレンダー (国内)", href: "/tools/earnings-calendar", source: "/earnings-calendar/domestic/manifest", rule: SCHED_WEEKLY.description, schedule: SCHED_WEEKLY, latest: earningsDom.latest, fetchedAt: earningsDom.fetchedAt },
    { category: "calendars", name: "決算カレンダー (海外)", href: "/tools/earnings-calendar", source: "/earnings-calendar/overseas/manifest", rule: SCHED_WEEKLY.description, schedule: SCHED_WEEKLY, latest: earningsOv.latest, fetchedAt: earningsOv.fetchedAt },
    { category: "calendars", name: "経済指標カレンダー", href: "/tools/econ-calendar", source: "/econ-calendar/weekly/manifest", rule: SCHED_DAILY.description, schedule: SCHED_DAILY, latest: econ.latest, fetchedAt: econ.fetchedAt, history: econ.history },

    { category: "disclosures", name: "EDINET書類一覧", href: "/tools/edinet-documents", source: "/edinet/document-list/manifest", rule: "運用要確認 (自動日次と断定しない)。", schedule: SCHED_AD_HOC, latest: edinet.latest, fetchedAt: edinet.fetchedAt, history: edinet.history },
    { category: "disclosures", name: "TDNET適時開示", href: "/tools/tdnet-disclosures", source: "/tdnet/disclosures/latest", rule: "運用要確認 (自動日次と断定しない)。", schedule: SCHED_AD_HOC, latest: tdnet.latest, fetchedAt: tdnet.fetchedAt },
    { category: "disclosures", name: "開示レーダー", href: "/tools/disclosure-radar", source: "/disclosure-events/manifest", rule: "運用要確認 (自動日次と断定しない)。", schedule: SCHED_AD_HOC, latest: disclosureEvents.latest, fetchedAt: disclosureEvents.fetchedAt, history: disclosureEvents.history },

    { category: "yutai", name: "優待カレンダー", href: "/tools/yutai-candidates", source: "/yutai/manifest", rule: "月次。運用詳細は market_info docs 参照。", schedule: SCHED_MONTHLY, latest: yutai.latest, fetchedAt: yutai.fetchedAt },

    { category: "credit", name: "日興一般信用在庫", href: "/tools/yutai-candidates", source: "/nikko/credit", rule: SCHED_SAT.description, schedule: SCHED_SAT, latest: nikkoCredit.latest, fetchedAt: nikkoCredit.fetchedAt },
    { category: "credit", name: "SBI一般信用在庫", href: "/tools/yutai-candidates", source: "/sbi/credit/latest", rule: SCHED_SUN.description, schedule: SCHED_SUN, latest: sbiCredit.latest, fetchedAt: sbiCredit.fetchedAt },

    { category: "reference", name: "JPX 祝日カレンダー", href: "/tools/earnings-calendar", source: "/market-calendar/jpx-closed", rule: SCHED_REF.description, schedule: SCHED_REF, latest: jpxClosed.latest, fetchedAt: jpxClosed.fetchedAt },
    { category: "reference", name: "銘柄マスタ (my-stocks)", href: "/tools/my-stocks", source: "/stock-master/latest", rule: "銘柄マスタ (決算予定/優待月/配当)。更新運用は要確認。", schedule: SCHED_AD_HOC, latest: stockMaster.latest, fetchedAt: stockMaster.fetchedAt },

    { category: "local", name: "合計計算", href: "/tools/total", source: "ブラウザ localStorage", rule: SCHED_USER.description, schedule: SCHED_USER },
    { category: "local", name: "文字数カウント", href: "/tools/charcount", source: "ブラウザ localStorage", rule: SCHED_USER.description, schedule: SCHED_USER },
    { category: "local", name: "株主優待期限帳", href: "/tools/yutai-expiry", source: "localStorage + scan (premium)", rule: SCHED_USER.description, schedule: SCHED_USER },
    { category: "local", name: "優待銘柄メモ帳", href: "/tools/yutai-memo", source: "ブラウザ localStorage", rule: SCHED_USER.description, schedule: SCHED_USER },
    { category: "local", name: "マイ株", href: "/tools/my-stocks", source: "localStorage + /stock-master/latest", rule: SCHED_USER.description, schedule: SCHED_USER },
  ];
}

// ============== Constants & helpers ==============

const CATEGORY_META: Record<Category, { label: string; accent: string }> = {
  stocks: { label: "Stocks", accent: "#6366f1" },
  calendars: { label: "Calendars", accent: "#f97316" },
  disclosures: { label: "Disclosures", accent: "#06b6d4" },
  yutai: { label: "Yutai", accent: "#ec4899" },
  credit: { label: "Credit", accent: "#8b5cf6" },
  reference: { label: "Reference", accent: "#14b8a6" },
  local: { label: "Local", accent: "#64748b" },
};

const FRESHNESS_META: Record<Freshness, { label: string; bg: string; fg: string; border: string; dot: string }> = {
  fresh: { label: "FRESH", bg: "rgba(16,185,129,0.12)", fg: "#34d399", border: "rgba(16,185,129,0.35)", dot: "#10b981" },
  recent: { label: "RECENT", bg: "rgba(59,130,246,0.12)", fg: "#60a5fa", border: "rgba(59,130,246,0.35)", dot: "#3b82f6" },
  stale: { label: "STALE", bg: "rgba(245,158,11,0.14)", fg: "#fbbf24", border: "rgba(245,158,11,0.4)", dot: "#f59e0b" },
  failed: { label: "FAILED", bg: "rgba(239,68,68,0.14)", fg: "#fca5a5", border: "rgba(239,68,68,0.4)", dot: "#ef4444" },
  none: { label: "N/A", bg: "rgba(148,163,184,0.10)", fg: "#94a3b8", border: "rgba(148,163,184,0.3)", dot: "#64748b" },
};

function classifyFreshness(row: ToolRow): Freshness {
  return classifyFreshnessDate(
    row.freshnessDate ?? row.latest,
    row.schedule.expectedMaxDays,
  );
}

function getAgeDays(row: ToolRow): number | null {
  const freshnessDate = row.freshnessDate ?? row.latest;
  if (!freshnessDate) return null;
  return getAgeDaysFromDate(freshnessDate);
}

function formatAge(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1d";
  return `${days}d`;
}

function formatLatest(value: string | null | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "取得失敗";
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return `${value.slice(0, 10)} ${value.slice(11, 16)}Z`;
    }
  }
  return value;
}

// ============== SLA computation ==============

type SlaStatus = "met" | "breach" | "no-sla";

function evaluateSla(row: ToolRow): { status: SlaStatus; overdueDays: number | null; expectedMaxDays: number | null } {
  const expectedMaxDays = row.schedule.expectedMaxDays;
  if (expectedMaxDays === null) return { status: "no-sla", overdueDays: null, expectedMaxDays: null };
  const age = getAgeDays(row);
  if (age === null) return { status: "breach", overdueDays: null, expectedMaxDays };
  if (age <= expectedMaxDays) return { status: "met", overdueDays: 0, expectedMaxDays };
  return { status: "breach", overdueDays: age - expectedMaxDays, expectedMaxDays };
}

function scheduleShort(schedule: Schedule): string {
  switch (schedule.kind) {
    case "daily-cron": return "Daily 00:35";
    case "weekly-fixed": return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][schedule.weekday] + " weekly";
    case "weekly-task": return "Weekly task";
    case "monthly-start": return "Monthly (early)";
    case "manual-wrapper": return "Manual";
    case "ad-hoc": return "Ad-hoc";
    case "user-input": return "User input";
  }
}

// ============== Tool ↔ Source mapping ==============

const TOOL_SOURCE_MAP: { tool: string; href: string; sources: string[] }[] = [
  { tool: "合計計算", href: "/tools/total", sources: [] },
  { tool: "文字数カウント", href: "/tools/charcount", sources: [] },
  { tool: "株主優待期限帳", href: "/tools/yutai-expiry", sources: ["localStorage + scan (premium)"] },
  { tool: "優待銘柄メモ帳", href: "/tools/yutai-memo", sources: [] },
  { tool: "優待カレンダー", href: "/tools/yutai-candidates", sources: ["/yutai/manifest", "/nikko/credit", "/sbi/credit/latest"] },
  { tool: "決算カレンダー", href: "/tools/earnings-calendar", sources: ["/earnings-calendar/domestic/manifest", "/earnings-calendar/overseas/manifest", "/market-calendar/jpx-closed"] },
  { tool: "経済指標カレンダー", href: "/tools/econ-calendar", sources: ["/econ-calendar/weekly/manifest"] },
  { tool: "市場ランキング", href: "/tools/market-rankings", sources: ["/market-rankings/market-cap/manifest", "/market-rankings/dividend-yield/manifest"] },
  { tool: "投資主体別売買動向", href: "/tools/investor-flow", sources: ["/investor-flow/manifest"] },
  { tool: "株価ランキング", href: "/tools/stock-ranking", sources: ["/ranking/manifest", "/market-calendar/jpx-closed"] },
  { tool: "米国株ランキング", href: "/tools/us-stock-ranking", sources: ["/us-ranking/manifest"] },
  { tool: "日経225寄与度", href: "/tools/nikkei-contribution", sources: ["/nikkei/manifest", "/market-calendar/jpx-closed"] },
  { tool: "TOPIX33業種", href: "/tools/topix33", sources: ["/topix33/manifest", "/market-calendar/jpx-closed"] },
  { tool: "EDINET", href: "/tools/edinet-documents", sources: ["/edinet/document-list/manifest"] },
  { tool: "TDNet", href: "/tools/tdnet-disclosures", sources: ["/tdnet/disclosures/latest"] },
  { tool: "開示レーダー", href: "/tools/disclosure-radar", sources: ["/disclosure-events/manifest"] },
  { tool: "マイ株", href: "/tools/my-stocks", sources: ["/stock-master/latest", "/yutai/manifest", "/earnings-calendar/domestic/manifest"] },
];

// ============== Small UI atoms ==============

function FreshnessPill({ row }: { row: ToolRow }) {
  const fm = FRESHNESS_META[classifyFreshness(row)];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px",
      borderRadius: 6, background: fm.bg, color: fm.fg, border: `1px solid ${fm.border}`,
      fontSize: 10, fontWeight: 800, letterSpacing: 0.6, fontFamily: "ui-monospace, SFMono-Regular, monospace",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: fm.dot, boxShadow: `0 0 6px ${fm.dot}` }} />
      {fm.label}
    </span>
  );
}

function Panel({ title, sub, children, span }: { title: string; sub?: string; children: ReactNode; span?: number }) {
  return (
    <section style={{
      gridColumn: span ? `span ${span}` : undefined,
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 1 }}>{title}</div>
        {sub ? <div style={{ fontSize: 10, color: "#64748b" }}>{sub}</div> : null}
      </div>
      {children}
    </section>
  );
}

// ============== View A: SLA Tracker ==============

function SlaView({ rows }: { rows: ToolRow[] }) {
  const evaluated = rows.map((row) => ({ row, sla: evaluateSla(row) }));
  const met = evaluated.filter((e) => e.sla.status === "met").length;
  const breached = evaluated.filter((e) => e.sla.status === "breach").length;
  const noSla = evaluated.filter((e) => e.sla.status === "no-sla").length;
  const totalWithSla = met + breached;
  const pctMet = totalWithSla > 0 ? Math.round((met / totalWithSla) * 100) : 0;

  const sorted = [...evaluated].sort((a, b) => {
    const order = (s: SlaStatus) => (s === "breach" ? 0 : s === "no-sla" ? 2 : 1);
    if (order(a.sla.status) !== order(b.sla.status)) return order(a.sla.status) - order(b.sla.status);
    return (b.sla.overdueDays ?? 0) - (a.sla.overdueDays ?? 0);
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* SLA Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.4fr", gap: 14 }}>
        <SlaStat label="SLA MET" value={`${met}/${totalWithSla}`} sub={`${pctMet}% within window`} color="#10b981" />
        <SlaStat label="BREACHED" value={String(breached)} sub={breached > 0 ? `avg overdue ${Math.round(evaluated.filter((e) => e.sla.status === "breach" && e.sla.overdueDays !== null).reduce((s, e) => s + (e.sla.overdueDays ?? 0), 0) / Math.max(1, breached))}d` : "all met"} color="#ef4444" />
        <SlaStat label="NO SLA" value={String(noSla)} sub="manual / ad-hoc / local" color="#64748b" />
        <div style={{
          padding: "16px 20px", borderRadius: 12,
          background: "linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(59,130,246,0.06) 100%)",
          border: "1px solid rgba(16,185,129,0.20)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.2, marginBottom: 6 }}>SLA COMPLIANCE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: "#f1f5f9", fontFamily: "ui-monospace, SFMono-Regular, monospace", lineHeight: 1 }}>{pctMet}</span>
            <span style={{ fontSize: 18, color: "#94a3b8", fontWeight: 700 }}>%</span>
            <span style={{ fontSize: 11, color: "#64748b", marginLeft: "auto" }}>(of {totalWithSla} tracked sources with SLA)</span>
          </div>
          <div style={{ marginTop: 8, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pctMet}%`, background: "linear-gradient(90deg, #10b981, #34d399)" }} />
          </div>
        </div>
      </div>

      {/* SLA list */}
      <Panel title="SOURCES SORTED BY BREACH SEVERITY" sub="breached → met → no SLA">
        <div style={{ display: "grid", gap: 10 }}>
          {sorted.map(({ row, sla }) => {
            const age = getAgeDays(row);
            const isBreach = sla.status === "breach";
            const isMet = sla.status === "met";
            const fillPct = sla.expectedMaxDays && age !== null
              ? Math.min(100, (age / sla.expectedMaxDays) * 100)
              : 0;
            const overPct = isBreach && sla.expectedMaxDays && age !== null
              ? Math.min(100, ((age - sla.expectedMaxDays) / sla.expectedMaxDays) * 100)
              : 0;

            return (
              <div key={`${row.name}-${row.source}`} style={{
                padding: "12px 14px",
                background: isBreach ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.015)",
                border: `1px solid ${isBreach ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 10,
                display: "grid",
                gridTemplateColumns: "minmax(220px, 26%) minmax(180px, 22%) 1fr 70px",
                alignItems: "center",
                gap: 14,
              }}>
                <div>
                  <Link href={row.href} style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", textDecoration: "none", letterSpacing: -0.2, display: "block", marginBottom: 3 }}>
                    {isBreach ? "✗ " : isMet ? "✓ " : "○ "}
                    {row.name}
                  </Link>
                  <code style={{ fontSize: 10.5, color: "#94a3b8", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                    {row.source}
                  </code>
                </div>
                <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 700, color: "#94a3b8", fontSize: 10, marginBottom: 2 }}>EXPECTED</div>
                  {row.schedule.description}
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: "#94a3b8" }}>
                      {row.freshnessDate ? "Latest week: " : "Last: "}
                      <span style={{ color: "#f1f5f9", fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{formatLatest(row.latest)}</span>
                      {row.freshnessDate ? (
                        <span style={{ color: "#64748b", marginLeft: 8 }}>
                          Published: {formatLatest(row.freshnessDate)} ({formatAge(age)} ago)
                        </span>
                      ) : (
                        <span style={{ color: "#64748b", marginLeft: 6 }}>({formatAge(age)} ago)</span>
                      )}
                    </span>
                    {sla.status === "no-sla" ? (
                      <span style={{ color: "#64748b", fontSize: 10, fontWeight: 800 }}>NO SLA</span>
                    ) : sla.status === "met" ? (
                      <span style={{ color: "#34d399", fontSize: 10, fontWeight: 800 }}>✓ within {sla.expectedMaxDays}d</span>
                    ) : (
                      <span style={{ color: "#fca5a5", fontSize: 10, fontWeight: 800 }}>
                        ✗ +{sla.overdueDays !== null ? `${sla.overdueDays}d` : "—"} overdue (max {sla.expectedMaxDays}d)
                      </span>
                    )}
                  </div>
                  <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                    {sla.status !== "no-sla" ? (
                      <>
                        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${fillPct}%`, background: isBreach ? "#f59e0b" : "#10b981", opacity: 0.85 }} />
                        {overPct > 0 ? (
                          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: `${overPct}%`, background: "#ef4444", opacity: 0.9 }} />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <FreshnessPill row={row} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function SlaStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      padding: "16px 20px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.2 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#f1f5f9", fontFamily: "ui-monospace, SFMono-Regular, monospace", letterSpacing: -0.8, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>{sub}</div>
    </div>
  );
}

// ============== View B: 14-day Heatmap ==============

function HeatmapView({ rows }: { rows: ToolRow[] }) {
  const DAYS = 14;
  // JST 基準で今日 00:00 を起点にする
  const todayJst = jstDateString();
  const today = new Date(`${todayJst}T00:00:00Z`);

  const days: { date: string; dow: number; dom: number; month: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      dow: d.getUTCDay(),
      dom: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
    });
  }

  const dynamicRows = rows.filter((r) => r.schedule.kind !== "user-input");

  function isExpectedUpdate(schedule: Schedule, day: { dow: number; dom: number }): boolean {
    switch (schedule.kind) {
      case "daily-cron": return true;
      case "weekly-fixed": return day.dow === schedule.weekday;
      case "weekly-task": return day.dow === 5; // 金曜にマーク (推定)
      case "monthly-start": return day.dom <= 7;
      default: return false;
    }
  }

  return (
    <Panel title="14-DAY UPDATE PATTERN" sub="row = source, col = day. Marks = expected. Highlight = actual latest.">
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: "4px 4px", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: "4px 8px", textAlign: "left", fontSize: 10, color: "#64748b", fontWeight: 800, letterSpacing: 0.5 }}>SOURCE</th>
              {days.map((d, idx) => (
                <th key={d.date} style={{
                  padding: 2, fontSize: 9, color: "#64748b", fontWeight: 700,
                  width: 32, textAlign: "center",
                }}>
                  <div style={{ color: d.dow === 0 || d.dow === 6 ? "#94a3b8" : "#475569" }}>{["日","月","火","水","木","金","土"][d.dow]}</div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", color: idx === days.length - 1 ? "#fbbf24" : "#64748b" }}>{d.dom}</div>
                </th>
              ))}
              <th style={{ padding: "4px 6px", fontSize: 10, color: "#64748b", fontWeight: 800, letterSpacing: 0.5 }}>RULE</th>
            </tr>
          </thead>
          <tbody>
            {dynamicRows.map((row) => {
              const fm = FRESHNESS_META[classifyFreshness(row)];
              const latestDay = row.latest ? row.latest.slice(0, 10) : null;
              const historySet = new Set((row.history ?? []).map((d) => d.slice(0, 10)));
              const hasHistory = historySet.size > 0;
              return (
                <tr key={`${row.name}-${row.source}`}>
                  <td style={{ padding: "0 8px 0 0", color: "#cbd5e1", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                    <Link href={row.href} style={{ color: "#cbd5e1", textDecoration: "none" }}>{row.name}</Link>
                  </td>
                  {days.map((d) => {
                    const expected = isExpectedUpdate(row.schedule, d);
                    // 履歴がある場合: 該当日があれば実更新あり扱い
                    // 履歴がない場合: 最新日のみ点灯
                    const isActual = hasHistory ? historySet.has(d.date) : latestDay === d.date;
                    const isLatest = latestDay === d.date;
                    return (
                      <td key={d.date} style={{ padding: 0 }}>
                        <div
                          title={`${d.date}${expected ? " (expected)" : ""}${isActual ? " · actual update" : ""}${isLatest ? " · latest" : ""}`}
                          style={{
                            width: 28, height: 22, borderRadius: 4,
                            background: isActual
                              ? fm.dot
                              : expected
                                ? "rgba(99,102,241,0.20)"
                                : "rgba(255,255,255,0.025)",
                            border: isActual
                              ? `1px solid ${fm.dot}`
                              : expected
                                ? "1px solid rgba(99,102,241,0.45)"
                                : "1px solid rgba(255,255,255,0.04)",
                            boxShadow: isLatest && isActual ? `0 0 8px ${fm.dot}` : "none",
                            opacity: isActual && !isLatest ? 0.7 : 1,
                          }}
                        />
                      </td>
                    );
                  })}
                  <td style={{ padding: "0 0 0 6px", fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>
                    <div>{scheduleShort(row.schedule)}</div>
                    <div style={{ marginTop: 2, color: hasHistory ? "#34d399" : "#fbbf24" }}>
                      {hasHistory ? `history ${historySet.size}` : "no history"}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 10, color: "#64748b", flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "rgba(99,102,241,0.20)", border: "1px solid rgba(99,102,241,0.45)", marginRight: 5, verticalAlign: "middle" }} />expected update</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#10b981", boxShadow: "0 0 6px #10b981", marginRight: 5, verticalAlign: "middle" }} />actual latest</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#10b981", opacity: 0.7, marginRight: 5, verticalAlign: "middle" }} />actual past update (manifest.dates / weeks)</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)", marginRight: 5, verticalAlign: "middle" }} />no update</span>
        <span style={{ color: "#34d399" }}>history N = manifest 由来の実更新日数</span>
        <span style={{ color: "#fbbf24" }}>no history = latest 1点のみ (信用/TDNet/JPX/yutai/月次系)</span>
      </div>
    </Panel>
  );
}

// ============== View C: Weekly Schedule ==============

function ScheduleView({ rows }: { rows: ToolRow[] }) {
  const todayJst = jstDateString();
  const today = new Date(`${todayJst}T00:00:00Z`);
  const todayDow = today.getUTCDay();
  const dayLabels = ["日","月","火","水","木","金","土"];

  // 各曜日 → schedule に該当するソース
  const weekly: Record<number, ToolRow[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const daily: ToolRow[] = [];
  const weeklyTask: ToolRow[] = [];
  const monthly: ToolRow[] = [];
  const manual: ToolRow[] = [];
  const adhoc: ToolRow[] = [];
  const local: ToolRow[] = [];

  for (const r of rows) {
    switch (r.schedule.kind) {
      case "daily-cron": daily.push(r); break;
      case "weekly-fixed": weekly[r.schedule.weekday].push(r); break;
      case "weekly-task": weeklyTask.push(r); break;
      case "monthly-start": monthly.push(r); break;
      case "manual-wrapper": manual.push(r); break;
      case "ad-hoc": adhoc.push(r); break;
      case "user-input": local.push(r); break;
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Today */}
      <Panel title={`TODAY · ${todayJst} (${dayLabels[todayDow]}) JST`} sub="今日 fire するスケジュール">
        <div style={{ display: "grid", gap: 8 }}>
          {daily.map((r) => <ScheduleItem key={r.source} row={r} when="毎日 00:35 JST" />)}
          {weekly[todayDow].map((r) => <ScheduleItem key={r.source} row={r} when={`${dayLabels[todayDow]}曜朝 (週次)`} />)}
          {daily.length + weekly[todayDow].length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 12 }}>今日 fire するスケジュールはなし</div>
          ) : null}
        </div>
      </Panel>

      {/* This week (Sun-Sat grid) */}
      <Panel title="THIS WEEK" sub="曜日ごとの定期実行スケジュール">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {[0,1,2,3,4,5,6].map((dow) => {
            const items = weekly[dow];
            const isToday = dow === todayDow;
            const isWeekend = dow === 0 || dow === 6;
            return (
              <div key={dow} style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: isToday ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isToday ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.05)"}`,
                minHeight: 92,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: isWeekend ? "#fbbf24" : "#94a3b8", letterSpacing: 0.5, marginBottom: 8 }}>
                  {dayLabels[dow]}{isToday ? " · TODAY" : ""}
                </div>
                {items.length === 0 ? (
                  <div style={{ fontSize: 10, color: "#475569" }}>—</div>
                ) : items.map((r) => (
                  <div key={r.source} style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 4, lineHeight: 1.4 }}>
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: CATEGORY_META[r.category].accent, marginRight: 5 }} />
                    {r.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {weeklyTask.length > 0 ? (
          <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.20)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#fb923c", letterSpacing: 0.5, marginBottom: 6 }}>WEEKLY TASK (曜日指定なし)</div>
            {weeklyTask.map((r) => (
              <div key={r.source} style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 3 }}>
                <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: CATEGORY_META[r.category].accent, marginRight: 5 }} />
                {r.name}
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      {/* Monthly / Manual / Ad-hoc / Local */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="MONTHLY (月初付近)">
          {monthly.length === 0 ? <div style={{ color: "#64748b", fontSize: 12 }}>—</div> :
            monthly.map((r) => (
              <div key={r.source} style={{ padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "#cbd5e1" }}>
                <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: CATEGORY_META[r.category].accent, marginRight: 6 }} />
                {r.name}
                <code style={{ marginLeft: 8, fontSize: 10, color: "#64748b" }}>{r.source}</code>
              </div>
            ))
          }
        </Panel>

        <Panel title="MANUAL · AD-HOC · LOCAL">
          {[...manual.map((r) => ({ r, label: "manual" })), ...adhoc.map((r) => ({ r, label: "ad-hoc" })), ...local.map((r) => ({ r, label: "local" }))].map(({ r, label }) => (
            <div key={`${r.href}-${r.name}-${label}`} style={{ padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "#cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: CATEGORY_META[r.category].accent, marginRight: 6 }} />
                {r.name}
              </span>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: 0.6, padding: "2px 6px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>{label.toUpperCase()}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function ScheduleItem({ row, when }: { row: ToolRow; when: string }) {
  const sla = evaluateSla(row);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px",
      background: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_META[row.category].accent }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>{row.name}</div>
        <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>{when} · last: {formatLatest(row.latest)} ({formatAge(getAgeDays(row))} ago)</div>
      </div>
      {sla.status === "breach" ? (
        <span style={{ fontSize: 10, fontWeight: 800, color: "#fca5a5", padding: "3px 8px", borderRadius: 4, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)" }}>
          OVERDUE +{sla.overdueDays ?? "—"}d
        </span>
      ) : sla.status === "met" ? (
        <span style={{ fontSize: 10, fontWeight: 800, color: "#34d399" }}>✓ on track</span>
      ) : null}
    </div>
  );
}

// ============== View D: Dependency Map ==============

function LineageView({ rows }: { rows: ToolRow[] }) {
  const rowBySource = new Map(rows.map((r) => [r.source, r]));
  const toolH = 32;
  const sourceH = 32;
  const gap = 6;
  const tools = TOOL_SOURCE_MAP.filter((t) => t.sources.length > 0);
  const sources = rows.filter((r) => r.schedule.kind !== "user-input").map((r) => r.source);
  const uniqueSources = Array.from(new Set([...sources, ...tools.flatMap((t) => t.sources)]));

  const W = 1200;
  const colToolX = 0;
  const colToolW = 280;
  const colSourceX = W - 360;
  const colSourceW = 360;
  const H = Math.max(tools.length, uniqueSources.length) * (toolH + gap) + 40;

  const toolY: Record<string, number> = {};
  tools.forEach((t, i) => { toolY[t.tool] = 20 + i * (toolH + gap) + toolH / 2; });
  const sourceY: Record<string, number> = {};
  uniqueSources.forEach((s, i) => { sourceY[s] = 20 + i * (sourceH + gap) + sourceH / 2; });

  return (
    <Panel title="TOOL ↔ SOURCE DEPENDENCY MAP" sub="ソース障害時の影響ツールを可視化。色 = ソースの freshness">
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Dependency map">
          {/* lines */}
          {tools.flatMap((t) =>
            t.sources.map((s) => {
              const y1 = toolY[t.tool];
              const y2 = sourceY[s];
              const x1 = colToolX + colToolW;
              const x2 = colSourceX;
              const mid = (x1 + x2) / 2;
              const path = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
              const row = rowBySource.get(s);
              const fm = row ? FRESHNESS_META[classifyFreshness(row)] : FRESHNESS_META.none;
              return (
                <path
                  key={`${t.tool}-${s}`}
                  d={path}
                  stroke={fm.dot}
                  strokeWidth={1.2}
                  fill="none"
                  opacity={0.5}
                />
              );
            }),
          )}

          {/* tool labels */}
          {tools.map((t) => (
            <g key={`tool-${t.tool}`}>
              <rect x={colToolX} y={toolY[t.tool] - toolH / 2} width={colToolW} height={toolH} rx={6} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
              <text x={colToolX + 14} y={toolY[t.tool] + 5} fill="#f1f5f9" fontSize={13} fontWeight={700}>{t.tool}</text>
            </g>
          ))}

          {/* source nodes */}
          {uniqueSources.map((s) => {
            const row = rowBySource.get(s);
            const fm = row ? FRESHNESS_META[classifyFreshness(row)] : FRESHNESS_META.none;
            const age = row ? getAgeDays(row) : null;
            const y = sourceY[s];
            return (
              <g key={`src-${s}`}>
                <rect x={colSourceX} y={y - sourceH / 2} width={colSourceW} height={sourceH} rx={6} fill={fm.bg} stroke={fm.border} />
                <circle cx={colSourceX + 14} cy={y} r={5} fill={fm.dot} />
                <text x={colSourceX + 26} y={y + 5} fill="#e2e8f0" fontSize={12} fontFamily="ui-monospace, SFMono-Regular, monospace">{s}</text>
                <text x={colSourceX + colSourceW - 14} y={y + 5} fill={fm.fg} fontSize={11} fontWeight={800} textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, monospace">
                  {row ? formatAge(age) : "N/A"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Failure impact analysis */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>
          IF SOURCE FAILS → AFFECTED TOOLS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {uniqueSources.map((s) => {
            const affected = tools.filter((t) => t.sources.includes(s));
            const row = rowBySource.get(s);
            const fm = row ? FRESHNESS_META[classifyFreshness(row)] : FRESHNESS_META.none;
            return (
              <div key={s} style={{
                padding: "10px 12px",
                background: "rgba(255,255,255,0.015)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                borderLeft: `3px solid ${fm.dot}`,
              }}>
                <code style={{ fontSize: 11, color: "#e2e8f0", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{s}</code>
                <div style={{ marginTop: 6, fontSize: 11, color: "#cbd5e1", lineHeight: 1.55 }}>
                  {affected.length === 0 ? (
                    <span style={{ color: "#64748b" }}>(no tool depends on this)</span>
                  ) : (
                    affected.map((t, idx) => (
                      <span key={t.tool}>
                        <Link href={t.href} style={{ color: "#cbd5e1", textDecoration: "none" }}>{t.tool}</Link>
                        {idx < affected.length - 1 ? <span style={{ color: "#475569" }}> · </span> : null}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

// ============== PageBg & Layout ==============

const pageBg: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(ellipse 1200px 600px at 20% -10%, rgba(99,102,241,0.18) 0%, transparent 60%)," +
    "radial-gradient(ellipse 900px 500px at 100% 10%, rgba(14,165,233,0.14) 0%, transparent 55%)," +
    "linear-gradient(180deg, #050816 0%, #0a0f1f 60%, #060912 100%)",
  color: "#e2e8f0",
  paddingBottom: 80,
};

type ViewKey = "sla" | "heatmap" | "schedule" | "lineage";

const VIEWS: { key: ViewKey; label: string; sub: string }[] = [
  { key: "sla", label: "A · SLA Tracker", sub: "expected vs actual" },
  { key: "heatmap", label: "B · 14-day Heatmap", sub: "source × day" },
  { key: "schedule", label: "C · Weekly Schedule", sub: "today / this week" },
  { key: "lineage", label: "D · Dependency Map", sub: "tool ↔ source" },
];

function parseView(value: string | string[] | undefined): ViewKey {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "heatmap" || v === "schedule" || v === "lineage" || v === "sla") return v;
  return "sla";
}

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/admin")}`);
  }

  const resolved = await searchParams;
  const view = parseView(resolved?.view);
  const rows = await loadRows();
  const apiBase = getApiBaseUrl();
  const nowIso = new Date().toISOString().slice(0, 19).replace("T", " ") + "Z";

  return (
    <>
      <style>{`
        .admin-pc { display: block; }
        .admin-mobile { display: none; }
        @media (max-width: 820px) {
          .admin-pc { display: none; }
          .admin-mobile { display: block; }
        }
        .tab-link { transition: background 0.12s, color 0.12s; }
        .tab-link:hover { background: rgba(99,102,241,0.10); color: #f1f5f9 !important; }
      `}</style>

      <div className="admin-pc" style={pageBg}>
        <main style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 28px 0" }}>
          {/* Header */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "5px 11px", borderRadius: 6,
                background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
                border: "1px solid rgba(99,102,241,0.30)",
                fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                ADMIN · NOINDEX
              </span>
              <Link href="/premium" style={{ fontSize: 11, color: "#94a3b8", textDecoration: "none", padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                ← /premium
              </Link>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#f1f5f9", letterSpacing: -0.4, marginLeft: 8 }}>
                Data Update Console
              </h1>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#64748b", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
              <span>API <span style={{ color: "#cbd5e1" }}>{apiBase || "(未設定)"}</span></span>
              <span>NOW {nowIso}</span>
            </div>
          </header>

          {/* Tabs */}
          <nav style={{ display: "flex", gap: 4, marginBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {VIEWS.map((v) => {
              const isActive = v.key === view;
              return (
                <Link
                  key={v.key}
                  href={`/admin?view=${v.key}`}
                  className="tab-link"
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px 8px 0 0",
                    textDecoration: "none",
                    color: isActive ? "#f1f5f9" : "#64748b",
                    background: isActive ? "rgba(99,102,241,0.10)" : "transparent",
                    borderTop: isActive ? "1px solid rgba(99,102,241,0.35)" : "1px solid transparent",
                    borderLeft: isActive ? "1px solid rgba(99,102,241,0.20)" : "1px solid transparent",
                    borderRight: isActive ? "1px solid rgba(99,102,241,0.20)" : "1px solid transparent",
                    borderBottom: isActive ? "1px solid #050816" : "1px solid transparent",
                    marginBottom: -1,
                    display: "block",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -0.2 }}>{v.label}</div>
                  <div style={{ fontSize: 10, color: isActive ? "#a5b4fc" : "#475569", marginTop: 2, letterSpacing: 0.4 }}>{v.sub}</div>
                </Link>
              );
            })}
          </nav>

          {/* View body */}
          {view === "sla" ? <SlaView rows={rows} /> : null}
          {view === "heatmap" ? <HeatmapView rows={rows} /> : null}
          {view === "schedule" ? <ScheduleView rows={rows} /> : null}
          {view === "lineage" ? <LineageView rows={rows} /> : null}

          {/* Footer */}
          <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
            <div>FRESH ≤ 2日 · RECENT ≤ 7日 · STALE &gt; 7日 · FAILED = 取得不可 · N/A = ローカル保存のみ</div>
            <div>SLA 判定は schedule.expectedMaxDays を上限に age と比較。manual / ad-hoc / user-input は SLA 対象外。</div>
            <div style={{ marginTop: 4 }}>出典: market_info repo の docs/operations/monthly_operations.md / docs/reference/policy_decision_rules.md / policy_decision_log.md / publish_contract_inventory.md / cli_inventory.md</div>
          </footer>
        </main>
      </div>

      {/* Mobile (unchanged simple table) */}
      <div className="admin-mobile">
        <MobileAdmin rows={rows} apiBase={apiBase} nowIso={nowIso} />
      </div>
    </>
  );
}

// ============== Mobile (light, simple 3-col table) ==============

const mobileTh: CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: 0.4,
  borderBottom: "1px solid #e2e8f0",
};

const mobileTd: CSSProperties = {
  padding: "10px",
  verticalAlign: "top",
  fontSize: 11,
};

const CATEGORY_LABEL_JA: Record<Category, string> = {
  stocks: "株式データ",
  calendars: "カレンダー",
  disclosures: "開示",
  yutai: "優待",
  credit: "信用 (一般信用在庫)",
  reference: "参照データ",
  local: "ローカル保存のみ",
};

function MobileFreshDot({ row }: { row: ToolRow }) {
  const fm = FRESHNESS_META[classifyFreshness(row)];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: "#475569" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: fm.dot }} />
      {fm.label}
    </span>
  );
}

function MobileAdmin({ rows, apiBase, nowIso }: { rows: ToolRow[]; apiBase: string; nowIso: string }) {
  const categories: Category[] = ["stocks", "calendars", "disclosures", "yutai", "credit", "reference", "local"];
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 14px 64px", color: "#0f172a" }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, background: "#eef2ff", color: "#3730a3", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>
          ADMIN · NOINDEX
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>データ更新ダッシュボード</h1>
        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
          <div>API: <code>{apiBase || "(未設定)"}</code></div>
          <div>取得時刻: <code>{nowIso}</code></div>
          <div style={{ marginTop: 4 }}>
            <Link href="/premium" style={{ color: "#2554ff" }}>← /premium に戻る</Link>
          </div>
        </div>
      </header>

      {categories.map((cat) => {
        const catRows = rows.filter((r) => r.category === cat);
        if (catRows.length === 0) return null;
        return (
          <section key={cat} style={{ marginBottom: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>
              {CATEGORY_LABEL_JA[cat]} ({catRows.length})
            </h2>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ ...mobileTh, width: "40%" }}>ツール / ソース</th>
                    <th style={{ ...mobileTh, width: "22%" }}>最終更新</th>
                    <th style={{ ...mobileTh, width: "38%" }}>運用ルール</th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map((row) => (
                    <tr key={`${row.name}-${row.source}`} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={mobileTd}>
                        <Link href={row.href} style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", textDecoration: "none", display: "block", marginBottom: 3 }}>{row.name}</Link>
                        <code style={{ fontSize: 10, color: "#94a3b8", wordBreak: "break-all", display: "block" }}>{row.source}</code>
                      </td>
                      <td style={mobileTd}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, monospace", lineHeight: 1.3, marginBottom: 4, wordBreak: "break-all" }}>
                          {formatLatest(row.latest)}
                        </div>
                        <MobileFreshDot row={row} />
                      </td>
                      <td style={{ ...mobileTd, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{row.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <footer style={{ marginTop: 20, fontSize: 10, color: "#94a3b8", lineHeight: 1.7 }}>
        <div>FRESH (≤2日) / RECENT (≤7日) / STALE (&gt;7日) / FAILED (取得不可) / N/A (ローカル保存のみ)</div>
        <div style={{ marginTop: 4 }}>出典: market_info repo の docs/operations & docs/reference 配下</div>
      </footer>
    </main>
  );
}
