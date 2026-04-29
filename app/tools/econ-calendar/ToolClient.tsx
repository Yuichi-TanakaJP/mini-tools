"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import type { EconCalendarPageData, EconCalendarEvent } from "./types";

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  JP: "🇯🇵",
  EU: "🇪🇺",
  GB: "🇬🇧",
  CN: "🇨🇳",
  AU: "🇦🇺",
  CA: "🇨🇦",
  DE: "🇩🇪",
  FR: "🇫🇷",
  NZ: "🇳🇿",
  CH: "🇨🇭",
  KR: "🇰🇷",
  IT: "🇮🇹",
  ES: "🇪🇸",
  BR: "🇧🇷",
};

const IMPACT_COLOR: Record<number, string> = {
  5: "#ef4444",
  4: "#f97316",
  3: "#f59e0b",
  2: "#94a3b8",
  1: "#cbd5e1",
};

function todayJst(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
  return `${month}月${day}日（${weekday}）`;
}

function formatPublishedAt(iso: string): string {
  try {
    const date = new Date(iso);
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "";
    return `${month}/${day} ${hour}:${minute}`;
  } catch {
    return iso;
  }
}

function parsePct(s: string | null): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function getSurprise(
  result: string | null,
  forecast: string | null,
): "beat" | "miss" | null {
  const r = parsePct(result);
  const f = parsePct(forecast);
  if (r === null || f === null) return null;
  if (Math.abs(r - f) < 0.001) return null;
  return r > f ? "beat" : "miss";
}

function ImpactDots({ impact }: { impact: number }) {
  const color = IMPACT_COLOR[impact] ?? "#94a3b8";
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: i <= impact ? color : "#e5e7eb",
          }}
        />
      ))}
    </span>
  );
}

type ImpactFilter = "all" | "3+" | "4+" | "5";

export default function ToolClient({ data }: { data: EconCalendarPageData }) {
  const router = useRouter();
  const { weekly, meta } = data;
  const events = weekly?.events ?? [];

  const today = useMemo(todayJst, []);

  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(
    new Set(),
  );
  const [todayOnly, setTodayOnly] = useState(false);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const allCountries = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.country_tag))).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (todayOnly && e.date !== today) return false;
      if (impactFilter === "3+" && e.impact < 3) return false;
      if (impactFilter === "4+" && e.impact < 4) return false;
      if (impactFilter === "5" && e.impact !== 5) return false;
      if (selectedCountries.size > 0 && !selectedCountries.has(e.country_tag))
        return false;
      return true;
    });
  }, [events, today, todayOnly, impactFilter, selectedCountries]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, EconCalendarEvent[]>();
    for (const event of filteredEvents) {
      const existing = groups.get(event.date) ?? [];
      existing.push(event);
      groups.set(event.date, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEvents]);

  const nextUpcoming = useMemo(() => {
    if (!weekly) return null;
    return (
      weekly.events
        .filter((e) => e.date === today && !e.result && e.time && e.impact >= 4)
        .sort((a, b) => a.time.localeCompare(b.time))[0] ?? null
    );
  }, [weekly, today]);

  function toggleCountry(tag: string) {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const weekLabel = weekly
    ? `${weekly.week.from.slice(5).replace("-", "/")} 〜 ${weekly.week.to.slice(5).replace("-", "/")}`
    : "";

  const publishedAt =
    meta?.published_at ?? weekly?.published_at ?? null;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* ヒーロー */}
        <section style={styles.heroBlock}>
          <div style={styles.heroEyebrow}>経済指標カレンダー</div>
          <h1 style={styles.heroTitle}>今週の経済指標</h1>
          {weekLabel ? <div style={styles.weekLabel}>{weekLabel}</div> : null}
        </section>

        {/* メタバー: 最終更新 + 変更バッジ */}
        {publishedAt ? (
          <div style={styles.metaBar}>
            <span style={styles.metaText}>
              最終更新: {formatPublishedAt(publishedAt)}
            </span>
            {(meta?.changed_count ?? 0) > 0 ? (
              <span style={styles.diffBadge}>
                前回から {meta!.changed_count} 件変更
              </span>
            ) : null}
          </div>
        ) : null}

        {/* 次の注目指標バナー */}
        {nextUpcoming ? (
          <section style={styles.upcomingCard}>
            <div style={styles.upcomingLabel}>次の注目指標</div>
            <div style={styles.upcomingRow}>
              <span style={styles.upcomingTime}>{nextUpcoming.time}</span>
              <span style={styles.upcomingFlag}>
                {COUNTRY_FLAGS[nextUpcoming.country_tag] ??
                  nextUpcoming.country_tag}
              </span>
              <ImpactDots impact={nextUpcoming.impact} />
            </div>
            <div style={styles.upcomingIndicator}>
              {nextUpcoming.indicator}
            </div>
            {(nextUpcoming.previous || nextUpcoming.forecast) ? (
              <div style={styles.upcomingValues}>
                {nextUpcoming.previous ? (
                  <span style={styles.upcomingValueItem}>
                    前回{" "}
                    <strong style={{ opacity: 1 }}>
                      {nextUpcoming.previous}
                    </strong>
                  </span>
                ) : null}
                {nextUpcoming.forecast ? (
                  <span style={styles.upcomingValueItem}>
                    予想{" "}
                    <strong style={{ opacity: 1 }}>
                      {nextUpcoming.forecast}
                    </strong>
                  </span>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* フィルター */}
        {events.length > 0 ? (
          <section style={styles.filterSection}>
            <div style={styles.filterRow}>
              <span style={styles.filterLabel}>重要度</span>
              <div style={styles.chips}>
                {(["all", "3+", "4+", "5"] as ImpactFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    style={{
                      ...styles.chip,
                      ...(impactFilter === f ? styles.chipActive : {}),
                    }}
                    onClick={() => setImpactFilter(f)}
                  >
                    {f === "all" ? "すべて" : f === "5" ? "最重要" : `${f} 以上`}
                  </button>
                ))}
                <button
                  type="button"
                  style={{
                    ...styles.chip,
                    ...(todayOnly ? styles.chipToday : {}),
                  }}
                  onClick={() => setTodayOnly((v) => !v)}
                >
                  今日のみ
                </button>
              </div>
            </div>

            {allCountries.length > 1 ? (
              <div style={styles.filterRow}>
                <span style={styles.filterLabel}>国</span>
                <div style={styles.chips}>
                  {allCountries.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      style={{
                        ...styles.chip,
                        ...(selectedCountries.has(tag) ? styles.chipActive : {}),
                      }}
                      onClick={() => toggleCountry(tag)}
                    >
                      {COUNTRY_FLAGS[tag] ? `${COUNTRY_FLAGS[tag]} ` : ""}
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* イベントリスト */}
        {groupedByDate.length === 0 ? (
          <article style={styles.emptyCard}>
            <div style={styles.emptyTitle}>
              {weekly
                ? "条件に合うイベントはありません"
                : "データを取得できませんでした"}
            </div>
            <div style={styles.emptyNote}>
              {weekly
                ? "フィルターを変えてみてください"
                : "MARKET_INFO_API_BASE_URL が設定されると経済指標データが表示されます"}
            </div>
          </article>
        ) : (
          groupedByDate.map(([date, dayEvents]) => {
            const isToday = date === today;
            return (
              <section key={date} style={styles.daySection}>
                <div
                  style={{
                    ...styles.dayHeader,
                    ...(isToday ? styles.dayHeaderToday : {}),
                  }}
                >
                  <span>{formatDateLabel(date)}</span>
                  {isToday ? (
                    <span style={styles.todayBadge}>今日</span>
                  ) : null}
                </div>

                <div style={styles.eventList}>
                  {dayEvents.map((event, idx) => {
                    const surprise = getSurprise(event.result, event.forecast);
                    const hasResult = !!event.result;
                    const flag = COUNTRY_FLAGS[event.country_tag] ?? "";

                    return (
                      <article
                        key={`${date}-${event.time}-${event.indicator}-${idx}`}
                        style={{
                          ...styles.eventCard,
                          ...(hasResult ? styles.eventCardDone : {}),
                        }}
                      >
                        <div style={styles.eventMeta}>
                          <span style={styles.eventTime}>
                            {event.time || "—"}
                          </span>
                          <span style={styles.eventFlag} title={event.country}>
                            {flag ? `${flag} ` : ""}
                            {event.country_tag}
                          </span>
                          <ImpactDots impact={event.impact} />
                        </div>

                        <div style={styles.eventIndicator}>
                          {event.indicator}
                        </div>

                        <div style={styles.valueRow}>
                          <div style={styles.valueCell}>
                            <span style={styles.valueLabel}>前回</span>
                            <span style={styles.valueNumber}>
                              {event.previous ?? "—"}
                            </span>
                          </div>
                          <div style={styles.valueCell}>
                            <span style={styles.valueLabel}>予想</span>
                            <span style={styles.valueNumber}>
                              {event.forecast ?? "—"}
                            </span>
                          </div>
                          <div style={styles.valueCell}>
                            <span style={styles.valueLabel}>結果</span>
                            <span
                              style={{
                                ...styles.valueNumber,
                                ...(hasResult
                                  ? styles.resultNumber
                                  : styles.resultPending),
                                ...(surprise === "beat"
                                  ? styles.resultBeat
                                  : {}),
                                ...(surprise === "miss"
                                  ? styles.resultMiss
                                  : {}),
                              }}
                            >
                              {hasResult
                                ? `${surprise === "beat" ? "↑ " : surprise === "miss" ? "↓ " : ""}${event.result}`
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <div style={styles.footerNote}>
          60秒ごとに自動更新 · データ: market-info API
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 12px 56px",
    background:
      "radial-gradient(1000px 420px at 20% 0%, rgba(37, 99, 235, 0.08), transparent 58%), #eef2f7",
  },
  shell: {
    width: "100%",
    maxWidth: 580,
    margin: "0 auto",
  },
  heroBlock: {
    marginBottom: 14,
  },
  heroEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3b5bdb",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  heroTitle: {
    margin: "0 0 4px",
    fontSize: 22,
    lineHeight: 1.2,
    letterSpacing: -0.4,
    color: "#1f2937",
  },
  weekLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 600,
  },
  metaBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 12,
    color: "#6b7280",
  },
  diffBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    fontSize: 11,
    fontWeight: 800,
  },
  upcomingCard: {
    background: "linear-gradient(135deg, #2554ff 0%, #4f79ff 100%)",
    borderRadius: 20,
    padding: "14px 16px",
    marginBottom: 16,
    color: "#fff",
  },
  upcomingLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.5,
    opacity: 0.75,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  upcomingRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  upcomingTime: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: -0.5,
  },
  upcomingFlag: {
    fontSize: 18,
  },
  upcomingIndicator: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.3,
    marginBottom: 8,
  },
  upcomingValues: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
  },
  upcomingValueItem: {
    fontSize: 12,
    opacity: 0.82,
  },
  filterSection: {
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  filterRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    paddingTop: 6,
    minWidth: 28,
    letterSpacing: 0.2,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15, 23, 42, 0.1)",
    background: "#fff",
    color: "#374151",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  chipActive: {
    background: "#eef2ff",
    border: "1px solid rgba(37, 84, 255, 0.22)",
    color: "#2554ff",
  },
  chipToday: {
    background: "#f0fdf4",
    border: "1px solid rgba(22, 163, 74, 0.22)",
    color: "#16a34a",
  },
  daySection: {
    marginBottom: 20,
  },
  dayHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: "2px solid rgba(15, 23, 42, 0.07)",
    fontSize: 14,
    fontWeight: 800,
    color: "#374151",
  },
  dayHeaderToday: {
    color: "#2554ff",
    borderBottomColor: "rgba(37, 84, 255, 0.18)",
  },
  todayBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 7px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#2554ff",
    fontSize: 10,
    fontWeight: 800,
  },
  eventList: {
    display: "grid",
    gap: 8,
  },
  eventCard: {
    background: "#fff",
    borderRadius: 16,
    padding: "11px 14px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
    border: "1px solid rgba(15, 23, 42, 0.04)",
  },
  eventCardDone: {
    background: "#fafbff",
    opacity: 0.85,
  },
  eventMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: 800,
    color: "#374151",
    minWidth: 38,
    fontVariantNumeric: "tabular-nums",
  },
  eventFlag: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
  },
  eventIndicator: {
    fontSize: 14,
    fontWeight: 800,
    color: "#1f2937",
    lineHeight: 1.3,
    marginBottom: 8,
  },
  valueRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
  },
  valueCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  valueLabel: {
    fontSize: 9,
    fontWeight: 800,
    color: "#9ca3af",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  valueNumber: {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    fontVariantNumeric: "tabular-nums",
  },
  resultNumber: {
    fontWeight: 800,
    color: "#374151",
  },
  resultPending: {
    color: "#d1d5db",
  },
  resultBeat: {
    color: "#16a34a",
  },
  resultMiss: {
    color: "#dc2626",
  },
  emptyCard: {
    background: "#fff",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
    border: "1px solid rgba(15, 23, 42, 0.04)",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#374151",
    marginBottom: 6,
  },
  emptyNote: {
    fontSize: 13,
    lineHeight: 1.6,
    color: "#667085",
  },
  footerNote: {
    marginTop: 28,
    textAlign: "center",
    fontSize: 11,
    color: "#9ca3af",
  },
};
