import path from "node:path";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LogoutButton from "./LogoutButton";
import PremiumPreviewChart from "./PremiumPreviewChart";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { loadJpxMarketClosedData } from "@/lib/jpx-market-closed";
import { loadTopix33DayData, loadTopix33Manifest } from "@/app/tools/topix33/data-loader";
import type { JpxMarketClosedResponse } from "@/lib/market-calendar-types";
import type { Topix33DayData } from "@/app/tools/topix33/types";

export const metadata: Metadata = {
  title: "Premium Preview | mini-tools",
  description: "mini-tools premium の仮ランディングページです。",
  alternates: {
    canonical: "/premium",
  },
};

type PreviewSeries = {
  sectorName: string;
  values: number[];
  color: string;
  latestChange: number;
};

type PremiumPreviewData = {
  latestDay: Topix33DayData | null;
  recentDays: Topix33DayData[];
  heatmapSectors: string[];
  chartSeries: PreviewSeries[];
  defaultSelectedSectors: string[];
  targetMonthLabel: string;
  targetMonth: string;
  previousMonth: string | null;
  nextMonth: string | null;
};

const CHART_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

const FALLBACK_DAYS = [
  "2026-04-10",
  "2026-04-09",
  "2026-04-08",
  "2026-04-07",
  "2026-04-03",
  "2026-04-02",
  "2026-04-01",
];

const FALLBACK_HEATMAP: Record<string, number[]> = {
  "銀行業": [1.42, 0.68, -0.24, 0.91, 0.55, 1.16, 0.42],
  "情報・通信業": [0.88, 0.14, 0.52, -0.18, 0.73, 0.64, 0.21],
  "電気機器": [-0.92, 1.18, 0.44, 0.26, -0.35, 0.81, 0.37],
  "卸売業": [0.63, -0.11, 0.38, 0.74, 0.49, -0.05, 0.18],
  "輸送用機器": [-1.31, -0.44, 0.27, -0.63, 0.16, 0.33, -0.12],
  "不動産業": [-0.58, -0.84, 0.12, -0.47, -0.19, 0.09, 0.24],
};

function getDayOfWeek(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isWeekendDate(dateStr: string) {
  const day = getDayOfWeek(dateStr);
  return day === 0 || day === 6;
}

function formatShortDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

function formatMonthLabel(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}年${m}月`;
}

function fmtPct(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getHeatColor(value: number | null) {
  if (value === null) return "#e2e8f0";

  const clamped = Math.max(-2.5, Math.min(2.5, value));
  const alpha = 0.14 + (Math.abs(clamped) / 2.5) * 0.72;
  if (clamped > 0) {
    return `rgba(22, 163, 74, ${alpha.toFixed(3)})`;
  }
  if (clamped < 0) {
    return `rgba(220, 38, 38, ${alpha.toFixed(3)})`;
  }
  return "#cbd5e1";
}

function getTextColor(value: number | null) {
  if (value === null) return "#64748b";
  if (value > 0.6) return "#14532d";
  if (value < -0.6) return "#7f1d1d";
  if (value > 0) return "#166534";
  if (value < 0) return "#991b1b";
  return "#475569";
}

function buildFallbackPreviewData(): PremiumPreviewData {
  const sectorNames = Object.keys(FALLBACK_HEATMAP);
  const latestValues = sectorNames.map((sectorName) => ({
    sector_name: sectorName,
    sector_code: sectorName,
    chg_pct: FALLBACK_HEATMAP[sectorName][0] ?? 0,
    chg: 0,
  }));

  const latestDay: Topix33DayData = {
    date: FALLBACK_DAYS[0],
    index: "topix33",
    summary: {
      advancers: 20,
      decliners: 11,
      unchanged: 2,
    },
    top_positive: latestValues
      .slice()
      .sort((a, b) => b.chg_pct - a.chg_pct)
      .slice(0, 3)
      .map((sector, index) => ({ ...sector, rank: index + 1 })),
    top_negative: latestValues
      .slice()
      .sort((a, b) => a.chg_pct - b.chg_pct)
      .slice(0, 3)
      .map((sector, index) => ({ ...sector, rank: index + 1 })),
    sectors: latestValues,
  };

  const recentDays = FALLBACK_DAYS.map((date, dateIndex) => ({
    ...latestDay,
    date,
    sectors: sectorNames.map((sectorName) => ({
      sector_name: sectorName,
      sector_code: sectorName,
      chg_pct: FALLBACK_HEATMAP[sectorName][dateIndex] ?? 0,
      chg: 0,
    })),
  }));

  const chartSeries = sectorNames.map((sectorName, index) => {
    let current = 100;
    const values = FALLBACK_DAYS.slice()
      .reverse()
      .map((_, reversedIndex) => {
        if (reversedIndex === 0) {
          return 100;
        }

        const dayIndex = FALLBACK_DAYS.length - 1 - reversedIndex;
        current *= 1 + (FALLBACK_HEATMAP[sectorName][dayIndex] ?? 0) / 100;
        return Number(current.toFixed(2));
      });

    return {
      sectorName,
      values,
      color: CHART_COLORS[index % CHART_COLORS.length],
      latestChange: FALLBACK_HEATMAP[sectorName][0] ?? 0,
    };
  });

  return {
    latestDay,
    recentDays,
    heatmapSectors: sectorNames,
    chartSeries,
    defaultSelectedSectors: sectorNames.slice(0, 4),
    targetMonthLabel: formatMonthLabel(FALLBACK_DAYS[0]),
    targetMonth: "2026-04",
    previousMonth: null,
    nextMonth: null,
  };
}

function getVisibleDates(
  dates: string[],
  holidays: JpxMarketClosedResponse | null
) {
  const holidayMap = new Map((holidays?.days ?? []).map((day) => [day.date, day]));
  return dates.filter((date) => {
    if (holidayMap.get(date)?.market_closed) return false;
    return !isWeekendDate(date);
  });
}

function pickHeatmapSectors(latestDay: Topix33DayData) {
  const names = [
    ...latestDay.top_positive.slice(0, 4).map((item) => item.sector_name),
    ...latestDay.top_negative.slice(0, 4).map((item) => item.sector_name),
  ];
  return [...new Set(names)].slice(0, 8);
}

function getAllSectorNames(days: Topix33DayData[]) {
  const names = days.flatMap((day) => day.sectors.map((sector) => sector.sector_name));
  return [...new Set(names)];
}

function buildMonthlyIndexValues(days: Topix33DayData[], sectorName: string) {
  let current = 100;

  return days.map((day, index) => {
    if (index === 0) {
      return 100;
    }

    const sector = day.sectors.find((item) => item.sector_name === sectorName);
    current *= 1 + (sector?.chg_pct ?? 0) / 100;
    return Number(current.toFixed(2));
  });
}

function buildChartSeries(days: Topix33DayData[], sectorNames: string[]) {
  const orderedDays = days.slice().reverse();
  return sectorNames.map((sectorName, index) => {
    const values = buildMonthlyIndexValues(orderedDays, sectorName);

    return {
      sectorName,
      values,
      color: CHART_COLORS[index % CHART_COLORS.length],
      latestChange:
        days[0]?.sectors.find((item) => item.sector_name === sectorName)?.chg_pct ?? 0,
    };
  });
}

function getAvailableMonths(dates: string[]) {
  return [...new Set(dates.map((date) => date.slice(0, 7)))];
}

async function loadPremiumPreviewData(requestedMonth?: string): Promise<PremiumPreviewData> {
  const holidays = await loadJpxMarketClosedData();
  const manifest = await loadTopix33Manifest();
  const visibleDates = getVisibleDates(manifest.dates, holidays);

  if (visibleDates.length === 0) {
    return buildFallbackPreviewData();
  }

  const availableMonths = getAvailableMonths(visibleDates);
  const targetMonth = requestedMonth && availableMonths.includes(requestedMonth)
    ? requestedMonth
    : availableMonths[0];
  if (!targetMonth) {
    return buildFallbackPreviewData();
  }
  const monthDates = visibleDates.filter((date) => date.startsWith(targetMonth));

  const loaded = await Promise.all(
    monthDates.map(async (date) => loadTopix33DayData(date))
  );
  const recentDays = loaded.filter(
    (day): day is Topix33DayData => Boolean(day && day.sectors.length > 0)
  );

  if (recentDays.length === 0) {
    return buildFallbackPreviewData();
  }

  const latestDay = recentDays[0];
  const heatmapSectors = pickHeatmapSectors(latestDay);
  const allSectorNames = getAllSectorNames(recentDays);
  const chartSeeds = [
    ...latestDay.top_positive.slice(0, 3).map((item) => item.sector_name),
    ...latestDay.top_negative.slice(0, 3).map((item) => item.sector_name),
    ...heatmapSectors.slice(0, 2),
  ];
  const uniqueChartSeeds = [...new Set(chartSeeds)].slice(0, 8);
  const chartSeries = buildChartSeries(recentDays, allSectorNames);

  const currentMonthIndex = availableMonths.indexOf(targetMonth);
  const previousMonth =
    currentMonthIndex >= 0 && currentMonthIndex < availableMonths.length - 1
      ? availableMonths[currentMonthIndex + 1]
      : null;
  const nextMonth = currentMonthIndex > 0 ? availableMonths[currentMonthIndex - 1] : null;

  return {
    latestDay,
    recentDays,
    heatmapSectors,
    chartSeries,
    defaultSelectedSectors: uniqueChartSeeds.slice(0, 4),
    targetMonthLabel: formatMonthLabel(latestDay.date),
    targetMonth,
    previousMonth,
    nextMonth,
  };
}

function MomentumCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "green" | "red" | "blue" | "slate";
}) {
  const toneMap = {
    green: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
    red: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    slate: { bg: "#f8fafc", border: "#cbd5e1", text: "#334155" },
  } as const;

  return (
    <section
      style={{
        background: toneMap[tone].bg,
        border: `1px solid ${toneMap[tone].border}`,
        borderRadius: 18,
        padding: "18px 16px",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: toneMap[tone].text, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: toneMap[tone].text, marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.7, color: toneMap[tone].text }}>{sub}</div>
    </section>
  );
}

function HeatmapCell({ value }: { value: number | null }) {
  return (
    <div
      title={value === null ? "データなし" : fmtPct(value)}
      style={{
        height: 34,
        borderRadius: 10,
        background: getHeatColor(value),
        color: getTextColor(value),
        display: "grid",
        placeItems: "center",
        fontSize: 11,
        fontWeight: 800,
        border: "1px solid rgba(255,255,255,0.45)",
      }}
    >
      {value === null ? "—" : value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
    </div>
  );
}


const eyebrowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  background: "#fff7ed",
  border: "1px solid #fdba74",
  color: "#c2410c",
  fontSize: 12,
  fontWeight: 800,
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
  fontSize: 14,
  lineHeight: 1.8,
};

export default async function PremiumPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;

  if (!verifyPremiumSession(session)) {
    const resolvedSearchParams = await searchParams;
    const month = resolvedSearchParams?.month;
    const nextPath = month ? `/premium?month=${encodeURIComponent(month)}` : "/premium";
    redirect(`/premium/login?next=${encodeURIComponent(nextPath)}`);
  }

  const resolvedSearchParams = await searchParams;
  const preview = await loadPremiumPreviewData(resolvedSearchParams?.month);
  const strongest = preview.latestDay?.top_positive[0];
  const weakest = preview.latestDay?.top_negative[0];
  const orderedDays = preview.recentDays.slice().reverse();

  return (
    <main style={{ padding: "32px 16px 72px" }}>
      <section
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at top left, rgba(250, 204, 21, 0.30), transparent 30%), radial-gradient(circle at bottom right, rgba(96, 165, 250, 0.22), transparent 34%), linear-gradient(135deg, #0f172a 0%, #172554 48%, #1d4ed8 100%)",
            color: "#fff",
            borderRadius: 30,
            padding: "30px 24px",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: 700 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  marginBottom: 14,
                }}
              >
                Premium Preview / Graph Mock
              </div>
              <h1
                style={{
                  margin: "0 0 12px",
                  fontSize: 36,
                  lineHeight: 1.06,
                  letterSpacing: -1.1,
                }}
              >
                TOPIX33 の見せ方を
                <br />
                実物に近い preview で固める
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.9,
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                まずは premium の仮ページ上で、{preview.targetMonthLabel}の月初を100にした業種比較チャートと、
                月内ヒートマップの見え方を試せるようにしました。実データが取れるときはそれを使い、
                取れないときも preview が崩れないようにしています。
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                {preview.nextMonth ? (
                  <Link
                    href={`/premium?month=${preview.nextMonth}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: 999,
                      background: "#fff",
                      color: "#1d4ed8",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    翌月へ: {formatMonthLabel(`${preview.nextMonth}-01`)}
                  </Link>
                ) : null}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.12)",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  表示中: {preview.targetMonthLabel}
                </div>
                {preview.previousMonth ? (
                  <Link
                    href={`/premium?month=${preview.previousMonth}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: 999,
                      background: "#fff",
                      color: "#1d4ed8",
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    前月へ: {formatMonthLabel(`${preview.previousMonth}-01`)}
                  </Link>
                ) : null}
              </div>
            </div>

            <LogoutButton />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <MomentumCard
            label="最新営業日の上昇業種"
            value={`${preview.latestDay?.summary.advancers ?? 0}業種`}
            sub="相場全体にどれくらい広がりがあったかを、最初のひと目で把握する役割です。"
            tone="green"
          />
          <MomentumCard
            label="最新営業日の下落業種"
            value={`${preview.latestDay?.summary.decliners ?? 0}業種`}
            sub="上昇数と並べることで、地合いの偏りや全面高・全面安の雰囲気を掴みやすくします。"
            tone="red"
          />
          <MomentumCard
            label="直近の強い業種"
            value={strongest ? `${strongest.sector_name} ${fmtPct(strongest.chg_pct)}` : "集計中"}
            sub="単日の首位だけでなく、ここから継続性のコメントにもつなげる想定です。"
            tone="blue"
          />
          <MomentumCard
            label="直近の弱い業種"
            value={weakest ? `${weakest.sector_name} ${fmtPct(weakest.chg_pct)}` : "集計中"}
            sub="逆張りの監視や反転候補を見る導線としても使える位置づけです。"
            tone="slate"
          />
        </div>

        <section
          style={{
            background: "var(--color-bg-card)",
            borderRadius: 24,
            border: "1px solid var(--color-border)",
            padding: "24px 20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={eyebrowStyle}>月間ヒートマップ Preview</div>
              <h2 style={{ margin: "8px 0 8px", fontSize: 24 }}>
                営業日ごとの強弱を、まず色面で俯瞰する
              </h2>
              <p style={mutedStyle}>
                33 業種を全部並べる前に、まずは上位 / 下位の代表業種で密度感を確認する段階です。
              </p>
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "right" }}>
              <div>表示日数: {orderedDays.length}営業日</div>
              <div>対象: {preview.targetMonthLabel}</div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 760 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `220px repeat(${orderedDays.length}, minmax(52px, 1fr))`,
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-text-muted)" }}>
                  注目業種
                </div>
                {orderedDays.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {formatShortDate(day.date)}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {preview.heatmapSectors.map((sectorName) => (
                  <div
                    key={sectorName}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `220px repeat(${orderedDays.length}, minmax(52px, 1fr))`,
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        background: "#f8fafc",
                        border: "1px solid var(--color-border)",
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      {sectorName}
                    </div>
                    {orderedDays.map((day) => {
                      const sector = day.sectors.find((item) => item.sector_name === sectorName) ?? null;
                      return <HeatmapCell key={`${sectorName}-${day.date}`} value={sector?.chg_pct ?? null} />;
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16, fontSize: 12, color: "var(--color-text-muted)" }}>
            <span>濃い緑: 強い上昇</span>
            <span>濃い赤: 強い下落</span>
            <span>薄い灰: ほぼ横ばい</span>
          </div>
        </section>

        <PremiumPreviewChart
          monthLabel={preview.targetMonthLabel}
          dateLabels={orderedDays.map((day) => formatShortDate(day.date))}
          series={preview.chartSeries}
          defaultSelected={preview.defaultSelectedSectors}
        />

        <section
          style={{
            background: "var(--color-bg-card)",
            borderRadius: 24,
            border: "1px solid var(--color-border)",
            padding: "24px 20px",
          }}
        >
          <div style={eyebrowStyle}>モメンタム要約 Preview</div>
          <h2 style={{ margin: "8px 0 10px", fontSize: 24 }}>
            premium では「読む手間を減らす」説明も置く
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            <section
              style={{
                padding: "18px 16px",
                borderRadius: 18,
                background: "#f8fafc",
                border: "1px solid var(--color-border)",
              }}
            >
              <div style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 800, marginBottom: 8 }}>
                継続して強い業種
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 8 }}>
                {strongest?.sector_name ?? "銀行業"} が上位を維持
              </div>
              <p style={mutedStyle}>
                強い日が単発なのか、月内を通して上位に残っているのかを短文で補足する想定です。
              </p>
            </section>

            <section
              style={{
                padding: "18px 16px",
                borderRadius: 18,
                background: "#fff7ed",
                border: "1px solid #fdba74",
              }}
            >
              <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 800, marginBottom: 8 }}>
                反転候補
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 8 }}>
                {weakest?.sector_name ?? "輸送用機器"} は押し込み後の戻り待ち
              </div>
              <p style={{ ...mutedStyle, color: "#9a3412" }}>
                下位定着なのか、急落後に戻り始めているのかを見分ける補助コメントを置きます。
              </p>
            </section>
          </div>
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/premium/portfolio"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 46,
              padding: "0 18px",
              borderRadius: 14,
              background: "#102033",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            保有銘柄ダッシュボード
          </Link>
          <Link
            href="/tools/topix33"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 46,
              padding: "0 18px",
              borderRadius: 14,
              background: "var(--color-accent)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            既存の TOPIX33 を見る
          </Link>
          <Link
            href="/premium/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 46,
              padding: "0 18px",
              borderRadius: 14,
              background: "#fff",
              color: "var(--color-text-sub)",
              border: "1px solid var(--color-border)",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            ログイン画面に戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
