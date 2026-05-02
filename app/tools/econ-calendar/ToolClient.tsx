"use client";

import { useMemo, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import type { EconCalendarPageData, EconCalendarEvent, EconCalendarWeeklyResponse } from "./types";

type FlatEvent = EconCalendarEvent & { date: string };
type ViewMode = "week" | "month";

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

function parsePrevious(prev: string | null): { main: string; revised: string | null } {
  if (!prev || prev === "--") return { main: prev ?? "—", revised: null };
  const idx = prev.indexOf("⇒");
  if (idx === -1) return { main: prev, revised: null };
  return {
    main: prev.slice(idx + 1).trim(),
    revised: prev.slice(0, idx).trim(),
  };
}

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

function weekLabel(weekStart: string, weekEnd: string): string {
  return `${weekStart.slice(5).replace("-", "/")} 〜 ${weekEnd.slice(5).replace("-", "/")}`;
}

function ImpactDots({ impact }: { impact: number | null }) {
  const level = impact ?? 0;
  const color = IMPACT_COLOR[level] ?? "#94a3b8";
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
            background: i <= level ? color : "#e5e7eb",
          }}
        />
      ))}
    </span>
  );
}

type ImpactFilter = "all" | "3+" | "4+" | "5";

async function fetchWeek(weekStart: string): Promise<EconCalendarWeeklyResponse | null> {
  try {
    const res = await fetch(`/api/econ-calendar/${weekStart}`);
    if (!res.ok) return null;
    return (await res.json()) as EconCalendarWeeklyResponse;
  } catch {
    return null;
  }
}

export default function ToolClient({ data }: { data: EconCalendarPageData }) {
  const { meta, manifest } = data;

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentWeekly, setCurrentWeekly] = useState<EconCalendarWeeklyResponse | null>(data.weekly);
  const [weekLoading, setWeekLoading] = useState(false);

  // 月表示: 選択月 "YYYY-MM" と月内の全イベント（複数週をマージ）
  const availableMonths = useMemo(() => {
    if (!manifest) return [];
    const months = Array.from(new Set(manifest.weeks.map((w) => w.slice(0, 7)))).sort().reverse();
    return months;
  }, [manifest]);

  const currentMonthDefault = useMemo(() => {
    return availableMonths[0] ?? new Date().toISOString().slice(0, 7);
  }, [availableMonths]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => currentMonthDefault);
  const [monthData, setMonthData] = useState<Map<string, EconCalendarWeeklyResponse>>(new Map());
  const [monthLoading, setMonthLoading] = useState(false);

  const today = useMemo(() => todayJst(), []);

  // 週表示フィルター
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [todayOnly, setTodayOnly] = useState(false);

  // 週ナビゲーション
  const currentWeekStart = currentWeekly?.week_start ?? null;
  const weekIndex = useMemo(() => {
    if (!manifest || !currentWeekStart) return -1;
    return manifest.weeks.indexOf(currentWeekStart);
  }, [manifest, currentWeekStart]);

  const prevWeekStart = manifest && weekIndex >= 0 && weekIndex < manifest.weeks.length - 1
    ? manifest.weeks[weekIndex + 1]
    : null;
  const nextWeekStart = manifest && weekIndex > 0
    ? manifest.weeks[weekIndex - 1]
    : null;

  const navigateWeek = useCallback(async (weekStart: string) => {
    setWeekLoading(true);
    const result = await fetchWeek(weekStart);
    if (result) setCurrentWeekly(result);
    setWeekLoading(false);
  }, []);

  // 月表示: 選択月が変わったら対象週を取得
  const loadMonth = useCallback(async (month: string) => {
    if (!manifest) return;
    setMonthLoading(true);
    const weeksInMonth = manifest.weeks.filter((w) => w.startsWith(month));
    const toFetch = weeksInMonth.filter((w) => !monthData.has(w));
    if (toFetch.length > 0) {
      const results = await Promise.all(toFetch.map(fetchWeek));
      setMonthData((prev) => {
        const next = new Map(prev);
        toFetch.forEach((w, i) => {
          if (results[i]) next.set(w, results[i]!);
        });
        return next;
      });
    }
    setMonthLoading(false);
  }, [manifest, monthData]);

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
    loadMonth(month);
  }, [loadMonth]);

  // 週表示: イベント集計
  const events = useMemo<FlatEvent[]>(
    () => currentWeekly?.calendar.flatMap((day) => day.events.map((e) => ({ ...e, date: day.date }))) ?? [],
    [currentWeekly]
  );

  const allCountries = useMemo(() => {
    return Array.from(
      new Set(events.map((e) => e.country_tag).filter((t): t is string => t !== null))
    ).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (todayOnly && e.date !== today) return false;
      if (impactFilter === "3+" && (e.impact ?? 0) < 3) return false;
      if (impactFilter === "4+" && (e.impact ?? 0) < 4) return false;
      if (impactFilter === "5" && e.impact !== 5) return false;
      if (selectedCountries.size > 0 && !selectedCountries.has(e.country_tag ?? ""))
        return false;
      return true;
    });
  }, [events, today, todayOnly, impactFilter, selectedCountries]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, FlatEvent[]>();
    for (const event of filteredEvents) {
      const existing = groups.get(event.date) ?? [];
      existing.push(event);
      groups.set(event.date, existing);
    }
    const pad = (t: string | null) => (t ?? "").replace(/^(\d):/, "0$1:");
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, evs]) => [
        date,
        [...evs].sort((a, b) => pad(a.time).localeCompare(pad(b.time))),
      ] as [string, FlatEvent[]]);
  }, [filteredEvents]);

  const nextUpcoming = useMemo(() => {
    return (
      events
        .filter((e) => e.date === today && !e.result && e.time && (e.impact ?? 0) >= 4)
        .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))[0] ?? null
    );
  }, [events, today]);

  // 月表示: 全イベントを日付順に集計
  const monthEvents = useMemo<FlatEvent[]>(() => {
    if (!manifest) return [];
    const weeksInMonth = manifest.weeks.filter((w) => w.startsWith(selectedMonth));
    const all: FlatEvent[] = [];
    for (const w of weeksInMonth) {
      const wd = monthData.get(w);
      if (!wd) continue;
      for (const day of wd.calendar) {
        if (!day.date.startsWith(selectedMonth)) continue;
        for (const e of day.events) {
          all.push({ ...e, date: day.date });
        }
      }
    }
    const pad = (t: string | null) => (t ?? "").replace(/^(\d):/, "0$1:");
    return all.sort((a, b) => a.date.localeCompare(b.date) || pad(a.time).localeCompare(pad(b.time)));
  }, [manifest, selectedMonth, monthData]);

  const monthGroupedByDate = useMemo(() => {
    const groups = new Map<string, FlatEvent[]>();
    for (const e of monthEvents) {
      const existing = groups.get(e.date) ?? [];
      existing.push(e);
      groups.set(e.date, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [monthEvents]);

  function toggleCountry(tag: string) {
    setSelectedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const publishedAt = meta?.published_at ?? null;
  const currentLabel = currentWeekly
    ? weekLabel(currentWeekly.week_start, currentWeekly.week_end)
    : "";

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        {/* ヒーロー */}
        <section style={styles.heroBlock}>
          <div style={styles.heroEyebrow}>経済指標カレンダー</div>
          <h1 style={styles.heroTitle}>経済指標</h1>
        </section>

        {/* ビュー切り替えタブ */}
        <div style={styles.viewTabs}>
          <button
            type="button"
            style={{ ...styles.viewTab, ...(viewMode === "week" ? styles.viewTabActive : {}) }}
            onClick={() => setViewMode("week")}
          >
            週表示
          </button>
          <button
            type="button"
            style={{ ...styles.viewTab, ...(viewMode === "month" ? styles.viewTabActive : {}) }}
            onClick={() => {
              setViewMode("month");
              if (manifest) loadMonth(selectedMonth);
            }}
          >
            月表示
          </button>
        </div>

        {/* ======= 週表示 ======= */}
        {viewMode === "week" && (
          <>
            {/* 週ナビゲーター */}
            <div style={styles.weekNav}>
              <button
                type="button"
                style={{ ...styles.weekNavBtn, ...(prevWeekStart ? {} : styles.weekNavBtnDisabled) }}
                disabled={!prevWeekStart || weekLoading}
                onClick={() => prevWeekStart && navigateWeek(prevWeekStart)}
              >
                ‹ 前の週
              </button>
              <span style={styles.weekNavLabel}>
                {weekLoading ? "読み込み中…" : currentLabel}
              </span>
              <button
                type="button"
                style={{ ...styles.weekNavBtn, ...(nextWeekStart ? {} : styles.weekNavBtnDisabled) }}
                disabled={!nextWeekStart || weekLoading}
                onClick={() => nextWeekStart && navigateWeek(nextWeekStart)}
              >
                次の週 ›
              </button>
            </div>

            {/* メタバー */}
            {publishedAt ? (
              <div style={styles.metaBar}>
                <span style={styles.metaText}>
                  最終更新: {formatPublishedAt(publishedAt)}
                </span>
                {(meta?.diff?.actuals_updated_count ?? 0) > 0 ? (
                  <span style={styles.diffBadge}>
                    前回から {meta!.diff!.actuals_updated_count} 件変更
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
                    {COUNTRY_FLAGS[nextUpcoming.country_tag ?? ""] ?? nextUpcoming.country_tag}
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
                        前回 <strong>{nextUpcoming.previous}</strong>
                      </span>
                    ) : null}
                    {nextUpcoming.forecast ? (
                      <span style={styles.upcomingValueItem}>
                        予想 <strong>{nextUpcoming.forecast}</strong>
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
                          {COUNTRY_FLAGS[tag] ?? tag}
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
                  {currentWeekly
                    ? "条件に合うイベントはありません"
                    : "データを取得できませんでした"}
                </div>
                <div style={styles.emptyNote}>
                  {currentWeekly
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
                        const hasResult = !!event.result;
                        const flag = COUNTRY_FLAGS[event.country_tag] ?? "";
                        const { main: prevMain, revised: prevRevised } = parsePrevious(event.previous);

                        return (
                          <article
                            key={`${date}-${event.time}-${event.indicator}-${idx}`}
                            style={{
                              ...styles.eventCard,
                              ...(hasResult ? styles.eventCardDone : {}),
                            }}
                          >
                            <div style={styles.eventMeta}>
                              <span style={styles.eventTime}>{event.time || "—"}</span>
                              <span style={styles.eventFlag} title={event.country ?? ""}>
                                {flag || event.country_tag}
                              </span>
                              <ImpactDots impact={event.impact} />
                            </div>

                            <div style={styles.eventBody}>
                              <div style={styles.eventIndicator}>{event.indicator}</div>
                              <div style={styles.valueRow}>
                                <div style={styles.valueCell}>
                                  <span style={styles.valueLabel}>前回</span>
                                  <span style={styles.valueNumber}>{prevMain}</span>
                                  {prevRevised ? (
                                    <span style={styles.valuePrevSub}>({prevRevised})</span>
                                  ) : null}
                                </div>
                                <div style={styles.valueCell}>
                                  <span style={styles.valueLabel}>予想</span>
                                  <span style={styles.valueNumber}>{event.forecast ?? "—"}</span>
                                </div>
                                <div style={styles.valueCell}>
                                  <span style={styles.valueLabel}>結果</span>
                                  <span style={{
                                    ...styles.valueNumber,
                                    ...(hasResult ? styles.resultNumber : styles.resultPending),
                                  }}>
                                    {hasResult ? event.result : "—"}
                                  </span>
                                </div>
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
          </>
        )}

        {/* ======= 月表示 ======= */}
        {viewMode === "month" && (
          <>
            {/* 月セレクター */}
            <div style={styles.monthNav}>
              {availableMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  style={{
                    ...styles.monthTab,
                    ...(selectedMonth === m ? styles.monthTabActive : {}),
                  }}
                  onClick={() => handleMonthChange(m)}
                >
                  {m.slice(0, 4)}年{String(Number(m.slice(5, 7)))}月
                </button>
              ))}
            </div>

            {monthLoading ? (
              <div style={styles.loadingText}>読み込み中…</div>
            ) : monthGroupedByDate.length === 0 ? (
              <article style={styles.emptyCard}>
                <div style={styles.emptyTitle}>データがありません</div>
                <div style={styles.emptyNote}>
                  {manifest ? "この月のデータはまだ発行されていません" : "APIが設定されていません"}
                </div>
              </article>
            ) : (
              <div style={styles.monthTable}>
                {/* ヘッダー */}
                <div style={styles.monthTableHeader}>
                  <div style={{ ...styles.monthCol, ...styles.monthColDate }}>日付</div>
                  <div style={{ ...styles.monthCol, ...styles.monthColTime }}>時刻</div>
                  <div style={{ ...styles.monthCol, ...styles.monthColFlag }}>国</div>
                  <div style={{ ...styles.monthCol, ...styles.monthColImp }}>重要</div>
                  <div style={{ ...styles.monthCol, flex: "1 1 0", minWidth: 0 }}>指標</div>
                  <div style={{ ...styles.monthCol, ...styles.monthColVal }}>前回</div>
                  <div style={{ ...styles.monthCol, ...styles.monthColVal }}>予想</div>
                  <div style={{ ...styles.monthCol, ...styles.monthColVal }}>結果</div>
                </div>

                {monthGroupedByDate.map(([date, dayEvents]) => {
                  const isToday = date === today;
                  return dayEvents.map((event, idx) => {
                    const hasResult = !!event.result;
                    const flag = COUNTRY_FLAGS[event.country_tag] ?? "";
                    const { main: prevMain } = parsePrevious(event.previous);
                    return (
                      <div
                        key={`${date}-${event.time}-${event.indicator}-${idx}`}
                        style={{
                          ...styles.monthTableRow,
                          ...(isToday ? styles.monthTableRowToday : {}),
                          ...(hasResult ? styles.monthTableRowDone : {}),
                        }}
                      >
                        <div style={{ ...styles.monthCol, ...styles.monthColDate }}>
                          {idx === 0 ? (
                            <span style={isToday ? styles.monthDateToday : styles.monthDate}>
                              {formatDateLabel(date)}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ ...styles.monthCol, ...styles.monthColTime }}>
                          {event.time || "—"}
                        </div>
                        <div style={{ ...styles.monthCol, ...styles.monthColFlag }}>
                          {flag || event.country_tag}
                        </div>
                        <div style={{ ...styles.monthCol, ...styles.monthColImp }}>
                          <ImpactDots impact={event.impact} />
                        </div>
                        <div style={{ ...styles.monthCol, flex: "1 1 0", minWidth: 0, fontSize: 12, fontWeight: 600, color: "#1f2937" }}>
                          {event.indicator}
                        </div>
                        <div style={{ ...styles.monthCol, ...styles.monthColVal }}>{prevMain}</div>
                        <div style={{ ...styles.monthCol, ...styles.monthColVal }}>{event.forecast ?? "—"}</div>
                        <div style={{
                          ...styles.monthCol,
                          ...styles.monthColVal,
                          ...(hasResult ? styles.resultNumber : styles.resultPending),
                        }}>
                          {hasResult ? event.result : "—"}
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            )}
          </>
        )}

        <div style={styles.footerNote}>
          データ: market-info API · 平日 1日1回更新
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
    maxWidth: 680,
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
  viewTabs: {
    display: "flex",
    gap: 4,
    marginBottom: 16,
    borderBottom: "2px solid rgba(15,23,42,0.07)",
    paddingBottom: 0,
  },
  viewTab: {
    padding: "8px 18px",
    borderRadius: "8px 8px 0 0",
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: -2,
  },
  viewTabActive: {
    color: "#2554ff",
    borderBottomColor: "#2554ff",
    background: "rgba(37,84,255,0.04)",
  },
  weekNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
    padding: "10px 14px",
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 1px 4px rgba(15,23,42,0.07)",
  },
  weekNavBtn: {
    padding: "5px 12px",
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.1)",
    background: "#fff",
    color: "#374151",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  weekNavBtnDisabled: {
    color: "#d1d5db",
    cursor: "default",
    borderColor: "rgba(15,23,42,0.04)",
  },
  weekNavLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    textAlign: "center" as const,
    flex: 1,
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
    background: "#fff",
    borderRadius: 16,
    padding: "12px 16px",
    marginBottom: 16,
    border: "1px solid rgba(37, 84, 255, 0.15)",
    borderLeftWidth: 4,
    borderLeftColor: "#2554ff",
    boxShadow: "0 2px 8px rgba(37, 84, 255, 0.08)",
  },
  upcomingLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: "#2554ff",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  upcomingRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  upcomingTime: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: "#1f2937",
  },
  upcomingFlag: {
    fontSize: 16,
    color: "#374151",
  },
  upcomingIndicator: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.3,
    color: "#1f2937",
    marginBottom: 6,
  },
  upcomingValues: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
  },
  upcomingValueItem: {
    fontSize: 12,
    color: "#6b7280",
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
    marginBottom: 6,
  },
  eventBody: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: 800,
    color: "#374151",
    width: 60,
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  },
  eventFlag: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 700,
    width: 28,
    flexShrink: 0,
  },
  eventIndicator: {
    flex: "1 1 0",
    minWidth: 0,
    fontSize: 13,
    fontWeight: 700,
    color: "#1f2937",
    lineHeight: 1.4,
  },
  valueRow: {
    display: "flex",
    gap: 12,
    flexShrink: 0,
  },
  valueCell: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    gap: 1,
    width: 48,
  },
  valueLabel: {
    fontSize: 9,
    fontWeight: 800,
    color: "#9ca3af",
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  valueNumber: {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
    fontVariantNumeric: "tabular-nums",
  },
  valuePrevSub: {
    fontSize: 10,
    color: "#9ca3af",
    fontVariantNumeric: "tabular-nums",
  },
  resultNumber: {
    fontWeight: 800,
    color: "#1f2937",
  },
  resultPending: {
    color: "#d1d5db",
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

  // 月表示
  monthNav: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  monthTab: {
    padding: "5px 12px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.1)",
    background: "#fff",
    color: "#374151",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  monthTabActive: {
    background: "#eef2ff",
    border: "1px solid rgba(37,84,255,0.22)",
    color: "#2554ff",
  },
  loadingText: {
    textAlign: "center",
    padding: "40px 0",
    fontSize: 13,
    color: "#9ca3af",
  },
  monthTable: {
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  monthTableHeader: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    background: "#f8fafc",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    gap: 8,
    fontSize: 10,
    fontWeight: 800,
    color: "#9ca3af",
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  monthTableRow: {
    display: "flex",
    alignItems: "center",
    padding: "7px 12px",
    gap: 8,
    borderBottom: "1px solid rgba(15,23,42,0.04)",
    fontSize: 12,
    color: "#374151",
  },
  monthTableRowToday: {
    background: "rgba(37,84,255,0.03)",
  },
  monthTableRowDone: {
    opacity: 0.7,
  },
  monthCol: {
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  },
  monthColDate: {
    width: 110,
  },
  monthColTime: {
    width: 52,
    fontWeight: 700,
  },
  monthColFlag: {
    width: 26,
    textAlign: "center" as const,
  },
  monthColImp: {
    width: 52,
  },
  monthColVal: {
    width: 52,
    textAlign: "right" as const,
    fontWeight: 600,
    color: "#374151",
  },
  monthDate: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
  },
  monthDateToday: {
    fontSize: 11,
    fontWeight: 800,
    color: "#2554ff",
  },
};
