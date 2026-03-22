"use client";

import { useMemo, useState } from "react";
import type {
  EarningsCalendarDay,
  EarningsCalendarItem,
  EarningsCalendarResponse,
} from "./types";

type CalendarCell = {
  key: string;
  day: number;
  count: number;
  detailStatus: EarningsCalendarDay["detail_status"];
  items: EarningsCalendarItem[];
  muted?: boolean;
};

type CalendarMonth = {
  id: string;
  label: string;
  updatedAt: string;
  totalCount: number;
  selectedKey: string;
  cells: CalendarCell[];
};

const WEEK_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function getWeekdayJa(year: number, month: number, day: number) {
  return ["日", "月", "火", "水", "木", "金", "土"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
}

function formatSelectedLabel(key: string) {
  const { year, month, day } = parseDateKey(key);
  return `${month}/${day}（${getWeekdayJa(year, month, day)}）`;
}

function formatSelectedTitle(key: string) {
  const { year, month, day } = parseDateKey(key);
  return `${year}年${month}月${day}日（${getWeekdayJa(year, month, day)}）の決算銘柄`;
}

function formatMonthLabel(year: number, month: number) {
  return `${year}年${month}月`;
}

function formatUpdatedAt(key: string) {
  const { year, month, day } = parseDateKey(key);
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function normalizeMarket(market: string) {
  if (market === "TKY") return "東証";
  return market;
}

function normalizeTimeLabel(time: string) {
  return time.replace(/\s*\/\s*（?予定）?$/, "").replace(/\s*\/\s*\(予定\)$/, "");
}

function shouldShowPublishStatus(status: string) {
  return status.trim() !== "" && status !== "予定";
}

function createEmptyMonth(id: string, updatedAt: string): CalendarMonth {
  const [year, month] = id.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonthLastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    const mutedDay = prevMonthLastDay - firstWeekday + index + 1;
    const prevDate = new Date(Date.UTC(year, month - 2, mutedDay));
    cells.push({
      key: `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-${String(
        prevDate.getUTCDate(),
      ).padStart(2, "0")}`,
      day: mutedDay,
      count: 0,
      detailStatus: "missing",
      items: [],
      muted: true,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: `${id}-${String(day).padStart(2, "0")}`,
      day,
      count: 0,
      detailStatus: "missing",
      items: [],
    });
  }

  const trailingCount = (7 - (cells.length % 7)) % 7;
  for (let index = 1; index <= trailingCount; index += 1) {
    const nextDate = new Date(Date.UTC(year, month - 1, daysInMonth + index));
    cells.push({
      key: `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(
        nextDate.getUTCDate(),
      ).padStart(2, "0")}`,
      day: nextDate.getUTCDate(),
      count: 0,
      detailStatus: "missing",
      items: [],
      muted: true,
    });
  }

  return {
    id,
    label: formatMonthLabel(year, month),
    updatedAt,
    totalCount: 0,
    selectedKey: `${id}-01`,
    cells,
  };
}

function buildMonths(data: EarningsCalendarResponse): CalendarMonth[] {
  const grouped = new Map<string, EarningsCalendarDay[]>();

  for (const day of data.calendar) {
    const key = day.date.slice(0, 7);
    const bucket = grouped.get(key) ?? [];
    bucket.push(day);
    grouped.set(key, bucket);
  }

  const built = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, days]) => {
      const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
      const { year, month } = parseDateKey(sortedDays[0].date);
      const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const prevMonthLastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
      const totalCount = sortedDays.reduce((sum, day) => sum + day.count, 0);
      const dayMap = new Map(
        sortedDays.map((day) => [
          day.date,
          {
            key: day.date,
            day: parseDateKey(day.date).day,
            count: day.count,
            detailStatus: day.detail_status,
            items: day.items,
          } satisfies CalendarCell,
        ]),
      );

      const todayKey = data.as_of_date;
      const futureOrToday = sortedDays.find((day) => day.date >= todayKey && day.count > 0)?.date;
      const defaultSelectedKey =
        sortedDays.find((day) => day.date === todayKey)?.date ??
        futureOrToday ??
        sortedDays.find((day) => day.count > 0)?.date ??
        sortedDays[0].date;

      const cells: CalendarCell[] = [];

      for (let index = 0; index < firstWeekday; index += 1) {
        const mutedDay = prevMonthLastDay - firstWeekday + index + 1;
        const prevDate = new Date(Date.UTC(year, month - 2, mutedDay));
        cells.push({
          key: `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-${String(
            prevDate.getUTCDate(),
          ).padStart(2, "0")}`,
          day: mutedDay,
          count: 0,
          detailStatus: "missing",
          items: [],
          muted: true,
        });
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = `${id}-${String(day).padStart(2, "0")}`;
        cells.push(
          dayMap.get(key) ?? {
            key,
            day,
            count: 0,
            detailStatus: "missing",
            items: [],
          },
        );
      }

      const trailingCount = (7 - (cells.length % 7)) % 7;
      for (let index = 1; index <= trailingCount; index += 1) {
        const nextDate = new Date(Date.UTC(year, month - 1, daysInMonth + index));
        cells.push({
          key: `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(
            nextDate.getUTCDate(),
          ).padStart(2, "0")}`,
          day: nextDate.getUTCDate(),
          count: 0,
          detailStatus: "missing",
          items: [],
          muted: true,
        });
      }

      return {
        id,
        label: formatMonthLabel(year, month),
        updatedAt: formatUpdatedAt(data.as_of_date),
        totalCount,
        selectedKey: defaultSelectedKey,
        cells,
      };
    });

  if (built.length === 0) {
    return [];
  }

  const targetYear = parseDateKey(data.as_of_date).year;
  const monthMap = new Map(built.map((month) => [month.id, month]));
  const updatedAt = formatUpdatedAt(data.as_of_date);

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const id = `${targetYear}-${String(month).padStart(2, "0")}`;
    return monthMap.get(id) ?? createEmptyMonth(id, updatedAt);
  });
}

function getEmptyStateMessage(day: CalendarCell) {
  if (day.detailStatus === "empty") {
    return "この日は件数だけ反映されていて、詳細一覧はまだ空です。";
  }
  if (day.detailStatus === "missing") {
    return "この日の詳細データはまだ未取得です。";
  }
  return "この日の決算予定はまだありません。";
}

export default function ToolClient({ data }: { data: EarningsCalendarResponse }) {
  const months = useMemo(() => buildMonths(data), [data]);
  const initialMonthIndex = useMemo(() => {
    const targetMonth = data.as_of_date.slice(0, 7);
    const found = months.findIndex((month) => month.id === targetMonth);
    return found >= 0 ? found : 0;
  }, [data.as_of_date, months]);
  const [monthIndex, setMonthIndex] = useState(initialMonthIndex);
  const month = months[monthIndex] ?? null;
  const [selectedKey, setSelectedKey] = useState(months[initialMonthIndex]?.selectedKey ?? "");

  const selectedDay = useMemo(() => {
    if (!month) return null;
    return (
      month.cells.find((cell) => cell.key === selectedKey) ??
      month.cells.find((cell) => cell.key === month.selectedKey) ??
      month.cells.find((cell) => !cell.muted && cell.count > 0) ??
      month.cells.find((cell) => !cell.muted) ??
      month.cells[0]
    );
  }, [month, selectedKey]);

  if (!month || !selectedDay) {
    return (
      <main style={styles.page}>
        <div style={styles.mobileShell}>
          <header style={styles.headerRow}>
            <div style={styles.brandRow}>
              <div style={styles.brandMark} aria-hidden>
                ■
              </div>
              <div style={styles.brandName}>mini-tools</div>
            </div>
          </header>

          <section style={styles.heroBlock}>
            <div style={styles.heroEyebrow}>決算カレンダー beta</div>
            <h1 style={styles.heroTitle}>決算カレンダー</h1>
            <p style={styles.heroNote}>
              決算データを読み込めなかったため、いまはカレンダーを表示できません。
            </p>
          </section>

          <article style={styles.emptyCard}>
            <div style={styles.emptyTitle}>決算データがまだありません</div>
            <div style={styles.emptyNote}>
              market_info 側の出力が空だった場合に備えた空状態です。データが更新されたらここに月間カレンダーが表示されます。
            </div>
          </article>
        </div>
      </main>
    );
  }

  const selectedItems = selectedDay.items;
  const selectedCount = selectedDay.count;

  function moveMonth(direction: -1 | 1) {
    if (months.length <= 1) return;
    setMonthIndex((current) => {
      const next = (current + direction + months.length) % months.length;
      setSelectedKey(months[next].selectedKey);
      return next;
    });
  }

  return (
    <main style={styles.page}>
      <div style={styles.mobileShell}>
        <section style={styles.heroBlock}>
          <div style={styles.heroEyebrow}>決算カレンダー beta</div>
          <h1 style={styles.heroTitle}>決算カレンダー</h1>
          <p style={styles.heroNote}>
            月ごとの予定を見ながら、気になる日の決算銘柄を下で確認できます。
          </p>
        </section>

        <section style={styles.calendarCard}>
          <div style={styles.calendarTop}>
            <button
              type="button"
              style={{
                ...styles.navBtn,
                ...(months.length <= 1 ? styles.navBtnDisabled : {}),
              }}
              onClick={() => moveMonth(-1)}
              disabled={months.length <= 1}
              aria-label="前月へ"
            >
              ‹
            </button>
            <div style={styles.monthLabel}>{month.label}</div>
            <button
              type="button"
              style={{
                ...styles.navBtn,
                ...(months.length <= 1 ? styles.navBtnDisabled : {}),
              }}
              onClick={() => moveMonth(1)}
              disabled={months.length <= 1}
              aria-label="次月へ"
            >
              ›
            </button>
          </div>

          <div style={styles.calendarMeta}>
            <span style={styles.metaChip}>日本株</span>
            <span style={styles.metaChipMuted}>月間ビュー</span>
            <span style={styles.metaChipStrong}>今月 {month.totalCount}件</span>
          </div>

          <div style={styles.weekHeader}>
            {WEEK_LABELS.map((d) => (
              <span key={d} style={styles.weekCell}>
                {d}
              </span>
            ))}
          </div>

          <div style={styles.calendarGrid}>
            {month.cells.map((item) => {
              const isSelected = item.key === selectedDay.key;
              const isClickable = !item.muted && item.count > 0;
              const hasItems = item.items.length > 0;

              return (
                <button
                  key={item.key}
                  type="button"
                  style={{
                    ...styles.dayCell,
                    ...(item.muted ? styles.dayMuted : {}),
                    ...(isSelected ? styles.dayActive : {}),
                    ...(isClickable ? styles.dayClickable : {}),
                  }}
                  disabled={!isClickable}
                  onClick={() => setSelectedKey(item.key)}
                >
                  <div style={styles.dayNumber}>{item.day}</div>
                  {item.count > 0 ? (
                    <div
                      style={{
                        ...styles.countBadge,
                        ...(item.count >= 20 ? styles.countBadgeBusy : {}),
                        ...(isSelected ? styles.countBadgeActive : {}),
                        ...(!isSelected && !hasItems ? styles.countBadgeLocked : {}),
                      }}
                    >
                      {item.count}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

        </section>

        <section style={styles.listSection}>
          <div style={styles.sectionAccent} />
          <div>
            <div style={styles.sectionLabel}>日別一覧</div>
            <div style={styles.sectionTitle}>
              {formatSelectedTitle(selectedDay.key)} {selectedCount}件
            </div>
          </div>
        </section>

        <section style={styles.itemList}>
          {selectedItems.length === 0 ? (
            <article style={styles.emptyCard}>
              <div style={styles.emptyTitle}>この日の詳細一覧はまだありません</div>
              <div style={styles.emptyNote}>{getEmptyStateMessage(selectedDay)}</div>
            </article>
          ) : (
            selectedItems.map((item, index) => (
              <article
                key={
                  item.event_id ??
                  `${selectedDay.key}-${item.code}-${item.time}-${item.announcement_type}-${index}`
                }
                style={styles.itemCard}
              >
                <div style={styles.codeBlock}>
                  <div style={styles.codeLabel}>CODE</div>
                  <div style={styles.codeValue}>{item.code}</div>
                </div>

                <div style={styles.itemMain}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemMetaRow}>
                    <span>{normalizeMarket(item.market)}</span>
                    <span>•</span>
                    <span>{item.announcement_type}</span>
                    {shouldShowPublishStatus(item.publish_status) ? (
                      <>
                        <span>•</span>
                        <span>{item.publish_status}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div style={styles.itemTimeBlock}>
                  <div style={styles.timeLabel}>時刻</div>
                  <div style={styles.timeValue}>{normalizeTimeLabel(item.time || "--:--")}</div>
                </div>
              </article>
            ))
          )}
        </section>

        <div style={styles.updatedAt}>データ更新日: {month.updatedAt}</div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 12px 56px",
    background:
      "radial-gradient(1000px 420px at 20% 0%, rgba(37, 99, 235, 0.08), transparent 58%), #eef2f7",
  },
  mobileShell: {
    width: "100%",
    maxWidth: 440,
    margin: "0 auto",
    background: "#f8f9fb",
    borderRadius: 28,
    border: "1px solid rgba(15, 23, 42, 0.06)",
    boxShadow: "0 20px 48px rgba(15, 23, 42, 0.10)",
    padding: "18px 18px 24px",
  },
  heroBlock: {
    marginBottom: 16,
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
  },
  heroTitle: {
    margin: "10px 0 6px",
    fontSize: 22,
    lineHeight: 1.2,
    letterSpacing: -0.4,
    color: "#1f2937",
  },
  heroNote: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#667085",
  },
  calendarCard: {
    background: "#fff",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
    border: "1px solid rgba(15, 23, 42, 0.04)",
  },
  calendarTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: "1px solid rgba(37, 84, 255, 0.12)",
    background: "#f5f8ff",
    color: "#2554ff",
    fontSize: 26,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
    display: "grid",
    placeItems: "center",
  },
  navBtnDisabled: {
    opacity: 0.45,
    cursor: "default",
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: 800,
    color: "#374151",
  },
  calendarMeta: {
    display: "flex",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  metaChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3146d4",
    fontSize: 11,
    fontWeight: 800,
  },
  metaChipMuted: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f4f6fb",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },
  metaChipStrong: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#e7edff",
    color: "#2f47ca",
    fontSize: 11,
    fontWeight: 800,
  },
  weekHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 8,
  },
  weekCell: {
    fontSize: 10,
    fontWeight: 800,
    color: "#9ca3af",
    textAlign: "center",
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
  },
  dayCell: {
    minHeight: 56,
    borderRadius: 14,
    padding: "7px 5px 6px",
    background: "#f3f6fb",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    border: "none",
  },
  dayClickable: {
    cursor: "pointer",
    boxShadow: "inset 0 0 0 1px rgba(37, 84, 255, 0.06)",
  },
  dayMuted: {
    opacity: 0.45,
  },
  dayActive: {
    background: "#edf2ff",
    boxShadow: "inset 0 0 0 1px rgba(37, 84, 255, 0.14)",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: 700,
    color: "#475569",
  },
  countBadge: {
    minWidth: 24,
    padding: "2px 6px",
    borderRadius: 999,
    background: "#e7edff",
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: 800,
    textAlign: "center",
  },
  countBadgeActive: {
    background: "#2554ff",
    color: "#fff",
  },
  countBadgeBusy: {
    background: "#dbe5ff",
    color: "#2f47ca",
  },
  countBadgeLocked: {
    background: "#eef2f7",
    color: "#7c8799",
  },
  listSection: {
    marginTop: 22,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  sectionAccent: {
    width: 3,
    height: 22,
    borderRadius: 999,
    background: "linear-gradient(180deg, #7562d8 0%, #9a88f5 100%)",
  },
  sectionLabel: {
    marginBottom: 3,
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 0.2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#374151",
  },
  itemList: {
    marginTop: 14,
    display: "grid",
    gap: 12,
  },
  itemCard: {
    background: "#fff",
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gridTemplateColumns: "56px minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
    border: "1px solid rgba(15, 23, 42, 0.04)",
  },
  codeBlock: {
    display: "grid",
    gap: 4,
    justifyItems: "center",
    padding: "8px 6px",
    borderRadius: 12,
    background: "#f5f8ff",
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#94a3b8",
  },
  codeValue: {
    fontSize: 18,
    fontWeight: 900,
    color: "#2554ff",
    lineHeight: 1,
  },
  itemMain: {
    minWidth: 0,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 800,
    color: "#1f2937",
    lineHeight: 1.35,
  },
  itemMetaRow: {
    marginTop: 4,
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.4,
  },
  itemTimeBlock: {
    textAlign: "right",
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#9ca3af",
  },
  timeValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: 900,
    color: "#374151",
  },
  emptyCard: {
    background: "#fff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#374151",
  },
  emptyNote: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#667085",
  },
  updatedAt: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 12,
    color: "#6b7280",
  },
};
