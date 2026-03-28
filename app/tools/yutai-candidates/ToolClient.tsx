"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addMemoItemFromCandidate, isImportedMonthlyYutaiCandidate } from "@/app/tools/yutai-memo/candidate-import";
import { loadItems } from "@/app/tools/yutai-memo/storage";
import type { MonthlyYutaiCandidate, MonthlyYutaiPageData } from "./types";

const PICKED_KEY = "monthly_yutai_picks_v1";

type StatusFilter = "all" | "picked" | "added" | "unselected";
type LinkFilter = "all" | "with" | "without";
type SortKey = "company" | "code" | "investment";

function normalizeText(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

function formatGeneratedAt(value: string | null) {
  if (!value) return "データ未接続";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "更新時刻不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(time));
}

function loadPickedCodes() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(PICKED_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function savePickedCodes(codes: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PICKED_KEY, JSON.stringify([...codes]));
}

function hasOfficialLink(item: MonthlyYutaiCandidate) {
  return item.has_official_link && Boolean(item.official_benefit_url);
}

function getOfficialLinkLabel(item: MonthlyYutaiCandidate) {
  if (item.official_link_status === "not_checked") return "企業リンク未確認";
  if (item.official_link_status === "missing") return "企業リンクなし";
  if (hasOfficialLink(item)) return "企業リンクあり";
  return "企業リンク未確認";
}

export default function ToolClient({ data }: { data: MonthlyYutaiPageData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [pickedCodes, setPickedCodes] = useState<Set<string>>(() => loadPickedCodes());
  const [addedKeys, setAddedKeys] = useState<Set<string>>(() => {
    const items = loadItems();
    return new Set(
      items.flatMap((item) => (item.months ?? []).map((month) => `${item.code ?? ""}:${month}`)),
    );
  });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    savePickedCodes(pickedCodes);
  }, [pickedCodes]);

  const availableTags = useMemo(() => {
    return Array.from(
      new Set(data.items.flatMap((item) => item.benefit_category_tags ?? []).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [data.items]);

  const availableMonths = useMemo(() => {
    if (!data.manifest?.months?.length) return [];
    return [...data.manifest.months]
      .map((entry) => ({
        id: `${entry.year}-${`${entry.month}`.padStart(2, "0")}`,
        label: `${entry.year}年${entry.month}月`,
        shortLabel: `${entry.month}月`,
        count: entry.count,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [data.manifest]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
    return data.items
      .filter((item) => {
        if (tagFilter !== "all" && !item.benefit_category_tags.includes(tagFilter)) return false;
        if (linkFilter === "with" && !hasOfficialLink(item)) return false;
        if (linkFilter === "without" && hasOfficialLink(item)) return false;

        const added = addedKeys.has(`${item.code}:${item.month}`);
        const picked = pickedCodes.has(item.code);
        if (statusFilter === "picked" && !picked) return false;
        if (statusFilter === "added" && !added) return false;
        if (statusFilter === "unselected" && (picked || added)) return false;

        if (!normalizedQuery) return true;
        return normalizeText(
          [
            item.company_name,
            item.code,
            item.benefit_summary,
            item.minimum_investment_text,
            item.benefit_category_tags.join(" "),
          ].join(" "),
        ).includes(normalizedQuery);
      })
      .slice()
      .sort((a, b) => {
        if (sortKey === "code") return collator.compare(a.code, b.code);
        if (sortKey === "investment") {
          return (a.minimum_investment_yen ?? Number.POSITIVE_INFINITY) - (b.minimum_investment_yen ?? Number.POSITIVE_INFINITY);
        }
        const byName = collator.compare(a.company_name, b.company_name);
        if (byName !== 0) return byName;
        return (a.minimum_investment_yen ?? Number.POSITIVE_INFINITY) - (b.minimum_investment_yen ?? Number.POSITIVE_INFINITY);
      });
  }, [addedKeys, data.items, linkFilter, pickedCodes, query, sortKey, statusFilter, tagFilter]);

  function togglePick(code: string) {
    setPickedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleAdd(item: MonthlyYutaiCandidate) {
    const existing = loadItems();
    if (isImportedMonthlyYutaiCandidate(existing, { code: item.code, month: item.month })) {
      setAddedKeys((prev) => new Set(prev).add(`${item.code}:${item.month}`));
      setNotice(`${item.company_name} はすでに優待メモにあります。`);
      return;
    }

    const result = addMemoItemFromCandidate({
      code: item.code,
      companyName: item.company_name,
      month: item.month,
      minimumInvestmentText: item.minimum_investment_text,
      benefitCategoryTags: item.benefit_category_tags,
      minkabuYutaiUrl: item.minkabu_yutai_url,
      officialBenefitUrl: item.official_benefit_url,
      officialLinkStatus: item.official_link_status,
      source: "minkabu",
      pickedFrom: "monthly_yutai_list",
    });

    if (!result.added) {
      setNotice("優待メモへの追加に失敗しました。");
      return;
    }

    setAddedKeys((prev) => new Set(prev).add(`${item.code}:${item.month}`));
    setNotice(`${item.company_name} を優待メモへ追加しました。`);
  }

  function handleMonthChange(nextMonthId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextMonthId) {
      params.delete("month");
    } else {
      params.set("month", nextMonthId);
    }
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/tools/yutai-candidates?${nextQuery}` : "/tools/yutai-candidates");
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.heroEyebrow}>優待候補一覧 beta</div>
          <h1 style={styles.heroTitle}>月別の優待候補を見ながら、優待メモへ追加</h1>
          <p style={styles.heroNote}>
            market_info の月別優待 JSON を候補一覧として表示し、気になる銘柄だけを優待メモへ送れます。
          </p>
          <div style={styles.heroMeta}>
            <span style={styles.metaChipMuted}>更新: {formatGeneratedAt(data.generatedAt)}</span>
          </div>
        </section>

        <section style={styles.panel}>
          {availableMonths.length > 0 ? (
            <div style={styles.monthBar}>
              <div style={styles.monthBarLabel}>表示月</div>
              <div style={styles.monthChipList}>
                {availableMonths.map((month) => {
                  const active = month.id === data.selectedMonthId;
                  return (
                    <button
                      key={month.id}
                      type="button"
                      onClick={() => handleMonthChange(month.id)}
                      style={active ? styles.monthChipActive : styles.monthChip}
                    >
                      <span>{month.shortLabel}</span>
                      <span style={active ? styles.monthChipCountActive : styles.monthChipCount}>{month.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div style={styles.filters}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="会社名・コード・カテゴリで検索"
              style={styles.search}
            />
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={styles.select}>
              <option value="all">カテゴリ: すべて</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  カテゴリ: {tag}
                </option>
              ))}
            </select>
            <select
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value as LinkFilter)}
              style={styles.select}
            >
              <option value="all">企業リンク: すべて</option>
              <option value="with">企業リンクあり</option>
              <option value="without">企業リンクなし</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={styles.select}
            >
              <option value="all">状態: すべて</option>
              <option value="picked">状態: ピック済み</option>
              <option value="added">状態: メモ追加済み</option>
              <option value="unselected">状態: 未選択</option>
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={styles.select}>
              <option value="company">並び順: 会社名</option>
              <option value="code">並び順: コード</option>
              <option value="investment">並び順: 最低投資金額</option>
            </select>
          </div>

          {!data.manifest ? (
            <article style={styles.emptyCard}>
              <div style={styles.emptyTitle}>月別優待データはまだ接続されていません</div>
              <div style={styles.emptyNote}>
                `app/tools/yutai-candidates/data/manifest.json` または
                `MONTHLY_YUTAI_DATA_BASE_URL` を用意すると、manifest の `months[].path` を正として一覧が表示されます。
              </div>
            </article>
          ) : filteredItems.length === 0 ? (
            <article style={styles.emptyCard}>
              <div style={styles.emptyTitle}>条件に合う銘柄がありません</div>
              <div style={styles.emptyNote}>検索条件やフィルタをゆるめると候補を再表示できます。</div>
            </article>
          ) : (
            <div style={styles.list}>
              {filteredItems.map((item) => {
                const added = addedKeys.has(`${item.code}:${item.month}`);
                const picked = pickedCodes.has(item.code);
                return (
                  <article key={`${item.code}:${item.month}`} style={styles.card}>
                    <div style={styles.cardTop}>
                      <div>
                        <div style={styles.companyName}>{item.company_name}</div>
                        <div style={styles.metaRow}>
                          <span>{item.code}</span>
                          <span>{item.month}月権利</span>
                          <span>{item.minimum_investment_text || "投資金額未設定"}</span>
                        </div>
                        <div style={styles.summaryText}>{item.benefit_summary || "優待概要なし"}</div>
                      </div>
                      <div style={styles.stateChips}>
                        {picked ? <span style={styles.pickedChip}>Pick</span> : null}
                        {added ? <span style={styles.addedChip}>Memo</span> : null}
                      </div>
                    </div>

                    <div style={styles.tagRow}>
                      {item.benefit_category_tags.length > 0 ? (
                        item.benefit_category_tags.map((tag) => (
                          <span key={tag} style={styles.tag}>
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span style={styles.mutedText}>カテゴリなし</span>
                      )}
                    </div>

                    <div style={styles.linkRow}>
                      <a href={item.minkabu_yutai_url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                        みんかぶ
                      </a>
                      {item.official_benefit_url ? (
                        <a
                          href={item.official_benefit_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.link}
                        >
                          企業リンク
                        </a>
                      ) : (
                        <span style={styles.linkStatusChip}>{getOfficialLinkLabel(item)}</span>
                      )}
                      {item.official_benefit_url ? (
                        <span style={styles.linkStatusChip}>{getOfficialLinkLabel(item)}</span>
                      ) : null}
                    </div>

                    <div style={styles.actions}>
                      <button type="button" onClick={() => togglePick(item.code)} style={styles.secondaryButton}>
                        {picked ? "ピック解除" : "ピック"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdd(item)}
                        style={added ? styles.disabledButton : styles.primaryButton}
                        disabled={added}
                      >
                        {added ? "追加済み" : "優待メモへ追加"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {notice ? (
          <div style={styles.notice}>
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} style={styles.noticeButton}>
              閉じる
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 12px 56px",
    background:
      "radial-gradient(1100px 420px at 15% 0%, rgba(37, 84, 255, 0.08), transparent 58%), #eef2f7",
  },
  shell: {
    width: "100%",
    maxWidth: 920,
    margin: "0 auto",
  },
  hero: {
    marginBottom: 20,
  },
  heroEyebrow: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3151da",
    fontSize: 11,
    fontWeight: 800,
  },
  heroTitle: {
    margin: "10px 0 8px",
    fontSize: "clamp(26px, 5vw, 38px)",
    lineHeight: 1.12,
    letterSpacing: -0.8,
  },
  heroNote: {
    margin: 0,
    maxWidth: 680,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#667085",
  },
  heroMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  metaChipMuted: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f4f6fb",
    color: "#667085",
    fontSize: 11,
    fontWeight: 700,
  },
  panel: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)",
    border: "1px solid rgba(15, 23, 42, 0.06)",
  },
  monthBar: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
  },
  monthBarLabel: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: 800,
    color: "#667085",
    letterSpacing: 0.2,
  },
  monthChipList: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 6,
  },
  monthChip: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "#f7f9fc",
    color: "#374151",
    padding: "6px 7px",
    borderRadius: 12,
    minWidth: 0,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  monthChipActive: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    border: "1px solid rgba(37, 84, 255, 0.12)",
    background: "#eef2ff",
    color: "#2554ff",
    padding: "6px 7px",
    borderRadius: 12,
    minWidth: 0,
    fontSize: 12,
    fontWeight: 800,
    cursor: "default",
  },
  monthChipCount: {
    fontSize: 10,
    fontWeight: 700,
    color: "#64748b",
    lineHeight: 1.1,
  },
  monthChipCountActive: {
    fontSize: 10,
    fontWeight: 800,
    color: "#2554ff",
    lineHeight: 1.1,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginBottom: 18,
  },
  search: {
    gridColumn: "1 / -1",
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "#f7f9fc",
    padding: "12px 14px",
    fontSize: 14,
  },
  select: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "#f7f9fc",
    padding: "11px 12px",
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: 18,
    padding: 20,
    background: "#f7f9fc",
    border: "1px solid rgba(15, 23, 42, 0.05)",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
  },
  emptyNote: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.7,
    color: "#667085",
    whiteSpace: "pre-wrap",
  },
  list: {
    display: "grid",
    gap: 14,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    background: "#fdfefe",
    border: "1px solid rgba(15, 23, 42, 0.08)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  companyName: {
    fontSize: 17,
    fontWeight: 800,
    lineHeight: 1.3,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
    fontSize: 12,
    color: "#667085",
  },
  summaryText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#374151",
  },
  stateChips: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  pickedChip: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#fff3d6",
    color: "#9a5b00",
    fontSize: 11,
    fontWeight: 800,
  },
  addedChip: {
    display: "inline-flex",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#e6f9ee",
    color: "#15803d",
    fontSize: 11,
    fontWeight: 800,
  },
  tagRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  tag: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "#eef2ff",
    color: "#3146d4",
    fontSize: 12,
    fontWeight: 700,
  },
  linkRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 12,
  },
  link: {
    color: "#2554ff",
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
  },
  mutedText: {
    color: "#667085",
    fontSize: 12,
  },
  linkStatusChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f4f6fb",
    color: "#667085",
    fontSize: 11,
    fontWeight: 700,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  secondaryButton: {
    border: "1px solid rgba(15, 23, 42, 0.1)",
    background: "#ffffff",
    color: "#374151",
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryButton: {
    border: "none",
    background: "#2554ff",
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  disabledButton: {
    border: "none",
    background: "#dbe5ff",
    color: "#4b61cb",
    padding: "10px 14px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    cursor: "default",
  },
  notice: {
    position: "sticky",
    bottom: 16,
    marginTop: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: 14,
    background: "#1f2937",
    color: "#ffffff",
    fontSize: 13,
  },
  noticeButton: {
    border: "1px solid rgba(255, 255, 255, 0.18)",
    background: "transparent",
    color: "#ffffff",
    padding: "6px 10px",
    borderRadius: 10,
    cursor: "pointer",
  },
};
