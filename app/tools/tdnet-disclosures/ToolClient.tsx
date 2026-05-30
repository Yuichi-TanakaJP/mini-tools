"use client";

import { useMemo, useState } from "react";
import { useRouterTransition } from "@/app/tools/_shared/use-router-transition";
import type { TdnetDisclosureItem, TdnetDisclosureListResponse } from "./types";

type FilterKey = "financialOnly" | "earningsOnly" | "hideCorrections";
type LinkFilter = "all" | "pdf" | "html" | "xbrl";
type TimeFilter = "all" | "morning" | "lunch" | "afternoon" | "afterClose";
type TopicFilter = "all" | "performance" | "dividend";
type RangeDays = "1" | "7" | "30";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "financialOnly", label: "財務関連のみ" },
  { key: "earningsOnly", label: "決算短信のみ" },
  { key: "hideCorrections", label: "訂正を除外" },
];

const LINK_FILTERS: { key: LinkFilter; label: string }[] = [
  { key: "all", label: "リンクすべて" },
  { key: "pdf", label: "PDFあり" },
  { key: "html", label: "HTMLあり" },
  { key: "xbrl", label: "XBRLあり" },
];

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: "all", label: "時間すべて" },
  { key: "morning", label: "午前" },
  { key: "lunch", label: "昼休み" },
  { key: "afternoon", label: "午後" },
  { key: "afterClose", label: "15:30以降" },
];

const TOPIC_FILTERS: { key: TopicFilter; label: string }[] = [
  { key: "all", label: "テーマすべて" },
  { key: "performance", label: "業績" },
  { key: "dividend", label: "配当" },
];

const RANGE_OPTIONS: { key: RangeDays; label: string }[] = [
  { key: "1", label: "当日" },
  { key: "7", label: "過去7日" },
  { key: "30", label: "過去30日" },
];

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const dow = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${dow[d.getDay()]}）`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateInputValue(value?: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function toRangeDays(value?: string): RangeDays {
  if (value === "7" || value === "30") return value;
  return "1";
}

function getMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function matchesTimeFilter(item: TdnetDisclosureItem, filter: TimeFilter): boolean {
  if (filter === "all") return true;
  const minutes = getMinutes(item.disclosure_time);
  if (minutes === null) return false;

  if (filter === "morning") return minutes < 11 * 60 + 30;
  if (filter === "lunch") return minutes >= 11 * 60 + 30 && minutes < 13 * 60;
  if (filter === "afternoon") return minutes >= 13 * 60 && minutes < 15 * 60 + 30;
  return minutes >= 15 * 60 + 30;
}

function matchesTopicFilter(item: TdnetDisclosureItem, filter: TopicFilter): boolean {
  if (filter === "all") return true;

  const text = `${item.title} ${item.disclosure_category}`.toLowerCase();
  if (filter === "dividend") {
    return text.includes("配当") || text.includes("剰余金");
  }

  return (
    item.is_earnings_release ||
    text.includes("業績") ||
    text.includes("予想") ||
    text.includes("修正") ||
    text.includes("決算")
  );
}

function getYahooCode(securityCode: string): string {
  return securityCode.replace(/0+$/, "");
}

function LinkPill({ href, label }: { href: string; label: string }) {
  if (!href) {
    return (
      <span
        style={{
          display: "inline-flex",
          minWidth: 44,
          justifyContent: "center",
          padding: "3px 8px",
          borderRadius: 6,
          border: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
          fontSize: 11,
          fontWeight: 700,
          opacity: 0.45,
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        minWidth: 44,
        justifyContent: "center",
        padding: "3px 8px",
        borderRadius: 6,
        border: "1px solid var(--color-accent)",
        background: "var(--color-accent-sub)",
        color: "var(--color-accent)",
        fontSize: 11,
        fontWeight: 800,
        textDecoration: "none",
      }}
    >
      {label}
    </a>
  );
}

function FlagPill({
  active,
  label,
  tone,
}: {
  active: boolean;
  label: string;
  tone: "success" | "warning";
}) {
  const color = tone === "success" ? "var(--color-success)" : "var(--color-warning)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2px 7px",
        borderRadius: 999,
        border: `1px solid ${active ? color : "var(--color-border)"}`,
        color: active ? color : "var(--color-text-muted)",
        background: active ? "var(--color-bg-input)" : "transparent",
        fontSize: 11,
        fontWeight: 800,
        opacity: active ? 1 : 0.42,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function DisclosureRow({ item }: { item: TdnetDisclosureItem }) {
  const yahooCode = getYahooCode(item.security_code);

  return (
    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
      <td style={{ padding: "12px 10px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
        {item.disclosure_time || "--:--"}
        <div style={{ marginTop: 3, color: "var(--color-text-muted)", fontSize: 10, fontWeight: 700 }}>
          {item.disclosure_date}
        </div>
      </td>
      <td style={{ padding: "12px 10px", minWidth: 156 }}>
        <div
          title={item.company_name}
          style={{
            color: "var(--color-text)",
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.35,
          }}
        >
          {item.company_name || "会社名未設定"}
        </div>
        {item.security_code ? (
          <a
            href={`https://finance.yahoo.co.jp/quote/${yahooCode}.T`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              marginTop: 4,
              padding: "1px 6px",
              borderRadius: 4,
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-accent)",
              fontSize: 11,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            {item.security_code.slice(0, 4)}
          </a>
        ) : null}
      </td>
      <td style={{ padding: "12px 10px", minWidth: 360 }}>
        <div
          title={item.title}
          style={{
            color: "var(--color-text)",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {item.title || "タイトル未設定"}
        </div>
        <div
          style={{
            marginTop: 5,
            color: "var(--color-text-muted)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {item.disclosure_category || "カテゴリ未設定"}
        </div>
      </td>
      <td style={{ padding: "12px 10px", minWidth: 154 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <LinkPill href={item.pdf_url} label="PDF" />
          <LinkPill href={item.html_url} label="HTML" />
          <LinkPill href={item.xbrl_url} label="XBRL" />
        </div>
      </td>
      <td style={{ padding: "12px 10px", minWidth: 124 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <FlagPill active={item.is_earnings_release} label="決算短信" tone="success" />
          <FlagPill active={item.is_correction} label="訂正" tone="warning" />
        </div>
      </td>
    </tr>
  );
}

export default function ToolClient({
  data,
  requestedDate,
  requestedRange,
}: {
  data: TdnetDisclosureListResponse | null;
  requestedDate?: string;
  requestedRange?: string;
}) {
  const { navigate, isPendingFor } = useRouterTransition();
  const [dateInput, setDateInput] = useState(toDateInputValue(requestedDate ?? data?.target_date));
  const [rangeDays, setRangeDays] = useState<RangeDays>(toRangeDays(requestedRange));
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [topicFilter, setTopicFilter] = useState<TopicFilter>("all");
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    financialOnly: false,
    earningsOnly: false,
    hideCorrections: false,
  });

  const targetDate = data?.target_date ?? toDateInputValue(requestedDate);
  const totalCount = data?.total_count ?? 0;
  const actualRangeDays = data?.range_days ?? Number(rangeDays);
  const loadedDateCount = data?.loaded_dates?.length ?? (data ? 1 : 0);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of data?.items ?? []) {
      const key = item.disclosure_category || "カテゴリ未設定";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data?.items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (data?.items ?? []).filter((item) => {
      if (filters.financialOnly && !item.is_financial_related) return false;
      if (filters.earningsOnly && !item.is_earnings_release) return false;
      if (filters.hideCorrections && item.is_correction) return false;
      if (categoryFilter !== "all" && (item.disclosure_category || "カテゴリ未設定") !== categoryFilter) return false;
      if (linkFilter === "pdf" && !item.has_pdf) return false;
      if (linkFilter === "html" && !item.has_html) return false;
      if (linkFilter === "xbrl" && !item.has_xbrl) return false;
      if (!matchesTimeFilter(item, timeFilter)) return false;
      if (!matchesTopicFilter(item, topicFilter)) return false;
      if (!query) return true;

      return (
        item.security_code.includes(query) ||
        item.company_name.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.disclosure_category.toLowerCase().includes(query)
      );
    });
  }, [categoryFilter, data?.items, filters, linkFilter, searchQuery, timeFilter, topicFilter]);

  const applyDate = () => {
    if (!dateInput) {
      navigate(
        rangeDays === "1" ? "/tools/tdnet-disclosures" : `/tools/tdnet-disclosures?range=${rangeDays}`,
        { key: "apply" },
      );
      return;
    }
    navigate(`/tools/tdnet-disclosures?date=${dateInput}&range=${rangeDays}`, { key: "apply" });
  };

  const navigateByDays = (days: number) => {
    const baseDate = dateInput || targetDate;
    if (!baseDate) return;
    const nextDate = addDays(baseDate, days);
    setDateInput(nextDate);
    navigate(`/tools/tdnet-disclosures?date=${nextDate}&range=${rangeDays}`, {
      key: days < 0 ? "prev" : "next",
    });
  };

  const changeRange = (nextRange: RangeDays) => {
    setRangeDays(nextRange);
    if (!dateInput) {
      navigate(
        nextRange === "1" ? "/tools/tdnet-disclosures" : `/tools/tdnet-disclosures?range=${nextRange}`,
        { key: "range" },
      );
      return;
    }
    navigate(`/tools/tdnet-disclosures?date=${dateInput}&range=${nextRange}`, { key: "range" });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setLinkFilter("all");
    setTimeFilter("all");
    setTopicFilter("all");
    setFilters({
      financialOnly: false,
      earningsOnly: false,
      hideCorrections: false,
    });
  };

  const toggleFilter = (key: FilterKey) => {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "0 16px 64px" }}>
      <section style={{ padding: "32px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 26 }}>📢</span>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
            TDNET適時開示一覧
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
          TDNETの全適時開示を日付ごとに確認できます。PDF / HTML / XBRL はTDNET公開元へのリンクで表示します。
        </p>
      </section>

      <section
        style={{
          background: "var(--color-bg-card)",
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          padding: "12px 16px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 800 }}>
            日付
          </span>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            style={{
              minHeight: 36,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1.5px solid var(--color-border)",
              background: "var(--color-bg-input)",
              color: "var(--color-text)",
              fontSize: 13,
              fontWeight: 700,
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => navigateByDays(-1)}
          disabled={(!dateInput && !targetDate) || isPendingFor("prev")}
          aria-label="前の日"
          aria-busy={isPendingFor("prev")}
          style={{
            width: 36,
            minHeight: 36,
            borderRadius: 8,
            border: "1.5px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-text)",
            fontSize: 18,
            fontWeight: 900,
            cursor: isPendingFor("prev") ? "wait" : dateInput || targetDate ? "pointer" : "default",
            opacity: isPendingFor("prev") ? 0.55 : dateInput || targetDate ? 1 : 0.35,
          }}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => navigateByDays(1)}
          disabled={(!dateInput && !targetDate) || isPendingFor("next")}
          aria-label="次の日"
          aria-busy={isPendingFor("next")}
          style={{
            width: 36,
            minHeight: 36,
            borderRadius: 8,
            border: "1.5px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-text)",
            fontSize: 18,
            fontWeight: 900,
            cursor: isPendingFor("next") ? "wait" : dateInput || targetDate ? "pointer" : "default",
            opacity: isPendingFor("next") ? 0.55 : dateInput || targetDate ? 1 : 0.35,
          }}
        >
          →
        </button>
        <button
          type="button"
          onClick={applyDate}
          disabled={isPendingFor("apply")}
          aria-busy={isPendingFor("apply")}
          style={{
            minHeight: 36,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1.5px solid var(--color-accent)",
            background: "var(--color-accent)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            cursor: isPendingFor("apply") ? "wait" : "pointer",
            opacity: isPendingFor("apply") ? 0.55 : 1,
          }}
        >
          表示
        </button>
        <button
          type="button"
          onClick={() => {
            setDateInput("");
            navigate(
              rangeDays === "1" ? "/tools/tdnet-disclosures" : `/tools/tdnet-disclosures?range=${rangeDays}`,
              { key: "latest" },
            );
          }}
          disabled={isPendingFor("latest")}
          aria-busy={isPendingFor("latest")}
          style={{
            minHeight: 36,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1.5px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-text)",
            fontSize: 13,
            fontWeight: 800,
            cursor: isPendingFor("latest") ? "wait" : "pointer",
            opacity: isPendingFor("latest") ? 0.55 : 1,
          }}
        >
          latest
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 800 }}>
            範囲
          </span>
          <select
            value={rangeDays}
            onChange={(e) => changeRange(e.target.value as RangeDays)}
            disabled={isPendingFor("range")}
            aria-busy={isPendingFor("range")}
            style={{
              minHeight: 36,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1.5px solid var(--color-border)",
              background: "var(--color-bg-input)",
              color: "var(--color-text)",
              fontSize: 13,
              fontWeight: 700,
              cursor: isPendingFor("range") ? "wait" : "pointer",
              opacity: isPendingFor("range") ? 0.55 : 1,
            }}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 900 }}>
            {targetDate ? formatDate(targetDate) : "データ未取得"}
          </span>
          {actualRangeDays > 1 ? (
            <span style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 700 }}>
              対象 {loadedDateCount}日分
            </span>
          ) : null}
          <span style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 700 }}>
            総件数 {totalCount.toLocaleString()}件
          </span>
          {data && filteredItems.length !== totalCount ? (
            <span style={{ color: "var(--color-accent)", fontSize: 12, fontWeight: 800 }}>
              表示中 {filteredItems.length.toLocaleString()}件
            </span>
          ) : null}
        </div>
      </section>

      {data ? (
        <section
          style={{
            background: "var(--color-bg-card)",
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            padding: "12px 16px",
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="銘柄コード・会社名・タイトル・カテゴリで検索..."
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--color-border)",
              background: "var(--color-bg-input)",
              color: "var(--color-text)",
              fontSize: 13,
              outline: "none",
            }}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flex: "1 1 220px", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 800 }}>
                カテゴリ
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  minHeight: 36,
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1.5px solid var(--color-border)",
                  background: "var(--color-bg-input)",
                  color: "var(--color-text)",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <option value="all">カテゴリすべて</option>
                {categoryCounts.map(([category, count]) => (
                  <option key={category} value={category}>
                    {category} ({count})
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={resetFilters}
              style={{
                alignSelf: "end",
                minHeight: 36,
                padding: "7px 12px",
                borderRadius: 8,
                border: "1.5px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text)",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              条件クリア
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => toggleFilter(filter.key)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1.5px solid",
                  borderColor: filters[filter.key] ? "var(--color-accent)" : "var(--color-border)",
                  background: filters[filter.key] ? "var(--color-accent-sub)" : "transparent",
                  color: filters[filter.key] ? "var(--color-accent)" : "var(--color-text-muted)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TOPIC_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setTopicFilter(filter.key)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1.5px solid",
                  borderColor: topicFilter === filter.key ? "var(--color-accent)" : "var(--color-border)",
                  background: topicFilter === filter.key ? "var(--color-accent-sub)" : "transparent",
                  color: topicFilter === filter.key ? "var(--color-accent)" : "var(--color-text-muted)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {LINK_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setLinkFilter(filter.key)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1.5px solid",
                  borderColor: linkFilter === filter.key ? "var(--color-accent)" : "var(--color-border)",
                  background: linkFilter === filter.key ? "var(--color-accent-sub)" : "transparent",
                  color: linkFilter === filter.key ? "var(--color-accent)" : "var(--color-text-muted)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TIME_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setTimeFilter(filter.key)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1.5px solid",
                  borderColor: timeFilter === filter.key ? "var(--color-accent)" : "var(--color-border)",
                  background: timeFilter === filter.key ? "var(--color-accent-sub)" : "transparent",
                  color: timeFilter === filter.key ? "var(--color-accent)" : "var(--color-text-muted)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section
        style={{
          background: "var(--color-bg-card)",
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      >
        {!data ? (
          <div style={{ padding: "34px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
            TDNETデータを取得できませんでした。API設定または通信状況を確認してください。
          </div>
        ) : data.items.length === 0 ? (
          <div style={{ padding: "34px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
            この日の適時開示はありません。休日やTDNET休止日の latest では0件になる場合があります。
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: "34px 20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>
            条件に一致する適時開示はありません。
          </div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", tableLayout: "auto" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border-strong)" }}>
                  {["時刻", "会社", "タイトル / カテゴリ", "リンク", "フラグ"].map((label) => (
                    <th
                      key={label}
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        color: "var(--color-text-muted)",
                        fontSize: 12,
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <DisclosureRow
                    key={`${item.disclosure_date}-${item.disclosure_time}-${item.security_code}-${idx}`}
                    item={item}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p style={{ marginTop: 12, color: "var(--color-text-muted)", fontSize: 11, lineHeight: 1.6 }}>
        ※ データは market-info-api 経由で取得しています。開示本文は再ホストせず、TDNET公開元へのリンクのみ表示します。
      </p>
    </main>
  );
}
