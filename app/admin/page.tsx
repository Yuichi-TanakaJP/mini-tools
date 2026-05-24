import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { fetchJson, getApiBaseUrl } from "@/lib/market-api";

export const metadata: Metadata = {
  title: "Admin Dashboard | mini-tools",
  description: "各ツールのデータソース・更新ルール・実更新日を確認する管理画面。",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin" },
};

export const dynamic = "force-dynamic";

type Category =
  | "stocks"
  | "calendars"
  | "disclosures"
  | "yutai"
  | "credit"
  | "reference"
  | "local";

type ToolRow = {
  name: string;
  href: string;
  source: string;
  rule: string;
  category: Category;
  note?: string;
  /** 動的取得済みの最終更新日 (YYYY-MM-DD)。null = 取得失敗、undefined = 動的取得対象外 */
  latest?: string | null;
  fetchedAt?: string;
};

type ManifestFetchResult = {
  latest: string | null;
  fetchedAt: string;
};

async function fetchManifestLatest(
  endpoint: string,
  pick: (json: unknown) => string | null,
): Promise<ManifestFetchResult> {
  const apiBase = getApiBaseUrl();
  const fetchedAt = new Date().toISOString();
  if (!apiBase) return { latest: null, fetchedAt };
  try {
    const json = await fetchJson<unknown>(`${apiBase}${endpoint}`, 60);
    return { latest: pick(json), fetchedAt };
  } catch {
    return { latest: null, fetchedAt };
  }
}

function pickString(obj: unknown, key: string): string | null {
  if (obj && typeof obj === "object" && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
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

async function loadRows(): Promise<ToolRow[]> {
  const [
    topix33,
    nikkei,
    stockRanking,
    usRanking,
    earningsDom,
    earningsOv,
    econ,
    edinet,
    yutai,
    marketCap,
    dividendYield,
  ] = await Promise.all([
    fetchManifestLatest("/topix33/manifest", (j) => pickString(j, "latest_date") ?? pickLatestDate(j)),
    fetchManifestLatest("/nikkei/manifest", (j) => pickString(j, "latest_date") ?? pickLatestDate(j)),
    fetchManifestLatest("/ranking/manifest", (j) => pickString(j, "latest") ?? pickLatestDate(j)),
    fetchManifestLatest("/us-ranking/manifest", (j) => pickString(j, "latest") ?? pickLatestDate(j)),
    fetchManifestLatest("/earnings-calendar/domestic/manifest", (j) => pickString(j, "as_of_date")),
    fetchManifestLatest("/earnings-calendar/overseas/manifest", (j) => pickString(j, "as_of_date")),
    fetchManifestLatest("/econ-calendar/weekly/manifest", (j) => pickString(j, "generated_at")),
    fetchManifestLatest("/edinet/document-list/manifest", (j) => pickLatestDate(j)),
    fetchManifestLatest("/yutai/manifest", (j) => pickString(j, "generated_at")),
    fetchManifestLatest("/market-rankings/market-cap/manifest", (j) => pickString(j, "generatedAt") ?? pickString(j, "latest")),
    fetchManifestLatest("/market-rankings/dividend-yield/manifest", (j) => pickString(j, "generatedAt") ?? pickString(j, "latest")),
  ]);

  const [nikkoCredit, sbiCredit, tdnet, jpxClosed] = await Promise.all([
    fetchManifestLatest("/nikko/credit", (j) => pickString(j, "date") ?? pickString(j, "generated_at")),
    fetchManifestLatest("/sbi/credit/latest", (j) => pickString(j, "date") ?? pickString(j, "generated_at")),
    fetchManifestLatest("/tdnet/disclosures/latest", (j) => pickString(j, "target_date")),
    fetchManifestLatest("/market-calendar/jpx-closed", (j) => pickString(j, "as_of_date")),
  ]);

  return [
    // 株式データ
    { category: "stocks", name: "TOPIX33業種", href: "/tools/topix33", source: "/topix33/manifest", rule: "手動運用: run_naito_and_backup.ps1 wrapper で生成。自動日次は未確認。", latest: topix33.latest, fetchedAt: topix33.fetchedAt },
    { category: "stocks", name: "日経225寄与度", href: "/tools/nikkei-contribution", source: "/nikkei/manifest", rule: "手動運用: run_naito_and_backup.ps1 wrapper で生成。自動日次は未確認。", latest: nikkei.latest, fetchedAt: nikkei.fetchedAt },
    { category: "stocks", name: "株価ランキング", href: "/tools/stock-ranking", source: "/ranking/manifest", rule: "手動運用: run_naito_and_backup.ps1 wrapper で生成。自動日次は未確認。", latest: stockRanking.latest, fetchedAt: stockRanking.fetchedAt },
    { category: "stocks", name: "米国株ランキング", href: "/tools/us-stock-ranking", source: "/us-ranking/manifest", rule: "生成は --with-us-ranking。publish 運用は要確認 (日次自動と断定しない)。", latest: usRanking.latest, fetchedAt: usRanking.fetchedAt },
    { category: "stocks", name: "市場ランキング (時価総額)", href: "/tools/market-rankings", source: "/market-rankings/market-cap/manifest", rule: "月初の手動月次 CLI 運用。", latest: marketCap.latest, fetchedAt: marketCap.fetchedAt },
    { category: "stocks", name: "市場ランキング (配当利回り)", href: "/tools/market-rankings", source: "/market-rankings/dividend-yield/manifest", rule: "月初の手動月次 CLI 運用。", latest: dividendYield.latest, fetchedAt: dividendYield.fetchedAt },

    // カレンダー
    { category: "calendars", name: "決算カレンダー (国内)", href: "/tools/earnings-calendar", source: "/earnings-calendar/domestic/manifest", rule: "market_info 側は weekly task 運用。日次更新ではない。", latest: earningsDom.latest, fetchedAt: earningsDom.fetchedAt },
    { category: "calendars", name: "決算カレンダー (海外)", href: "/tools/earnings-calendar", source: "/earnings-calendar/overseas/manifest", rule: "market_info 側は weekly task 運用。日次更新ではない。", latest: earningsOv.latest, fetchedAt: earningsOv.fetchedAt },
    { category: "calendars", name: "経済指標カレンダー", href: "/tools/econ-calendar", source: "/econ-calendar/weekly/manifest", rule: "econ_weekly_scrape_daily が毎日 00:35 に週次 JSON を更新。", latest: econ.latest, fetchedAt: econ.fetchedAt },

    // 開示
    { category: "disclosures", name: "EDINET書類一覧", href: "/tools/edinet-documents", source: "/edinet/document-list/manifest", rule: "運用要確認 (自動日次と断定しない)。", latest: edinet.latest, fetchedAt: edinet.fetchedAt },
    { category: "disclosures", name: "TDNET適時開示", href: "/tools/tdnet-disclosures", source: "/tdnet/disclosures/latest", rule: "運用要確認 (自動日次と断定しない)。", latest: tdnet.latest, fetchedAt: tdnet.fetchedAt },

    // 優待
    { category: "yutai", name: "優待カレンダー", href: "/tools/yutai-candidates", source: "/yutai/manifest", rule: "月次。運用詳細は market_info 側 docs を参照。", latest: yutai.latest, fetchedAt: yutai.fetchedAt },

    // 信用
    { category: "credit", name: "日興一般信用在庫", href: "/tools/yutai-candidates", source: "/nikko/credit", rule: "毎週土曜朝に手動実行 (scripts/run_nikko_inventory_and_publish.ps1)。ログイン/パスキー必要。naito_market_job 火曜 credit の信用残/信用倍率系とは別データ。", latest: nikkoCredit.latest, fetchedAt: nikkoCredit.fetchedAt },
    { category: "credit", name: "SBI一般信用在庫", href: "/tools/yutai-candidates", source: "/sbi/credit/latest", rule: "毎週日曜朝に手動実行 (scripts/run_sbi_inventory_and_publish.ps1)。ログイン/パスキー必要。naito_market_job 火曜 credit の信用残/信用倍率系とは別データ。", latest: sbiCredit.latest, fetchedAt: sbiCredit.fetchedAt },

    // 参照データ
    { category: "reference", name: "JPX 祝日カレンダー", href: "/tools/earnings-calendar", source: "/market-calendar/jpx-closed", rule: "市場休場日の参照データ。複数ツール共通。更新運用は market_info 側 docs 参照。", latest: jpxClosed.latest, fetchedAt: jpxClosed.fetchedAt },

    // ローカル
    { category: "local", name: "合計計算", href: "/tools/total", source: "ブラウザ localStorage", rule: "ユーザー入力" },
    { category: "local", name: "文字数カウント", href: "/tools/charcount", source: "ブラウザ localStorage", rule: "ユーザー入力" },
    { category: "local", name: "株主優待期限帳", href: "/tools/yutai-expiry", source: "localStorage + scan (premium)", rule: "ユーザー入力" },
    { category: "local", name: "優待銘柄メモ帳", href: "/tools/yutai-memo", source: "ブラウザ localStorage", rule: "ユーザー入力" },
  ];
}

// ============== UI ==============

type Freshness = "fresh" | "recent" | "stale" | "failed" | "none";

function classifyFreshness(row: ToolRow): Freshness {
  if (row.latest === undefined) return "none";
  if (row.latest === null) return "failed";
  // 日付 (YYYY-MM-DD) or ISO datetime のどちらでも先頭 10 文字を日付として扱う
  const dateStr = row.latest.slice(0, 10);
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(t)) return "recent";
  const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
  if (ageDays <= 2) return "fresh";
  if (ageDays <= 7) return "recent";
  return "stale";
}

const CATEGORY_META: Record<Category, { label: string; icon: string; accent: string }> = {
  stocks: { label: "Stock Data", icon: "📈", accent: "linear-gradient(135deg, #6366f1 0%, #2563eb 100%)" },
  calendars: { label: "Calendars", icon: "🗓️", accent: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)" },
  disclosures: { label: "Disclosures", icon: "📄", accent: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)" },
  yutai: { label: "Yutai", icon: "🎁", accent: "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)" },
  credit: { label: "Credit", icon: "🏦", accent: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)" },
  reference: { label: "Reference", icon: "📚", accent: "linear-gradient(135deg, #14b8a6 0%, #10b981 100%)" },
  local: { label: "Local / Client-only", icon: "💾", accent: "linear-gradient(135deg, #64748b 0%, #475569 100%)" },
};

const FRESHNESS_META: Record<Freshness, { label: string; bg: string; fg: string; border: string; dot: string }> = {
  fresh: { label: "FRESH", bg: "rgba(16,185,129,0.12)", fg: "#34d399", border: "rgba(16,185,129,0.35)", dot: "#10b981" },
  recent: { label: "RECENT", bg: "rgba(59,130,246,0.12)", fg: "#60a5fa", border: "rgba(59,130,246,0.35)", dot: "#3b82f6" },
  stale: { label: "STALE", bg: "rgba(245,158,11,0.14)", fg: "#fbbf24", border: "rgba(245,158,11,0.4)", dot: "#f59e0b" },
  failed: { label: "FAILED", bg: "rgba(239,68,68,0.14)", fg: "#fca5a5", border: "rgba(239,68,68,0.4)", dot: "#ef4444" },
  none: { label: "N/A", bg: "rgba(148,163,184,0.10)", fg: "#94a3b8", border: "rgba(148,163,184,0.3)", dot: "#64748b" },
};

function formatLatest(value: string | null | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "取得失敗";
  // ISO datetime なら日付＋時刻、それ以外はそのまま
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mi = String(d.getUTCMinutes()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}Z`;
    }
  }
  return value;
}

function getAgeDays(row: ToolRow): number | null {
  if (!row.latest) return null;
  const dateStr = row.latest.slice(0, 10);
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}

function formatAge(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1d";
  return `${days}d`;
}

const FRESHNESS_ORDER: Record<Freshness, number> = {
  failed: 0,
  stale: 1,
  recent: 2,
  fresh: 3,
  none: 4,
};

function sortRowsForAnalysis(rows: ToolRow[]): ToolRow[] {
  return [...rows].sort((a, b) => {
    const fa = classifyFreshness(a);
    const fb = classifyFreshness(b);
    if (fa !== fb) return FRESHNESS_ORDER[fa] - FRESHNESS_ORDER[fb];
    const da = getAgeDays(a);
    const db = getAgeDays(b);
    if (da !== null && db !== null && da !== db) return db - da;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name, "ja");
  });
}

function StatusPill({ row }: { row: ToolRow }) {
  const fm = FRESHNESS_META[classifyFreshness(row)];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 6,
        background: fm.bg,
        color: fm.fg,
        border: `1px solid ${fm.border}`,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.6,
        whiteSpace: "nowrap",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: fm.dot, boxShadow: `0 0 6px ${fm.dot}` }} />
      {fm.label}
    </span>
  );
}

function CategoryTag({ category }: { category: Category }) {
  const meta = CATEGORY_META[category];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: "#cbd5e1",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: meta.accent,
          display: "inline-block",
        }}
      />
      {meta.label}
    </span>
  );
}

function KpiPill({
  label,
  value,
  accent,
  total,
}: {
  label: string;
  value: number;
  accent: string;
  total?: number;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 160,
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#f8fafc",
            letterSpacing: -0.8,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {pct !== null ? (
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
            {pct}%
          </span>
        ) : null}
      </div>
      {/* progress bar */}
      {pct !== null ? (
        <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: accent, opacity: 0.7 }} />
        </div>
      ) : null}
    </div>
  );
}

const tableCellHead: CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: 10,
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: 1,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
  position: "sticky",
  top: 0,
  whiteSpace: "nowrap",
};

const tableCell: CSSProperties = {
  padding: "12px 14px",
  fontSize: 12.5,
  color: "#cbd5e1",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
  verticalAlign: "top",
  lineHeight: 1.55,
};


// ============== SVG Charts ==============

type StatusCount = { freshness: Freshness; count: number };

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return { x1, y1, x2, y2, largeArc };
}

function DonutChart({ data, total }: { data: StatusCount[]; total: number }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 88;
  const inner = 62;
  const safeTotal = total > 0 ? total : 1;

  const filtered = data.filter((d) => d.count > 0);
  const slices = filtered.map((d, idx) => {
    const before = filtered.slice(0, idx).reduce((s, x) => s + x.count, 0);
    const start = (before / safeTotal) * 360;
    const end = ((before + d.count) / safeTotal) * 360;
    return { ...d, start, end };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Status distribution donut">
      {slices.length === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={r - inner} />
      ) : null}
      {slices.map((s) => {
        const fm = FRESHNESS_META[s.freshness];
        if (s.end - s.start >= 359.99) {
          // 単一スライスが全周のときは円で描画
          return (
            <circle
              key={s.freshness}
              cx={cx}
              cy={cy}
              r={(r + inner) / 2}
              fill="none"
              stroke={fm.dot}
              strokeWidth={r - inner}
              opacity={0.92}
            />
          );
        }
        const a = describeArc(cx, cy, r, s.start, s.end);
        const b = describeArc(cx, cy, inner, s.start, s.end);
        const path = [
          `M ${a.x1} ${a.y1}`,
          `A ${r} ${r} 0 ${a.largeArc} 1 ${a.x2} ${a.y2}`,
          `L ${b.x2} ${b.y2}`,
          `A ${inner} ${inner} 0 ${a.largeArc} 0 ${b.x1} ${b.y1}`,
          "Z",
        ].join(" ");
        return <path key={s.freshness} d={path} fill={fm.dot} opacity={0.92} />;
      })}
      {/* center label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#f1f5f9" fontSize={28} fontWeight={900} fontFamily="ui-monospace, SFMono-Regular, monospace">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={800} letterSpacing={1.2}>
        TRACKED
      </text>
    </svg>
  );
}

function AgeBarList({ rows }: { rows: ToolRow[] }) {
  // dynamic rows のみを年齢順 (古い → 新しい) に並べる。
  const items = rows
    .filter((r) => r.latest !== undefined)
    .map((r) => ({ row: r, age: getAgeDays(r), fresh: classifyFreshness(r) }))
    .sort((a, b) => {
      const sev = FRESHNESS_ORDER[a.fresh] - FRESHNESS_ORDER[b.fresh];
      if (sev !== 0) return sev;
      if (a.age === null && b.age === null) return 0;
      if (a.age === null) return 1;
      if (b.age === null) return -1;
      return b.age - a.age;
    });

  const finiteAges = items.map((it) => it.age).filter((v): v is number => v !== null);
  const maxAge = Math.max(14, ...finiteAges); // 最低 14 日スケール

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map(({ row, age, fresh }) => {
        const fm = FRESHNESS_META[fresh];
        const ratio = age === null ? 0 : Math.min(1, age / maxAge);
        return (
          <div
            key={`${row.name}-${row.source}`}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(160px, 22%) 1fr 64px",
              alignItems: "center",
              gap: 12,
              fontSize: 11.5,
            }}
          >
            <div style={{ color: "#cbd5e1", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {row.name}
            </div>
            <div style={{ position: "relative", height: 12, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${Math.max(2, ratio * 100)}%`,
                  background: fm.dot,
                  opacity: fresh === "failed" || fresh === "none" ? 0.5 : 0.85,
                  borderRadius: 3,
                }}
              />
              {fresh === "failed" ? (
                <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9, color: "#fca5a5", fontWeight: 800, letterSpacing: 1 }}>
                  FAILED
                </span>
              ) : null}
            </div>
            <div
              style={{
                fontSize: 11,
                color: fm.fg,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontWeight: 800,
                textAlign: "right",
              }}
            >
              {age === null ? (fresh === "failed" ? "—" : "N/A") : `${age}d`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgeHistogram({ rows }: { rows: ToolRow[] }) {
  // 0, 1, 2, 3-7, 8-14, 15-30, 30+ のバケットに集計
  const buckets = [
    { label: "today", min: 0, max: 0 },
    { label: "1d", min: 1, max: 1 },
    { label: "2d", min: 2, max: 2 },
    { label: "3-7d", min: 3, max: 7 },
    { label: "8-14d", min: 8, max: 14 },
    { label: "15-30d", min: 15, max: 30 },
    { label: "30d+", min: 31, max: Infinity },
  ];

  const counts = buckets.map((b) => {
    let count = 0;
    let dominantFresh: Freshness = "fresh";
    let maxSeverity = -1;
    for (const row of rows) {
      const age = getAgeDays(row);
      if (age === null) continue;
      if (age >= b.min && age <= b.max) {
        count++;
        const f = classifyFreshness(row);
        const sev = FRESHNESS_ORDER[f];
        if (sev > maxSeverity && f !== "none") {
          // 大きい severity 値 = よりFRESH側。低い値が問題側。逆向きに使いたいので min を取る
        }
        // 一番厳しい状態 (低い severity 数値) を採用
        if (maxSeverity === -1 || FRESHNESS_ORDER[f] < maxSeverity) {
          maxSeverity = FRESHNESS_ORDER[f];
          dominantFresh = f;
        }
      }
    }
    return { ...b, count, fresh: dominantFresh };
  });

  const maxCount = Math.max(1, ...counts.map((c) => c.count));
  const W = 720;
  const H = 140;
  const padL = 10;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const barW = (W - padL - padR) / counts.length - 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Age distribution histogram">
      {/* y grid lines */}
      {[0, 0.5, 1].map((g) => {
        const y = padT + (1 - g) * (H - padT - padB);
        return (
          <line key={g} x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        );
      })}
      {counts.map((c, idx) => {
        const fm = FRESHNESS_META[c.fresh];
        const x = padL + idx * ((W - padL - padR) / counts.length) + 4;
        const h = c.count === 0 ? 0 : (c.count / maxCount) * (H - padT - padB);
        const y = H - padB - h;
        return (
          <g key={c.label}>
            {h > 0 ? (
              <rect x={x} y={y} width={barW} height={h} fill={fm.dot} opacity={0.85} rx={2} />
            ) : (
              <rect x={x} y={H - padB - 2} width={barW} height={2} fill="rgba(255,255,255,0.08)" rx={1} />
            )}
            {c.count > 0 ? (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="#f1f5f9" fontSize={11} fontWeight={800} fontFamily="ui-monospace, SFMono-Regular, monospace">
                {c.count}
              </text>
            ) : null}
            <text x={x + barW / 2} y={H - padB + 16} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={700}>
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function CategoryStackedBar({ rows }: { rows: ToolRow[] }) {
  const categories: Category[] = ["stocks", "calendars", "disclosures", "yutai", "credit", "reference", "local"];
  const W = 720;
  const rowH = 22;
  const labelW = 130;
  const H = categories.length * (rowH + 6);

  // 各 category 内の freshness 集計
  const data = categories.map((cat) => {
    const catRows = rows.filter((r) => r.category === cat);
    const breakdown: Record<Freshness, number> = { fresh: 0, recent: 0, stale: 0, failed: 0, none: 0 };
    for (const r of catRows) breakdown[classifyFreshness(r)]++;
    return { cat, total: catRows.length, breakdown };
  });
  const maxTotal = Math.max(1, ...data.map((d) => d.total));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Category breakdown stacked bar">
      {data.map((d, idx) => {
        const y = idx * (rowH + 6);
        const fullW = W - labelW - 60;
        const scale = (d.total / maxTotal) * fullW;
        let acc = 0;
        const order: Freshness[] = ["fresh", "recent", "stale", "failed", "none"];
        return (
          <g key={d.cat}>
            <text x={labelW - 10} y={y + rowH / 2 + 4} textAnchor="end" fill="#cbd5e1" fontSize={11.5} fontWeight={700}>
              {CATEGORY_META[d.cat].label}
            </text>
            <rect x={labelW} y={y} width={fullW} height={rowH} fill="rgba(255,255,255,0.03)" rx={4} />
            {order.map((f) => {
              const v = d.breakdown[f];
              if (v === 0) return null;
              const w = (v / d.total) * scale;
              const x = labelW + acc;
              acc += w;
              return (
                <rect key={f} x={x} y={y} width={w} height={rowH} fill={FRESHNESS_META[f].dot} opacity={0.85} />
              );
            })}
            <text x={labelW + scale + 8} y={y + rowH / 2 + 4} fill="#64748b" fontSize={11} fontWeight={800} fontFamily="ui-monospace, SFMono-Regular, monospace">
              {d.total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const pageBg: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(ellipse 1200px 600px at 20% -10%, rgba(99,102,241,0.20) 0%, transparent 60%)," +
    "radial-gradient(ellipse 900px 500px at 100% 10%, rgba(14,165,233,0.16) 0%, transparent 55%)," +
    "linear-gradient(180deg, #050816 0%, #0a0f1f 60%, #060912 100%)",
  color: "#e2e8f0",
  paddingBottom: 80,
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) {
    redirect(`/premium/login?next=${encodeURIComponent("/admin")}`);
  }

  const rows = await loadRows();
  const apiBase = getApiBaseUrl();
  const now = new Date();
  const nowIso = now.toISOString().slice(0, 19).replace("T", " ") + "Z";

  // Summary stats
  const dynamicRows = rows.filter((r) => r.latest !== undefined);
  const totalDynamic = dynamicRows.length;
  const freshCount = dynamicRows.filter((r) => classifyFreshness(r) === "fresh").length;
  const staleCount = dynamicRows.filter((r) => classifyFreshness(r) === "stale").length;
  const failedCount = dynamicRows.filter((r) => classifyFreshness(r) === "failed").length;

  return (
    <>
      <style>{`
        .admin-row { transition: background 0.12s ease; }
        .admin-row:hover { background: rgba(99,102,241,0.06); }
        .admin-pc { display: block; }
        .admin-mobile { display: none; }
        @media (max-width: 820px) {
          .admin-pc { display: none; }
          .admin-mobile { display: block; }
        }
      `}</style>

      <div className="admin-pc" style={pageBg}>

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "28px 28px 0" }}>
        {/* Compact Hero */}
        <header style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 11px",
                  borderRadius: 6,
                  background: "rgba(99,102,241,0.12)",
                  color: "#a5b4fc",
                  border: "1px solid rgba(99,102,241,0.30)",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.4,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                ADMIN · NOINDEX
              </span>
              <Link
                href="/premium"
                style={{
                  fontSize: 11,
                  color: "#94a3b8",
                  textDecoration: "none",
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                ← /premium
              </Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "#64748b", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
              <span>API <span style={{ color: "#cbd5e1" }}>{apiBase || "(未設定)"}</span></span>
              <span>·</span>
              <span>NOW {nowIso}</span>
            </div>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: -0.6,
              color: "#f1f5f9",
              lineHeight: 1.15,
            }}
          >
            Data Update Dashboard
            <span style={{ marginLeft: 12, fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: 0 }}>
              tracking {totalDynamic} sources · {rows.length} tools total
            </span>
          </h1>
        </header>

        {/* KPI strip */}
        <section style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <KpiPill label="TRACKED" value={totalDynamic} accent="#6366f1" />
          <KpiPill label="FRESH" value={freshCount} accent="#10b981" total={totalDynamic} />
          <KpiPill label="RECENT" value={dynamicRows.filter((r) => classifyFreshness(r) === "recent").length} accent="#3b82f6" total={totalDynamic} />
          <KpiPill label="STALE" value={staleCount} accent="#f59e0b" total={totalDynamic} />
          <KpiPill label="FAILED" value={failedCount} accent="#ef4444" total={totalDynamic} />
        </section>

        {/* Analytics row: Donut + Age bar list */}
        <section style={{ display: "grid", gridTemplateColumns: "minmax(320px, 380px) 1fr", gap: 16, marginBottom: 16 }}>
          {/* Donut panel */}
          <div
            style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "18px 18px 16px",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 1, marginBottom: 14 }}>
              STATUS DISTRIBUTION
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <DonutChart
                total={totalDynamic}
                data={(["fresh", "recent", "stale", "failed"] as Freshness[]).map((f) => ({
                  freshness: f,
                  count: dynamicRows.filter((r) => classifyFreshness(r) === f).length,
                }))}
              />
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8, flex: 1 }}>
                {(["fresh", "recent", "stale", "failed", "none"] as Freshness[]).map((f) => {
                  const count = f === "none"
                    ? rows.filter((r) => r.latest === undefined).length
                    : dynamicRows.filter((r) => classifyFreshness(r) === f).length;
                  const denom = f === "none" ? rows.length : totalDynamic;
                  const pct = denom > 0 ? Math.round((count / denom) * 100) : 0;
                  const fm = FRESHNESS_META[f];
                  return (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: fm.dot }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#cbd5e1", letterSpacing: 0.4, flex: 1 }}>
                        {fm.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#f1f5f9", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                        {count}
                      </span>
                      <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, monospace", width: 32, textAlign: "right" }}>
                        {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Age bar list panel */}
          <div
            style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "18px 20px 18px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 1 }}>
                SOURCES BY AGE (oldest first)
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>
                bar = age days (scale: 14d min)
              </div>
            </div>
            <AgeBarList rows={rows} />
          </div>
        </section>

        {/* Charts row: Histogram + Category breakdown */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 1 }}>
                AGE DISTRIBUTION
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>
                bucket color = worst severity in bucket
              </div>
            </div>
            <AgeHistogram rows={rows} />
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 1 }}>
                CATEGORY × STATUS
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>
                stacked bar per category
              </div>
            </div>
            <CategoryStackedBar rows={rows} />
          </div>
        </section>

        {/* Table panel */}
        <section
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", letterSpacing: -0.2 }}>
                All Data Sources
              </span>
              <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 0.5 }}>
                sorted by severity (FAILED → STALE → RECENT → FRESH → N/A) then age desc
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#64748b" }}>
              {(["fresh", "recent", "stale", "failed", "none"] as Freshness[]).map((f) => (
                <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: FRESHNESS_META[f].dot }} />
                  {FRESHNESS_META[f].label}
                </span>
              ))}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed", minWidth: 1100 }}>
              <colgroup>
                <col style={{ width: 4 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 280 }} />
                <col style={{ width: 170 }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...tableCellHead, padding: 0 }} aria-hidden />
                  <th style={tableCellHead}>STATUS</th>
                  <th style={tableCellHead}>CATEGORY</th>
                  <th style={tableCellHead}>DATA SOURCE</th>
                  <th style={tableCellHead}>LAST UPDATE / AGE</th>
                  <th style={tableCellHead}>OPERATION RULE</th>
                </tr>
              </thead>
              <tbody>
                {sortRowsForAnalysis(rows).map((row) => {
                  const fresh = classifyFreshness(row);
                  const fm = FRESHNESS_META[fresh];
                  const ageDays = getAgeDays(row);
                  return (
                    <tr key={`${row.name}-${row.href}-${row.source}`} className="admin-row">
                      <td style={{ padding: 0, background: fm.dot, opacity: fresh === "none" ? 0.25 : 0.85 }} />
                      <td style={tableCell}>
                        <StatusPill row={row} />
                      </td>
                      <td style={tableCell}>
                        <CategoryTag category={row.category} />
                      </td>
                      <td style={tableCell}>
                        <Link
                          href={row.href}
                          style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#f1f5f9", textDecoration: "none", letterSpacing: -0.2, marginBottom: 3 }}
                        >
                          {row.name}
                        </Link>
                        <code style={{ fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, SFMono-Regular, monospace", wordBreak: "break-all" }}>
                          {row.source}
                        </code>
                      </td>
                      <td style={tableCell}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: fm.fg,
                              fontFamily: "ui-monospace, SFMono-Regular, monospace",
                              letterSpacing: -0.2,
                            }}
                          >
                            {formatLatest(row.latest)}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 10, color: "#64748b", fontFamily: "ui-monospace, SFMono-Regular, monospace", letterSpacing: 0.4 }}>
                          AGE {formatAge(ageDays)}
                        </div>
                      </td>
                      <td style={{ ...tableCell, color: "#cbd5e1", fontSize: 12, lineHeight: 1.6 }}>
                        {row.rule}
                        {row.note ? (
                          <div style={{ marginTop: 4, fontSize: 10.5, color: "#fbbf24" }}>※ {row.note}</div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            fontSize: 11,
            color: "#64748b",
            lineHeight: 1.8,
            padding: "12px 4px 24px",
          }}
        >
          <div style={{ marginBottom: 4 }}>
            FRESH ≤ 2日 · RECENT ≤ 7日 · STALE &gt; 7日 · FAILED = 取得不可 · N/A = ローカル保存のみ。
            判定は YYYY-MM-DD ベースで現在時刻 (UTC) と単純差分で計算。
          </div>
          <div>
            出典: market_info repo の docs/operations/monthly_operations.md / docs/reference/policy_decision_rules.md / policy_decision_log.md / publish_contract_inventory.md / cli_inventory.md
          </div>
        </footer>
      </main>
      </div>

      {/* ============== Mobile ============== */}
      <div className="admin-mobile">
        <MobileAdmin rows={rows} apiBase={apiBase} nowIso={nowIso} />
      </div>
    </>
  );
}

// ============== Mobile UI ==============

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
  const fresh = classifyFreshness(row);
  const fm = FRESHNESS_META[fresh];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10,
        fontWeight: 800,
        color: "#475569",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: fm.dot }} />
      {fm.label}
    </span>
  );
}

function MobileAdmin({
  rows,
  apiBase,
  nowIso,
}: {
  rows: ToolRow[];
  apiBase: string;
  nowIso: string;
}) {
  const categories: Category[] = ["stocks", "calendars", "disclosures", "yutai", "credit", "reference", "local"];
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 14px 64px", color: "#0f172a" }}>
      <header style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 999,
            background: "#eef2ff",
            color: "#3730a3",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          ADMIN · NOINDEX
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>
          データ更新ダッシュボード
        </h1>
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
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 12,
                fontWeight: 800,
                color: "#475569",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {CATEGORY_LABEL_JA[cat]} ({catRows.length})
            </h2>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
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
                    <tr
                      key={`${row.name}-${row.href}-${row.source}`}
                      style={{ borderTop: "1px solid #f1f5f9" }}
                    >
                      <td style={mobileTd}>
                        <Link
                          href={row.href}
                          style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", textDecoration: "none", display: "block", marginBottom: 3 }}
                        >
                          {row.name}
                        </Link>
                        <code style={{ fontSize: 10, color: "#94a3b8", wordBreak: "break-all", display: "block" }}>
                          {row.source}
                        </code>
                      </td>
                      <td style={mobileTd}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", fontFamily: "ui-monospace, SFMono-Regular, monospace", lineHeight: 1.3, marginBottom: 4, wordBreak: "break-all" }}>
                          {formatLatest(row.latest)}
                        </div>
                        <MobileFreshDot row={row} />
                      </td>
                      <td style={{ ...mobileTd, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                        {row.rule}
                      </td>
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
        <div style={{ marginTop: 4 }}>
          出典: market_info repo の docs/operations & docs/reference 配下
        </div>
      </footer>
    </main>
  );
}
