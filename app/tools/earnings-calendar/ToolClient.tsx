"use client";

import { useMemo, useState } from "react";
import type {
  EarningsCalendarDay,
  EarningsCalendarItem,
  EarningsCalendarManifestMonth,
  EarningsCalendarPageData,
  JpxMarketClosedDay,
} from "./types";

type CalendarCell = {
  key: string;
  day: number;
  count: number;
  detailStatus: EarningsCalendarDay["detail_status"];
  items: EarningsCalendarItem[];
  marketClosed: boolean;
  marketClosedLabel: string;
  muted?: boolean;
};

type CalendarMonth = {
  id: string;
  label: string;
  updatedAt: string;
  totalCount: number;
  selectedKey: string;
  partial: boolean;
  bucket: EarningsCalendarManifestMonth["bucket"];
  cells: CalendarCell[];
};

const WEEK_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function parseYearMonth(id: string) {
  const [year, month] = id.split("-").map(Number);
  return { year, month };
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

function todayJstKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addMonths(year: number, month: number, offset: number) {
  const base = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
  };
}

function normalizeMarket(market: string) {
  if (market === "TKY") return "東証";
  return market;
}

function normalizeTimeLabel(time: string) {
  return time.replace(/\s*\/\s*（?予定）?$/, "").replace(/\s*\/\s*\(予定\)$/, "");
}

function createEmptyMonth(
  id: string,
  updatedAt: string,
  holidayMap: Map<string, JpxMarketClosedDay>,
): CalendarMonth {
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
      marketClosed: false,
      marketClosedLabel: "",
      muted: true,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${id}-${String(day).padStart(2, "0")}`;
    cells.push({
      key,
      day,
      count: 0,
      detailStatus: "missing",
      items: [],
      marketClosed: holidayMap.get(key)?.market_closed ?? false,
      marketClosedLabel: holidayMap.get(key)?.label ?? "",
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
      marketClosed: false,
      marketClosedLabel: "",
      muted: true,
    });
  }

  return {
    id,
    label: formatMonthLabel(year, month),
    updatedAt,
    totalCount: 0,
    selectedKey: `${id}-01`,
    partial: false,
    bucket: "future",
    cells,
  };
}

function buildMonth(
  entry: EarningsCalendarManifestMonth,
  days: EarningsCalendarDay[],
  holidayMap: Map<string, JpxMarketClosedDay>,
  asOfDate: string,
  initialFocusDate: string,
): CalendarMonth {
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const { year, month } = sortedDays.length > 0 ? parseDateKey(sortedDays[0].date) : parseYearMonth(entry.id);
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
        marketClosed: holidayMap.get(day.date)?.market_closed ?? false,
        marketClosedLabel: holidayMap.get(day.date)?.label ?? "",
      } satisfies CalendarCell,
    ]),
  );

  const futureOrToday = sortedDays.find((day) => day.date >= initialFocusDate && day.count > 0)?.date;
  const defaultSelectedKey =
    sortedDays.find((day) => day.date === initialFocusDate)?.date ??
    futureOrToday ??
    sortedDays.find((day) => day.count > 0)?.date ??
    `${entry.id}-01`;

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
      marketClosed: false,
      marketClosedLabel: "",
      muted: true,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${entry.id}-${String(day).padStart(2, "0")}`;
    cells.push(
      dayMap.get(key) ?? {
        key,
        day,
        count: 0,
        detailStatus: "missing",
        items: [],
        marketClosed: holidayMap.get(key)?.market_closed ?? false,
        marketClosedLabel: holidayMap.get(key)?.label ?? "",
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
      marketClosed: false,
      marketClosedLabel: "",
      muted: true,
    });
  }

  return {
    id: entry.id,
    label: formatMonthLabel(year, month),
    updatedAt: formatUpdatedAt(asOfDate),
    totalCount,
    selectedKey: defaultSelectedKey,
    partial: entry.partial,
    bucket: entry.bucket,
    cells,
  };
}

function buildMonths(data: EarningsCalendarPageData, initialFocusDate: string): CalendarMonth[] {
  const holidayMap = new Map(data.holidays.days.map((day) => [day.date, day]));
  const built = data.manifest.months
    .map((entry) => {
      const source = data.monthData[entry.id];
      if (!source) return null;
      return buildMonth(entry, source.calendar, holidayMap, data.manifest.as_of_date, initialFocusDate);
    })
    .filter((month): month is CalendarMonth => month !== null);

  if (built.length === 0) {
    return [];
  }

  const monthMap = new Map(built.map((month) => [month.id, month]));
  const updatedAt = formatUpdatedAt(data.manifest.as_of_date);
  const { year: asOfYear, month: asOfMonth } = parseDateKey(data.manifest.as_of_date);
  const latestLoaded = data.manifest.months
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .at(-1);
  const earliestLoaded = data.manifest.months
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  const rangeStart = earliestLoaded
    ? { year: earliestLoaded.year, month: earliestLoaded.month }
    : { year: asOfYear, month: asOfMonth };
  const requestedRangeEnd = addMonths(asOfYear, asOfMonth, 12);
  const { year: holidayToYear, month: holidayToMonth } = parseDateKey(data.holidays.to);
  const rangeEnd =
    requestedRangeEnd.year < holidayToYear ||
    (requestedRangeEnd.year === holidayToYear && requestedRangeEnd.month <= holidayToMonth)
      ? requestedRangeEnd
      : { year: holidayToYear, month: holidayToMonth };

  const months: CalendarMonth[] = [];
  let cursor = { ...rangeStart };

  while (
    cursor.year < rangeEnd.year ||
    (cursor.year === rangeEnd.year && cursor.month <= rangeEnd.month)
  ) {
    const id = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;
    const existing = monthMap.get(id);
    if (existing) {
      months.push(existing);
    } else {
      const bucket =
        cursor.year < asOfYear || (cursor.year === asOfYear && cursor.month < asOfMonth)
          ? "past"
          : "future";
      const emptyMonth = createEmptyMonth(id, updatedAt, holidayMap);
      months.push({ ...emptyMonth, bucket, partial: false });
    }
    cursor = addMonths(cursor.year, cursor.month, 1);
  }

  return months;
}

function getEmptyStateMessage(day: CalendarCell) {
  if (day.marketClosed) {
    return day.marketClosedLabel ? `JPX休場日です（${day.marketClosedLabel}）` : "JPX休場日です";
  }
  if (day.detailStatus === "missing" || (day.count > 0 && day.items.length === 0)) {
    return "個別銘柄のデータは未反映です";
  }
  return "決算予定はありません";
}

function getEmptyStateTitle(day: CalendarCell) {
  if (day.marketClosed) {
    return "休場日です";
  }
  if (day.detailStatus === "missing" || (day.count > 0 && day.items.length === 0)) {
    return "決算一覧は未反映です";
  }
  return "決算一覧はありません";
}

export default function ToolClient({ data }: { data: EarningsCalendarPageData }) {
  const initialFocusDate = useMemo(() => {
    const today = todayJstKey();
    const todayMonth = today.slice(0, 7);
    return data.manifest.months.some((month) => month.id === todayMonth) ? today : data.manifest.as_of_date;
  }, [data.manifest.as_of_date, data.manifest.months]);
  const months = useMemo(() => buildMonths(data, initialFocusDate), [data, initialFocusDate]);
  const initialMonthIndex = useMemo(() => {
    const targetMonth = initialFocusDate.slice(0, 7);
    const found = months.findIndex((month) => month.id === targetMonth);
    return found >= 0 ? found : 0;
  }, [initialFocusDate, months]);
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
      const next = Math.min(months.length - 1, Math.max(0, current + direction));
      if (next === current) return current;
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
                ...(monthIndex <= 0 ? styles.navBtnDisabled : {}),
              }}
              onClick={() => moveMonth(-1)}
              disabled={monthIndex <= 0}
              aria-label="前月へ"
            >
              ‹
            </button>
            <div style={styles.monthLabel}>{month.label}</div>
            <button
              type="button"
              style={{
                ...styles.navBtn,
                ...(monthIndex >= months.length - 1 ? styles.navBtnDisabled : {}),
              }}
              onClick={() => moveMonth(1)}
              disabled={monthIndex >= months.length - 1}
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
              const isClickable = !item.muted && (item.count > 0 || item.marketClosed);
              const hasItems = item.items.length > 0;

              return (
                <button
                  key={item.key}
                  type="button"
                  style={{
                    ...styles.dayCell,
                    ...(item.muted ? styles.dayMuted : {}),
                    ...(item.marketClosed ? styles.dayHoliday : {}),
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
              {formatSelectedTitle(selectedDay.key)}
              {selectedDay.marketClosed
                ? ` ${selectedDay.marketClosedLabel || "休場日"}`
                : ` ${selectedCount}件`}
            </div>
          </div>
        </section>

        <section style={styles.itemList}>
          {selectedItems.length === 0 ? (
            <article style={styles.emptyCard}>
              <div style={styles.emptyTitle}>{getEmptyStateTitle(selectedDay)}</div>
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
                <div style={styles.itemMain}>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemMetaRow}>
                    <span>{item.code}</span>
                    <span>{normalizeMarket(item.market)}</span>
                    <span>{item.announcement_type}</span>
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
    padding: "0 8px 24px",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    marginBottom: 12,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    color: "#2554ff",
    fontSize: 18,
    lineHeight: 1,
  },
  brandName: {
    color: "#0f2748",
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: -0.2,
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
  dayHoliday: {
    background: "#f7f7f2",
    boxShadow: "inset 0 0 0 1px rgba(148, 163, 184, 0.08)",
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
    alignItems: "flex-start",
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
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
    border: "1px solid rgba(15, 23, 42, 0.04)",
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
    gap: 10,
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
