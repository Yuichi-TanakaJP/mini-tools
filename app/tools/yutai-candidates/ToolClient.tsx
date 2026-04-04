"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addMemoItemFromCandidate, isImportedMonthlyYutaiCandidate } from "@/app/tools/yutai-memo/candidate-import";
import { loadItems } from "@/app/tools/yutai-memo/storage";
import type { MonthlyYutaiCandidate, MonthlyYutaiPageData } from "./types";

const PICKED_KEY = "monthly_yutai_picks_v1";

type StatusFilter = "all" | "picked" | "added" | "unselected";
type LinkFilter = "all" | "with" | "without";
type CrossFilter = "all" | "general" | "institutional" | "any";
type SortKey = "company" | "code" | "investment" | "available_shares";

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


function renderCreditBadges(
  nikkoCredit: import("./types").NikkoCreditData | null,
  code: string,
  styles: Record<string, React.CSSProperties>,
): React.ReactNode {
  if (!nikkoCredit) return null;
  const credit = nikkoCredit.by_code[code];
  if (!credit) return <div style={styles.creditRow}><span style={styles.creditChipNone}>日興対象外</span></div>;
  const badges: React.ReactNode[] = [];
  if (credit.general_short) {
    badges.push(<span key="gen" style={styles.creditChipGeneral}>一般売可</span>);
  }
  if (credit.institutional_short) {
    badges.push(<span key="inst" style={styles.creditChipInstitutional}>制度売可</span>);
  }
  if (badges.length === 0) {
    badges.push(<span key="none" style={styles.creditChipNoCross}>クロス不可</span>);
  }
  return <div style={styles.creditRow}>{badges}</div>;
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
  const [crossFilter, setCrossFilter] = useState<CrossFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [pickedCodes, setPickedCodes] = useState<Set<string>>(new Set());
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // localStorage はサーバーで読めないため、マウント後に初期化する（hydration mismatch 回避）
    /* eslint-disable react-hooks/set-state-in-effect */
    setPickedCodes(loadPickedCodes());
    const items = loadItems();
    setAddedKeys(new Set(
      items.flatMap((item) => (item.months ?? []).map((month) => `${item.code ?? ""}:${month}`)),
    ));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

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
    const byCode = data.nikkoCredit?.by_code;
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

        if (crossFilter !== "all" && byCode) {
          const credit = byCode[item.code];
          if (crossFilter === "general" && !credit?.general_short) return false;
          if (crossFilter === "institutional" && !credit?.institutional_short) return false;
          if (crossFilter === "any" && !credit?.general_short && !credit?.institutional_short) return false;
        }

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
        if (sortKey === "available_shares" && byCode) {
          const aShares = byCode[a.code]?.available_shares ?? -1;
          const bShares = byCode[b.code]?.available_shares ?? -1;
          return bShares - aShares;
        }
        const byName = collator.compare(a.company_name, b.company_name);
        if (byName !== 0) return byName;
        return (a.minimum_investment_yen ?? Number.POSITIVE_INFINITY) - (b.minimum_investment_yen ?? Number.POSITIVE_INFINITY);
      });
  }, [addedKeys, crossFilter, data.items, data.nikkoCredit, linkFilter, pickedCodes, query, sortKey, statusFilter, tagFilter]);

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
          <div style={styles.heroEyebrow}>
            <span style={styles.heroEyebrowDot} />
            優待カレンダー beta
          </div>
          <h1 style={styles.heroTitle}>権利確定月で優待銘柄を探す</h1>
          <p style={styles.heroNote}>
            月別優待データを一覧表示して、気になる銘柄だけをピックし優待メモへ追加できます。
          </p>
          <div style={styles.heroMeta}>
            <span style={styles.metaChip}>
              <span style={styles.metaOnlineDot} />
              {formatGeneratedAt(data.generatedAt)}
            </span>
            {data.nikkoCredit && (
              <span style={styles.metaChip}>
                日興信用 {data.nikkoCredit.date} 時点
              </span>
            )}
          </div>
        </section>

        <section style={styles.panel}>
          {availableMonths.length > 0 && (
            <div style={styles.monthSection}>
              <div style={styles.sectionLabel}>表示月</div>
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
          )}

          <div style={styles.filterSection}>
            <div style={styles.searchWrapper}>
              <svg style={styles.searchIcon} viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="#94a3b8" strokeWidth="1.5" />
                <path d="M13.5 13.5L17 17" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="会社名・コード・カテゴリで検索"
                style={styles.search}
              />
            </div>
            <div style={styles.filterSelectRow}>
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={styles.select}>
                <option value="all">カテゴリ: すべて</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>カテゴリ: {tag}</option>
                ))}
              </select>
              <select value={linkFilter} onChange={(e) => setLinkFilter(e.target.value as LinkFilter)} style={styles.select}>
                <option value="all">企業リンク: すべて</option>
                <option value="with">企業リンクあり</option>
                <option value="without">企業リンクなし</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} style={styles.select}>
                <option value="all">状態: すべて</option>
                <option value="picked">状態: ピック済み</option>
                <option value="added">状態: メモ追加済み</option>
                <option value="unselected">状態: 未選択</option>
              </select>
              {data.nikkoCredit && (
                <select value={crossFilter} onChange={(e) => setCrossFilter(e.target.value as CrossFilter)} style={styles.select}>
                  <option value="all">クロス: すべて</option>
                  <option value="any">クロス: 一般または制度</option>
                  <option value="general">クロス: 一般信用のみ</option>
                  <option value="institutional">クロス: 制度信用のみ</option>
                </select>
              )}
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={styles.select}>
                <option value="company">並び順: 会社名</option>
                <option value="code">並び順: コード</option>
                <option value="investment">並び順: 最低投資金額</option>
                {data.nikkoCredit && (
                  <option value="available_shares">並び順: 一般売建可能数量</option>
                )}
              </select>
            </div>
          </div>

          {!data.manifest ? (
            <article style={styles.emptyCard}>
              <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none" width={28} height={28}>
                <circle cx="12" cy="12" r="9" stroke="#94a3b8" strokeWidth="1.5" />
                <path d="M12 8v4M12 16h.01" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div style={styles.emptyTitle}>月別優待データはまだ接続されていません</div>
              <div style={styles.emptyNote}>
                {"`app/tools/yutai-candidates/data/manifest.json`"} または{" "}
                {"`MONTHLY_YUTAI_DATA_BASE_URL`"} を用意すると、manifest の{" "}
                {"`months[].path`"} を正として一覧が表示されます。
              </div>
            </article>
          ) : filteredItems.length === 0 ? (
            <article style={styles.emptyCard}>
              <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="none" width={28} height={28}>
                <path d="M3 6h18M3 12h18M3 18h18" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div style={styles.emptyTitle}>条件に合う銘柄がありません</div>
              <div style={styles.emptyNote}>検索条件やフィルタをゆるめると候補を再表示できます。</div>
            </article>
          ) : (
            <>
              <div style={styles.resultsMeta}>
                <span style={styles.resultsCount}>{filteredItems.length.toLocaleString("ja-JP")}</span>
                <span style={styles.resultsLabel}>件の候補</span>
              </div>
              <div style={styles.list}>
                {filteredItems.map((item) => {
                  const added = addedKeys.has(`${item.code}:${item.month}`);
                  const picked = pickedCodes.has(item.code);
                  const cardStyle = added ? styles.cardAdded : picked ? styles.cardPicked : styles.card;
                  return (
                    <article key={`${item.code}:${item.month}`} style={cardStyle}>
                      <div style={styles.cardTop}>
                        <div style={styles.cardMain}>
                          <div style={styles.cardNameRow}>
                            <span style={styles.companyName}>{item.company_name}</span>
                            <span style={styles.codeChip}>{item.code}</span>
                          </div>
                          <div style={styles.metaRow}>
                            <span style={styles.metaItem}>{item.month}月権利</span>
                            {item.minimum_investment_text && (
                              <>
                                <span style={styles.metaDivider}>·</span>
                                <span style={styles.investChip}>{item.minimum_investment_text}</span>
                              </>
                            )}
                          </div>
                          {renderCreditBadges(data.nikkoCredit, item.code, styles)}
                        </div>
                        <div style={styles.stateChips}>
                          {picked && <span style={styles.pickedChip}>★ Pick</span>}
                          {added && <span style={styles.addedChip}>✓ Memo</span>}
                        </div>
                      </div>

                      {item.benefit_summary && (
                        <p style={styles.summaryText}>{item.benefit_summary}</p>
                      )}

                      <div style={styles.cardFooter}>
                        <a href={item.minkabu_yutai_url} target="_blank" rel="noopener noreferrer" style={styles.linkButton}>
                          みんかぶ ↗
                        </a>
                        {item.official_benefit_url ? (
                          <a href={item.official_benefit_url} target="_blank" rel="noopener noreferrer" style={styles.linkButton}>
                            企業サイト ↗
                          </a>
                        ) : (
                          <span style={styles.linkStatusChip}>{getOfficialLinkLabel(item)}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => togglePick(item.code)}
                          style={picked ? styles.secondaryButtonActive : styles.secondaryButton}
                        >
                          {picked ? "★ ピック解除" : "ピック"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdd(item)}
                          style={added ? styles.disabledButton : styles.primaryButton}
                          disabled={added}
                        >
                          {added ? "✓ 追加済み" : "優待メモ追加"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {notice && (
          <div style={styles.notice}>
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} style={styles.noticeButton}>
              閉じる
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

const INDIGO = "#4f46e5";
const INDIGO_LIGHT = "#eef2ff";
const INDIGO_MID = "#6366f1";

const baseDot: React.CSSProperties = {
  display: "inline-block",
  width: 6,
  height: 6,
  borderRadius: "50%",
  flexShrink: 0,
};

const baseMonthChip: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  minHeight: 42,
  padding: "4px 8px",
  borderRadius: 10,
  fontSize: 13,
  lineHeight: 1,
};

const baseCard: React.CSSProperties = {
  borderRadius: 20,
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const baseSecondaryButton: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  minWidth: 0,
  whiteSpace: "nowrap",
  textAlign: "center",
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 72px",
    background:
      "radial-gradient(ellipse 1200px 500px at 0% -10%, rgba(99,102,241,0.10) 0%, transparent 60%), " +
      "radial-gradient(ellipse 800px 600px at 100% 80%, rgba(79,70,229,0.06) 0%, transparent 55%), " +
      "#f1f5f9",
  },
  shell: {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
  },
  hero: {
    marginBottom: 28,
  },
  heroEyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px 5px 8px",
    borderRadius: 999,
    background: INDIGO_LIGHT,
    color: INDIGO,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.3,
    border: "1px solid rgba(79,70,229,0.15)",
  },
  heroEyebrowDot: { ...baseDot, background: INDIGO_MID },
  heroTitle: {
    margin: "12px 0 8px",
    fontSize: "clamp(28px, 5vw, 42px)",
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: -1,
    color: "#0f172a",
  },
  heroNote: {
    margin: 0,
    maxWidth: 600,
    fontSize: 14,
    lineHeight: 1.75,
    color: "#64748b",
  },
  heroMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
    alignItems: "center",
  },
  metaChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.08)",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  metaOnlineDot: { ...baseDot, background: "#22c55e" },
  panel: {
    background: "#ffffff",
    borderRadius: 28,
    padding: "20px 20px 24px",
    boxShadow:
      "0 1px 3px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06), 0 24px 48px rgba(15,23,42,0.04)",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  monthSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  monthChipList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
    gap: 4,
  },
  monthChip: {
    ...baseMonthChip,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: 700,
    cursor: "pointer",
  },
  monthChipActive: {
    ...baseMonthChip,
    border: `1.5px solid ${INDIGO}`,
    background: INDIGO_LIGHT,
    color: INDIGO,
    fontWeight: 800,
    cursor: "default",
    boxShadow: "0 0 0 2px rgba(79,70,229,0.08)",
  },
  monthChipCount: {
    fontSize: 10,
    fontWeight: 700,
    color: "#94a3b8",
    lineHeight: 1,
  },
  monthChipCountActive: {
    fontSize: 10,
    fontWeight: 800,
    color: INDIGO,
    lineHeight: 1,
  },
  filterSection: {
    background: "#f8fafc",
    borderRadius: 18,
    padding: "14px 14px 12px",
    marginBottom: 20,
    border: "1px solid rgba(15,23,42,0.05)",
  },
  searchWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    marginBottom: 10,
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    width: 16,
    height: 16,
    pointerEvents: "none",
    flexShrink: 0,
  },
  search: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#ffffff",
    padding: "11px 12px 11px 36px",
    fontSize: 14,
    color: "#0f172a",
    boxSizing: "border-box",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  filterSelectRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
  },
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#ffffff",
    padding: "9px 10px",
    fontSize: 13,
    color: "#374151",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  resultsMeta: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 14,
    paddingLeft: 2,
  },
  resultsCount: {
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1,
  },
  resultsLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
  },
  emptyCard: {
    borderRadius: 18,
    padding: "32px 24px",
    background: "#f8fafc",
    border: "1px solid rgba(15,23,42,0.05)",
    textAlign: "center",
  },
  emptyIcon: {
    display: "block",
    margin: "0 auto 12px",
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
  },
  emptyNote: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.7,
    color: "#64748b",
    whiteSpace: "pre-wrap",
  },
  list: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
    gap: 14,
  },
  card: {
    ...baseCard,
    background: "#fdfdfe",
    border: "1px solid rgba(15,23,42,0.08)",
    borderLeft: "3px solid rgba(15,23,42,0.10)",
  },
  cardPicked: {
    ...baseCard,
    background: "#fffbeb",
    border: "1px solid rgba(245,158,11,0.20)",
    borderLeft: "3px solid #f59e0b",
  },
  cardAdded: {
    ...baseCard,
    background: "#f0fdf4",
    border: "1px solid rgba(34,197,94,0.20)",
    borderLeft: "3px solid #22c55e",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "nowrap",
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  cardNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "nowrap",
    minWidth: 0,
  },
  companyName: {
    flex: "1 1 auto",
    minWidth: 0,
    fontSize: 17,
    fontWeight: 800,
    lineHeight: 1.3,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  codeChip: {
    display: "inline-flex",
    padding: "2px 7px",
    borderRadius: 6,
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    alignItems: "center",
  },
  metaItem: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },
  metaDivider: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  investChip: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 6,
    background: INDIGO_LIGHT,
    color: INDIGO,
    fontSize: 11,
    fontWeight: 800,
  },
  summaryText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.65,
    color: "#374151",
  },
  stateChips: {
    display: "flex",
    gap: 6,
    flexWrap: "nowrap",
    justifyContent: "flex-end",
    flexShrink: 0,
    maxWidth: "100%",
  },
  pickedChip: {
    display: "inline-flex",
    padding: "4px 9px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid rgba(245,158,11,0.20)",
  },
  addedChip: {
    display: "inline-flex",
    padding: "4px 9px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#15803d",
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid rgba(34,197,94,0.20)",
  },
  creditRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 6,
  },
  creditChipGeneral: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 6,
    background: "#dcfce7",
    color: "#15803d",
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid rgba(34,197,94,0.25)",
  },
  creditChipInstitutional: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 6,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 800,
    border: "1px solid rgba(59,130,246,0.25)",
  },
  creditChipNoCross: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 6,
    background: "#f1f5f9",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  creditChipNone: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 6,
    background: "#f8fafc",
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid rgba(15,23,42,0.04)",
  },
  tagRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  tag: {
    display: "inline-flex",
    padding: "4px 9px",
    borderRadius: 999,
    background: "#f0f0ff",
    color: "#4338ca",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid rgba(79,70,229,0.12)",
  },
  mutedText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  cardFooter: {
    display: "grid",
    gridTemplateColumns: "minmax(0,0.8fr) minmax(0,1fr) minmax(0,1.15fr) minmax(0,1.35fr)",
    alignItems: "center",
    gap: 8,
    paddingTop: 6,
    borderTop: "1px solid rgba(15,23,42,0.06)",
    marginTop: 0,
  },
  linkButton: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 8,
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 11,
    fontWeight: 700,
    textDecoration: "none",
    border: "1px solid rgba(15,23,42,0.08)",
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  linkStatusChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 700,
    border: "1px solid rgba(15,23,42,0.06)",
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    ...baseSecondaryButton,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#ffffff",
    color: "#374151",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    width: "100%",
  },
  secondaryButtonActive: {
    ...baseSecondaryButton,
    border: "1px solid rgba(245,158,11,0.25)",
    background: "#fffbeb",
    color: "#92400e",
    width: "100%",
  },
  primaryButton: {
    border: "none",
    background: `linear-gradient(135deg, ${INDIGO} 0%, ${INDIGO_MID} 100%)`,
    color: "#ffffff",
    padding: "6px 16px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(79,70,229,0.30)",
    minWidth: 0,
    width: "100%",
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  disabledButton: {
    border: "none",
    background: "#e0e7ff",
    color: "#6366f1",
    padding: "6px 16px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    cursor: "default",
    opacity: 0.7,
    minWidth: 0,
    width: "100%",
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  notice: {
    position: "sticky",
    bottom: 20,
    marginTop: 20,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "14px 18px",
    borderRadius: 16,
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 600,
    boxShadow: "0 8px 24px rgba(15,23,42,0.24)",
  },
  noticeButton: {
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    padding: "6px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
};
