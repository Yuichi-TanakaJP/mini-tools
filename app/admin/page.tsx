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
    { category: "stocks", name: "TOPIX33業種", href: "/tools/topix33", source: "/topix33/manifest", rule: "日次 (大引け後)", latest: topix33.latest, fetchedAt: topix33.fetchedAt },
    { category: "stocks", name: "日経225寄与度", href: "/tools/nikkei-contribution", source: "/nikkei/manifest", rule: "日次 (大引け後)", latest: nikkei.latest, fetchedAt: nikkei.fetchedAt },
    { category: "stocks", name: "株価ランキング", href: "/tools/stock-ranking", source: "/ranking/manifest", rule: "日次 (大引け後)", latest: stockRanking.latest, fetchedAt: stockRanking.fetchedAt },
    { category: "stocks", name: "米国株ランキング", href: "/tools/us-stock-ranking", source: "/us-ranking/manifest", rule: "日次 (米国大引け後)", latest: usRanking.latest, fetchedAt: usRanking.fetchedAt },
    { category: "stocks", name: "市場ランキング (時価総額)", href: "/tools/market-rankings", source: "/market-rankings/market-cap/manifest", rule: "月次 (月初確定)", latest: marketCap.latest, fetchedAt: marketCap.fetchedAt },
    { category: "stocks", name: "市場ランキング (配当利回り)", href: "/tools/market-rankings", source: "/market-rankings/dividend-yield/manifest", rule: "月次 (月初確定)", latest: dividendYield.latest, fetchedAt: dividendYield.fetchedAt },

    // カレンダー
    { category: "calendars", name: "決算カレンダー (国内)", href: "/tools/earnings-calendar", source: "/earnings-calendar/domestic/manifest", rule: "日次 (営業日朝)", latest: earningsDom.latest, fetchedAt: earningsDom.fetchedAt },
    { category: "calendars", name: "決算カレンダー (海外)", href: "/tools/earnings-calendar", source: "/earnings-calendar/overseas/manifest", rule: "日次 (営業日朝)", latest: earningsOv.latest, fetchedAt: earningsOv.fetchedAt },
    { category: "calendars", name: "経済指標カレンダー", href: "/tools/econ-calendar", source: "/econ-calendar/weekly/manifest", rule: "週次 (月曜朝)", latest: econ.latest, fetchedAt: econ.fetchedAt },

    // 開示
    { category: "disclosures", name: "EDINET書類一覧", href: "/tools/edinet-documents", source: "/edinet/document-list/manifest", rule: "日次", latest: edinet.latest, fetchedAt: edinet.fetchedAt },
    { category: "disclosures", name: "TDNET適時開示", href: "/tools/tdnet-disclosures", source: "/tdnet/disclosures/latest", rule: "日次", latest: tdnet.latest, fetchedAt: tdnet.fetchedAt },

    // 優待
    { category: "yutai", name: "優待カレンダー", href: "/tools/yutai-candidates", source: "/yutai/manifest", rule: "月次", latest: yutai.latest, fetchedAt: yutai.fetchedAt },

    // 信用
    { category: "credit", name: "日興信用データ", href: "/tools/yutai-candidates", source: "/nikko/credit", rule: "日次", latest: nikkoCredit.latest, fetchedAt: nikkoCredit.fetchedAt },
    { category: "credit", name: "SBI信用データ", href: "/tools/yutai-candidates", source: "/sbi/credit/latest", rule: "日次", latest: sbiCredit.latest, fetchedAt: sbiCredit.fetchedAt },

    // 参照データ
    { category: "reference", name: "JPX 祝日カレンダー", href: "/tools/earnings-calendar", source: "/market-calendar/jpx-closed", rule: "随時更新", latest: jpxClosed.latest, fetchedAt: jpxClosed.fetchedAt },

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

function ToolCard({ row }: { row: ToolRow }) {
  const fresh = classifyFreshness(row);
  const fm = FRESHNESS_META[fresh];

  return (
    <Link
      href={row.href}
      style={{
        position: "relative",
        display: "block",
        padding: "20px 22px",
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        textDecoration: "none",
        color: "inherit",
        overflow: "hidden",
        transition: "transform 0.18s ease, border-color 0.18s ease, background 0.18s ease",
      }}
      className="admin-card"
    >
      {/* 上部アクセントライン */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: fm.dot,
          opacity: 0.7,
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", letterSpacing: -0.2, lineHeight: 1.4 }}>
          {row.name}
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: fm.bg,
            color: fm.fg,
            border: `1px solid ${fm.border}`,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.6,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: fm.dot, boxShadow: `0 0 8px ${fm.dot}` }} />
          {fm.label}
        </span>
      </div>

      <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
        <code style={{ fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, SFMono-Regular, monospace", wordBreak: "break-all" }}>
          {row.source}
        </code>
        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>
          {row.rule}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, letterSpacing: 0.6, marginBottom: 2 }}>
            LAST UPDATE
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: fm.fg, letterSpacing: -0.3, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
            {formatLatest(row.latest)}
          </div>
        </div>
      </div>

      {row.note ? (
        <div style={{ marginTop: 10, fontSize: 11, color: "#fbbf24" }}>※ {row.note}</div>
      ) : null}
    </Link>
  );
}

function CategorySection({
  category,
  rows,
}: {
  category: Category;
  rows: ToolRow[];
}) {
  const meta = CATEGORY_META[category];
  return (
    <section style={{ marginBottom: 36 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: meta.accent,
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {meta.icon}
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, letterSpacing: 1 }}>SECTION</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#f1f5f9", letterSpacing: -0.4 }}>
            {meta.label}
          </h2>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748b" }}>
          {rows.length} item{rows.length === 1 ? "" : "s"}
        </div>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {rows.map((row) => (
          <ToolCard key={`${row.name}-${row.href}-${row.source}`} row={row} />
        ))}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        padding: "20px 22px",
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: accent,
          filter: "blur(40px)",
          opacity: 0.55,
        }}
      />
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: 1.2, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#f8fafc", letterSpacing: -1, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{sub}</div>
      </div>
    </div>
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

  const categories: Category[] = ["stocks", "calendars", "disclosures", "yutai", "credit", "reference", "local"];

  return (
    <div style={pageBg}>
      <style>{`
        .admin-card:hover {
          transform: translateY(-3px);
          border-color: rgba(99, 102, 241, 0.45) !important;
          background: linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(255,255,255,0.02) 100%) !important;
        }
      `}</style>

      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "40px 32px 0" }}>
        {/* Hero */}
        <header style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  borderRadius: 999,
                  background: "rgba(99,102,241,0.14)",
                  color: "#a5b4fc",
                  border: "1px solid rgba(99,102,241,0.35)",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 1.4,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
                ADMIN · NOINDEX
              </span>
              <Link
                href="/premium"
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  textDecoration: "none",
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                ← /premium に戻る
              </Link>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
              {nowIso}
            </div>
          </div>

          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: -1.6,
              lineHeight: 1.05,
              background: "linear-gradient(135deg, #f8fafc 0%, #a5b4fc 60%, #60a5fa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Data Update Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.7, maxWidth: 720 }}>
            各ツールのデータソース・更新ルール・最終更新日を一望できる管理画面。
            API <code style={{ color: "#cbd5e1" }}>{apiBase || "(未設定)"}</code> の manifest を並列取得しています。
          </p>
        </header>

        {/* Stats */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 40,
          }}
        >
          <StatCard
            label="TRACKED SOURCES"
            value={totalDynamic}
            sub="動的取得しているデータソース数"
            accent="#6366f1"
          />
          <StatCard
            label="FRESH (≤ 2日)"
            value={freshCount}
            sub="最新営業日近辺で更新済み"
            accent="#10b981"
          />
          <StatCard
            label="STALE (> 7日)"
            value={staleCount}
            sub="1週間以上更新が止まっている"
            accent="#f59e0b"
          />
          <StatCard
            label="FAILED"
            value={failedCount}
            sub="API 取得失敗 / 未設定"
            accent="#ef4444"
          />
        </section>

        {/* Sections */}
        {categories.map((cat) => {
          const catRows = rows.filter((r) => r.category === cat);
          if (catRows.length === 0) return null;
          return <CategorySection key={cat} category={cat} rows={catRows} />;
        })}

        {/* Footer */}
        <footer
          style={{
            marginTop: 24,
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: 11,
            color: "#64748b",
            lineHeight: 1.8,
          }}
        >
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 8 }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#10b981", marginRight: 6 }} />FRESH = 2日以内</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", marginRight: 6 }} />RECENT = 7日以内</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", marginRight: 6 }} />STALE = 8日以上</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444", marginRight: 6 }} />FAILED = 取得不可</span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#64748b", marginRight: 6 }} />N/A = ローカル保存のみ</span>
          </div>
          <div>判定は YYYY-MM-DD ベースで現在時刻 (UTC) と比較。週末や祝日はオフセットせず単純差分で計算。</div>
        </footer>
      </main>
    </div>
  );
}
