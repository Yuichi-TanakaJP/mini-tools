"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addMemoItemFromCandidate, isImportedMonthlyYutaiCandidate } from "@/app/tools/yutai-memo/candidate-import";
import { loadArchivedItems, loadItems } from "@/app/tools/yutai-memo/storage";
import { CROSS_TYPES, type ArchivedMemoItem, type CrossType, type MemoItem } from "@/app/tools/yutai-memo/types";
import { isPreparationMonth } from "@/app/tools/yutai-memo/date-utils";
import { useRouterTransition } from "@/app/tools/_shared/use-router-transition";
import {
  canNikkoGeneralCrossNow,
  getNikkoCreditBadges,
  isHandledBySbiShort,
  shouldWatchNikkoGeneral,
  type NikkoCreditBadgeKind,
} from "@/app/tools/_shared/yutai-credit";
import {
  MONTHLY_YUTAI_PICKED_KEY as PICKED_KEY,
  MONTHLY_YUTAI_PASSED_KEY as PASSED_KEY,
  getAddedKeysFromMemoItems,
  getCardMemoKey,
  loadCardMemos,
  loadCodeSet,
  saveCodeSet,
  type CalendarCardMemo,
} from "@/app/tools/_shared/yutai-selection";
import type { MonthlyYutaiCandidate, MonthlyYutaiPageData, NikkoCreditRecord } from "@/app/tools/yutai-candidates/types";

type StatusFilter = "all" | "added" | "picked" | "passed" | "unselected";
type CrossFilter = "all" | "general" | "general_watch" | "institutional" | "any";
type SbiFilter = "all" | "sbi_any";
type StrategyFilter = "all" | CrossType;
type SortKey = "code" | "company" | "investment" | "available_shares";
type CalendarAxis = "entitlement" | "preparation";

type DashboardRow = {
  key: string;
  code: string;
  name: string;
  months: number[];
  candidate: MonthlyYutaiCandidate | null;
  memo: MemoItem | null;
  added: boolean;
  picked: boolean;
  passed: boolean;
};

type AcquiredSummary = {
  count: number;
  latestKey: string | null;
  entries: ArchivedMemoItem[];
};

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

function formatMonths(months: number[]) {
  return [...months].sort((a, b) => a - b).map((month) => `${month}月`).join("・");
}

function buildAcquiredByCode(archives: ArchivedMemoItem[], memoItems: MemoItem[]) {
  const codeByMemoId = new Map(memoItems.filter((item) => item.code).map((item) => [item.id, item.code as string]));
  const map = new Map<string, AcquiredSummary>();
  for (const archive of archives) {
    const code = archive.code ?? codeByMemoId.get(archive.memoId);
    if (!code) continue;
    const summary = map.get(code) ?? { count: 0, latestKey: null, entries: [] };
    summary.count += 1;
    summary.entries.push(archive);
    const key = archive.entitlementMonthKey ?? null;
    if (key && (!summary.latestKey || key > summary.latestKey)) summary.latestKey = key;
    map.set(code, summary);
  }
  return map;
}

const creditChipStyleByKind: Record<NikkoCreditBadgeKind, string> = {
  generalStop: "chipGeneralStop",
  generalCaution: "chipGeneralCaution",
  generalOk: "chipGeneralOk",
  generalOutOfStock: "chipGeneralOutOfStock",
  institutional: "chipInstitutional",
};

export default function ToolClient({ data }: { data: MonthlyYutaiPageData }) {
  const { navigate, isPendingFor } = useRouterTransition();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [axis, setAxis] = useState<CalendarAxis>("entitlement");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [crossFilter, setCrossFilter] = useState<CrossFilter>("all");
  const [sbiFilter, setSbiFilter] = useState<SbiFilter>("all");
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [pickedCodes, setPickedCodes] = useState<Set<string>>(new Set());
  const [passedCodes, setPassedCodes] = useState<Set<string>>(new Set());
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [memoItems, setMemoItems] = useState<MemoItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<ArchivedMemoItem[]>([]);
  const [cardMemos, setCardMemos] = useState<Record<string, CalendarCardMemo>>({});
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const didPersistPicked = useRef(false);
  const didPersistPassed = useRef(false);

  const selectedMonth = Number(data.selectedMonthId.slice(5, 7));

  useEffect(() => {
    // localStorage はサーバーで読めないため、マウント後に初期化する（hydration mismatch 回避）
    /* eslint-disable react-hooks/set-state-in-effect */
    setPickedCodes(loadCodeSet(PICKED_KEY));
    setPassedCodes(loadCodeSet(PASSED_KEY));
    setCardMemos(loadCardMemos());
    const items = loadItems();
    setAddedKeys(getAddedKeysFromMemoItems(items));
    setMemoItems(items);
    setArchivedItems(loadArchivedItems());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    // hydrated 前は空 Set を保存しない
    if (!hydrated) return;
    saveCodeSet(PICKED_KEY, pickedCodes, { markChanged: didPersistPicked.current });
    didPersistPicked.current = true;
  }, [hydrated, pickedCodes]);

  useEffect(() => {
    if (!hydrated) return;
    saveCodeSet(PASSED_KEY, passedCodes, { markChanged: didPersistPassed.current });
    didPersistPassed.current = true;
  }, [hydrated, passedCodes]);

  const availableMonths = useMemo(() => {
    if (!data.manifest?.months?.length) return [];
    return [...data.manifest.months]
      .map((entry) => ({
        id: `${entry.year}-${`${entry.month}`.padStart(2, "0")}`,
        label: `${entry.year}年${entry.month}月`,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [data.manifest]);

  const memoListByCode = useMemo(() => {
    const map = new Map<string, MemoItem[]>();
    for (const item of memoItems) {
      if (!item.code) continue;
      const list = map.get(item.code) ?? [];
      list.push(item);
      map.set(item.code, list);
    }
    return map;
  }, [memoItems]);

  const acquiredByCode = useMemo(
    () => buildAcquiredByCode(archivedItems, memoItems),
    [archivedItems, memoItems],
  );

  const rows = useMemo<DashboardRow[]>(() => {
    if (axis === "preparation") {
      // 仕込み月軸はメモ登録済み＋仕込み時期設定済みに限定する（2026-07-03 決定）
      const candidateByCode = new Map(data.items.map((item) => [item.code, item]));
      return memoItems
        .filter((item) => isPreparationMonth(item.months, item.preparationMonthsBefore, selectedMonth))
        .map((item) => {
          const code = item.code ?? "";
          return {
            key: `memo:${item.id}`,
            code,
            name: item.name,
            months: item.months ?? [],
            candidate: code ? candidateByCode.get(code) ?? null : null,
            memo: item,
            added: true,
            picked: code ? pickedCodes.has(code) : false,
            passed: code ? passedCodes.has(code) : false,
          };
        });
    }

    return data.items.map((item) => {
      const memoList = memoListByCode.get(item.code) ?? [];
      const memoForMonth = memoList.find((memo) => Array.isArray(memo.months) && memo.months.includes(item.month));
      // 同一銘柄が別権利月でメモ登録済みでも戦略・1株開始は銘柄単位の情報として表示する
      const memo = memoForMonth ?? memoList[0] ?? null;
      return {
        key: `${item.code}:${item.month}`,
        code: item.code,
        name: item.company_name,
        months: memo?.months?.length ? memo.months : [item.month],
        candidate: item,
        memo,
        added: addedKeys.has(`${item.code}:${item.month}`),
        picked: pickedCodes.has(item.code),
        passed: passedCodes.has(item.code),
      };
    });
  }, [addedKeys, axis, data.items, memoItems, memoListByCode, passedCodes, pickedCodes, selectedMonth]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
    const byCode = data.nikkoCredit?.by_code;
    return rows
      .filter((row) => {
        if (statusFilter === "added" && !row.added) return false;
        if (statusFilter === "picked" && !row.picked) return false;
        if (statusFilter === "passed" && !row.passed) return false;
        if (statusFilter === "unselected" && (row.added || row.picked || row.passed)) return false;

        // データ未取得時に絞り込みが素通しにならないよう、byCode なしでも判定して除外に倒す
        if (crossFilter !== "all") {
          const credit = byCode?.[row.code];
          if (crossFilter === "general" && !canNikkoGeneralCrossNow(credit)) return false;
          if (crossFilter === "general_watch" && !shouldWatchNikkoGeneral(credit)) return false;
          if (crossFilter === "institutional" && !credit?.institutional_short) return false;
          if (crossFilter === "any" && !canNikkoGeneralCrossNow(credit) && !credit?.institutional_short) return false;
        }

        if (sbiFilter === "sbi_any") {
          if (!isHandledBySbiShort(data.sbiCredit?.by_code[row.code])) return false;
        }

        if (strategyFilter !== "all" && row.memo?.crossType !== strategyFilter) return false;

        if (!normalizedQuery) return true;
        return normalizeText(
          [
            row.name,
            row.code,
            row.candidate?.benefit_summary ?? "",
            row.candidate?.benefit_category_tags?.join(" ") ?? "",
            row.memo?.memo ?? "",
            row.memo?.entryTiming ?? "",
          ].join(" "),
        ).includes(normalizedQuery);
      })
      .slice()
      .sort((a, b) => {
        if (sortKey === "code") return collator.compare(a.code, b.code);
        if (sortKey === "investment") {
          return (a.candidate?.minimum_investment_yen ?? Number.POSITIVE_INFINITY)
            - (b.candidate?.minimum_investment_yen ?? Number.POSITIVE_INFINITY);
        }
        if (sortKey === "available_shares" && byCode) {
          const aShares = byCode[a.code]?.available_shares ?? -1;
          const bShares = byCode[b.code]?.available_shares ?? -1;
          return bShares - aShares;
        }
        return collator.compare(a.name, b.name);
      });
  }, [crossFilter, data.nikkoCredit, data.sbiCredit, query, rows, sbiFilter, sortKey, statusFilter, strategyFilter]);

  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.key === selectedRowKey) ?? null,
    [filteredRows, selectedRowKey],
  );

  function togglePick(code: string) {
    setPickedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    // ピックとパスは排他
    setPassedCodes((prev) => {
      if (!prev.has(code)) return prev;
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
  }

  function togglePass(code: string) {
    setPassedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setPickedCodes((prev) => {
      if (!prev.has(code)) return prev;
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
  }

  function handleAdd(item: MonthlyYutaiCandidate) {
    const existing = loadItems();
    if (isImportedMonthlyYutaiCandidate(existing, { code: item.code, month: item.month })) {
      setAddedKeys((prev) => new Set(prev).add(`${item.code}:${item.month}`));
      setMemoItems(existing);
      setNotice(`${item.company_name} はすでに優待メモにあります。`);
      return;
    }

    const result = addMemoItemFromCandidate({
      code: item.code,
      companyName: item.company_name,
      month: item.month,
      preparationMonthsBefore: cardMemos[getCardMemoKey(item)]?.preparationMonthsBefore,
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

    const next = loadItems();
    setAddedKeys((prev) => new Set(prev).add(`${item.code}:${item.month}`));
    setMemoItems(next);
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
    setSelectedRowKey(null);
    navigate(
      nextQuery ? `/tools/yutai-dashboard?${nextQuery}` : "/tools/yutai-dashboard",
      { key: `month:${nextMonthId}`, method: "replace" },
    );
  }

  function renderNikkoCell(code: string) {
    if (!data.nikkoCredit) return <span style={styles.cellMuted}>-</span>;
    const badges = getNikkoCreditBadges(data.nikkoCredit.by_code[code]);
    if (badges.length === 0) return <span style={styles.cellMuted}>-</span>;
    return (
      <span style={styles.chipRow}>
        {badges.map((badge) => (
          <span key={badge.kind} style={styles[creditChipStyleByKind[badge.kind]]} title={badge.title}>
            {badge.label}
          </span>
        ))}
      </span>
    );
  }

  function renderSbiCell(code: string) {
    if (!data.sbiCredit) return <span style={styles.cellMuted}>-</span>;
    if (!isHandledBySbiShort(data.sbiCredit.by_code[code])) return <span style={styles.cellMuted}>-</span>;
    return <span style={styles.chipSbi}>SBI売可</span>;
  }

  function renderRowActions(row: DashboardRow) {
    return (
      <span style={styles.actionRow}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            togglePick(row.code);
          }}
          aria-pressed={row.picked}
          style={row.picked ? styles.actionPickActive : styles.actionButton}
        >
          {row.picked ? "★" : "☆"}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            togglePass(row.code);
          }}
          aria-pressed={row.passed}
          aria-label={row.passed ? "パスを解除" : "パスする"}
          title={row.passed ? "パスを解除" : "パスする"}
          style={row.passed ? styles.actionPassActive : styles.actionButton}
        >
          ✕
        </button>
        {row.added ? (
          <span style={styles.addedChip}>追加済</span>
        ) : row.candidate ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleAdd(row.candidate as MonthlyYutaiCandidate);
            }}
            style={styles.actionAdd}
          >
            ＋メモ
          </button>
        ) : null}
      </span>
    );
  }

  const nikkoCreditForSelected: NikkoCreditRecord | undefined = selectedRow
    ? data.nikkoCredit?.by_code[selectedRow.code]
    : undefined;
  const acquiredForSelected = selectedRow ? acquiredByCode.get(selectedRow.code) : undefined;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.heroEyebrow}>
            <span style={styles.heroEyebrowDot} />
            優待ダッシュボード beta
          </div>
          <h1 style={styles.heroTitle}>優待クロスを一覧で管理する</h1>
          <p style={styles.heroNote}>
            月次候補のピック・パス・優待メモ追加と、仕込み時期・クロス戦略・取得実績の確認を 1 つのテーブルで行えます。
            ピック / パス / メモは優待カレンダー・優待メモ帳と共有されます。
          </p>
          <div style={styles.heroMeta}>
            <span style={styles.metaChip}>
              <span style={styles.metaOnlineDot} />
              {formatGeneratedAt(data.generatedAt)}
            </span>
            {data.selectedMonthKenriLastDate ? (
              <span style={styles.metaChip}>権利付き最終日: {data.selectedMonthKenriLastDate.slice(5).replace("-", "/")}</span>
            ) : null}
          </div>
        </section>

        {notice ? (
          <div style={styles.noticeBar} role="status">
            {notice}
            <button type="button" onClick={() => setNotice(null)} style={styles.noticeClose} aria-label="通知を閉じる">✕</button>
          </div>
        ) : null}

        <section style={styles.panel}>
          <div style={styles.filterBar}>
            <label style={styles.filterItem}>
              <span style={styles.filterLabel}>対象月</span>
              <select
                value={data.selectedMonthId}
                onChange={(event) => handleMonthChange(event.target.value)}
                style={styles.select}
                disabled={isPendingFor(`month:${data.selectedMonthId}`)}
              >
                {availableMonths.map((month) => (
                  <option key={month.id} value={month.id}>{month.label}</option>
                ))}
              </select>
            </label>
            <label style={styles.filterItem}>
              <span style={styles.filterLabel}>表示軸</span>
              <select value={axis} onChange={(event) => setAxis(event.target.value as CalendarAxis)} style={styles.select}>
                <option value="entitlement">権利月で探す</option>
                <option value="preparation">仕込み月で探す</option>
              </select>
            </label>
            <label style={styles.filterItem}>
              <span style={styles.filterLabel}>状態</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} style={styles.select}>
                <option value="all">全部</option>
                <option value="added">メモ登録済み</option>
                <option value="picked">ピック済み</option>
                <option value="passed">パス済み</option>
                <option value="unselected">未選択</option>
              </select>
            </label>
            <label style={styles.filterItem}>
              <span style={styles.filterLabel}>日興クロス{data.nikkoCredit ? "" : "（データなし）"}</span>
              <select
                value={crossFilter}
                onChange={(event) => setCrossFilter(event.target.value as CrossFilter)}
                style={styles.select}
                disabled={!data.nikkoCredit}
                title={data.nikkoCredit ? undefined : "日興信用データが未取得のため利用できません"}
              >
                <option value="all">指定なし</option>
                <option value="general">一般: 今クロス可</option>
                <option value="general_watch">一般: 監視対象</option>
                <option value="institutional">制度: 売建可</option>
                <option value="any">一般か制度が可</option>
              </select>
            </label>
            <label style={styles.filterItem}>
              <span style={styles.filterLabel}>SBI{data.sbiCredit ? "" : "（データなし）"}</span>
              <select
                value={sbiFilter}
                onChange={(event) => setSbiFilter(event.target.value as SbiFilter)}
                style={styles.select}
                disabled={!data.sbiCredit}
                title={data.sbiCredit ? undefined : "SBI信用データが未取得のため利用できません"}
              >
                <option value="all">指定なし</option>
                <option value="sbi_any">売可あり</option>
              </select>
            </label>
            <label style={styles.filterItem}>
              <span style={styles.filterLabel}>クロス戦略</span>
              <select value={strategyFilter} onChange={(event) => setStrategyFilter(event.target.value as StrategyFilter)} style={styles.select}>
                <option value="all">指定なし</option>
                {CROSS_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label style={styles.filterItem}>
              <span style={styles.filterLabel}>並び順</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} style={styles.select}>
                <option value="code">コード順</option>
                <option value="company">銘柄名順</option>
                <option value="investment">最低投資金額順</option>
                <option value="available_shares">日興在庫が多い順</option>
              </select>
            </label>
            <label style={{ ...styles.filterItem, flex: "1 1 220px" }}>
              <span style={styles.filterLabel}>検索</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="銘柄名・コード・優待内容・メモ"
                style={styles.search}
              />
            </label>
          </div>

          <div style={styles.resultsMeta}>
            <span style={styles.resultsCount}>{hydrated ? filteredRows.length : "-"}</span>
            <span style={styles.resultsLabel}>件</span>
            {axis === "preparation" ? (
              <span style={styles.resultsNote}>
                仕込み月軸は、優待メモに仕込み開始（◯か月前）を設定した銘柄だけが対象です。
              </span>
            ) : null}
          </div>

          <div style={styles.tableLayout}>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 64 }}>コード</th>
                    <th style={{ ...styles.th, minWidth: 160 }}>銘柄</th>
                    <th style={{ ...styles.th, width: 84 }}>権利月</th>
                    <th style={{ ...styles.th, width: 120 }}>日興</th>
                    <th style={{ ...styles.th, width: 76 }}>SBI</th>
                    <th style={{ ...styles.th, width: 88 }}>仕込み開始</th>
                    <th style={{ ...styles.th, width: 88 }}>1株開始</th>
                    <th style={{ ...styles.th, width: 104 }}>クロス戦略</th>
                    <th style={{ ...styles.th, width: 72 }}>実績</th>
                    <th style={{ ...styles.th, width: 130 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {!hydrated ? (
                    <tr>
                      <td colSpan={10} style={styles.emptyCell}>読み込み中…</td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={styles.emptyCell}>
                        {axis === "preparation"
                          ? "この月に仕込みを開始する登録銘柄はありません。"
                          : "条件に一致する銘柄がありません。"}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const acquired = acquiredByCode.get(row.code);
                      const isSelected = row.key === selectedRowKey;
                      const rowStyle = isSelected
                        ? styles.trSelected
                        : row.passed
                          ? styles.trPassed
                          : row.added
                            ? styles.trAdded
                            : row.picked
                              ? styles.trPicked
                              : styles.tr;
                      return (
                        <tr
                          key={row.key}
                          style={rowStyle}
                          onClick={() => setSelectedRowKey(isSelected ? null : row.key)}
                        >
                          <td style={styles.tdCode}>{row.code || "-"}</td>
                          <td style={styles.tdName} title={row.candidate?.benefit_summary ?? row.memo?.memo ?? ""}>
                            {row.name}
                          </td>
                          <td style={styles.td}>{formatMonths(row.months)}</td>
                          <td style={styles.td}>{renderNikkoCell(row.code)}</td>
                          <td style={styles.td}>{renderSbiCell(row.code)}</td>
                          <td style={styles.td}>
                            {row.memo?.preparationMonthsBefore !== undefined
                              ? `${row.memo.preparationMonthsBefore}ヶ月前`
                              : <span style={styles.cellMuted}>-</span>}
                          </td>
                          <td style={styles.td}>
                            {row.memo?.oneShareStartedAt
                              ? row.memo.oneShareStartedAt
                              : <span style={styles.cellMuted}>-</span>}
                          </td>
                          <td style={styles.td}>
                            {row.memo
                              ? <span style={styles.chipStrategy}>{row.memo.crossType}</span>
                              : <span style={styles.cellMuted}>-</span>}
                          </td>
                          <td style={styles.td}>
                            {acquired
                              ? <span style={styles.chipAcquired} title={acquired.latestKey ? `直近: ${acquired.latestKey}` : undefined}>✓{acquired.count}</span>
                              : <span style={styles.cellMuted}>-</span>}
                          </td>
                          <td style={styles.td}>{renderRowActions(row)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {selectedRow ? (
              <aside style={styles.detailPanel}>
                <div style={styles.detailHeader}>
                  <div>
                    <span style={styles.codeChip}>{selectedRow.code || "コードなし"}</span>
                    <h2 style={styles.detailTitle}>{selectedRow.name}</h2>
                    <div style={styles.detailMonths}>権利月: {formatMonths(selectedRow.months)}</div>
                  </div>
                  <button type="button" onClick={() => setSelectedRowKey(null)} style={styles.detailClose} aria-label="詳細を閉じる">✕</button>
                </div>

                <div style={styles.detailActions}>{renderRowActions(selectedRow)}</div>

                {selectedRow.candidate ? (
                  <section style={styles.detailSection}>
                    <h3 style={styles.detailSectionTitle}>優待内容</h3>
                    <p style={styles.detailText}>{selectedRow.candidate.benefit_summary || "（記載なし）"}</p>
                    <p style={styles.detailSub}>
                      最低投資金額: {selectedRow.candidate.minimum_investment_text || "不明"}
                    </p>
                    <div style={styles.detailLinks}>
                      <a href={selectedRow.candidate.minkabu_yutai_url} target="_blank" rel="noreferrer" style={styles.detailLink}>
                        みんかぶ優待
                      </a>
                      {selectedRow.candidate.official_benefit_url ? (
                        <a href={selectedRow.candidate.official_benefit_url} target="_blank" rel="noreferrer" style={styles.detailLink}>
                          公式優待ページ
                        </a>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <section style={styles.detailSection}>
                  <h3 style={styles.detailSectionTitle}>日興 一般信用</h3>
                  {nikkoCreditForSelected ? (
                    <>
                      <div style={styles.chipRow}>{renderNikkoCell(selectedRow.code)}</div>
                      <p style={styles.detailSub}>
                        一般売建可能数量: {nikkoCreditForSelected.available_shares ?? "対象外"}
                      </p>
                      {nikkoCreditForSelected.regulation_details.length > 0 ? (
                        <ul style={styles.detailList}>
                          {nikkoCreditForSelected.regulation_details.map((detail) => (
                            <li key={detail} style={styles.detailListItem}>{detail}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <p style={styles.detailSub}>日興データなし</p>
                  )}
                  <p style={styles.detailSub}>SBI: {data.sbiCredit && isHandledBySbiShort(data.sbiCredit.by_code[selectedRow.code]) ? "短期売り対象" : "対象データなし"}</p>
                </section>

                {selectedRow.memo ? (
                  <section style={styles.detailSection}>
                    <h3 style={styles.detailSectionTitle}>優待メモ</h3>
                    <dl style={styles.detailDl}>
                      <dt style={styles.detailDt}>クロス戦略</dt>
                      <dd style={styles.detailDd}>{selectedRow.memo.crossType}</dd>
                      <dt style={styles.detailDt}>仕込み開始</dt>
                      <dd style={styles.detailDd}>
                        {selectedRow.memo.preparationMonthsBefore !== undefined
                          ? `権利月の${selectedRow.memo.preparationMonthsBefore}ヶ月前`
                          : "未設定"}
                      </dd>
                      <dt style={styles.detailDt}>早打ち目安</dt>
                      <dd style={styles.detailDd}>{selectedRow.memo.entryTiming || "未設定"}</dd>
                      <dt style={styles.detailDt}>1株保有開始</dt>
                      <dd style={styles.detailDd}>{selectedRow.memo.oneShareStartedAt || "未設定"}</dd>
                      <dt style={styles.detailDt}>任期条件</dt>
                      <dd style={styles.detailDd}>{selectedRow.memo.tenureRule || "未設定"}</dd>
                      <dt style={styles.detailDt}>優先度</dt>
                      <dd style={styles.detailDd}>{"★".repeat(selectedRow.memo.priority)}</dd>
                    </dl>
                    {selectedRow.memo.memo ? (
                      <p style={styles.detailMemoText}>{selectedRow.memo.memo}</p>
                    ) : null}
                    <a href="/tools/yutai-memo" style={styles.detailLink}>優待メモ帳で編集する</a>
                  </section>
                ) : (
                  <section style={styles.detailSection}>
                    <h3 style={styles.detailSectionTitle}>優待メモ</h3>
                    <p style={styles.detailSub}>未登録です。「＋メモ」で優待メモへ追加できます。</p>
                  </section>
                )}

                <section style={styles.detailSection}>
                  <h3 style={styles.detailSectionTitle}>クロス購入実績</h3>
                  {acquiredForSelected && acquiredForSelected.entries.length > 0 ? (
                    <ul style={styles.detailList}>
                      {[...acquiredForSelected.entries]
                        .sort((a, b) => (b.entitlementMonthKey ?? b.acquiredAt).localeCompare(a.entitlementMonthKey ?? a.acquiredAt))
                        .map((entry) => (
                          <li key={entry.id} style={styles.detailListItem}>
                            {entry.entitlementMonthKey ?? entry.acquiredAt.slice(0, 10)}
                            {entry.note ? ` — ${entry.note}` : ""}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p style={styles.detailSub}>実績なし</p>
                  )}
                </section>
              </aside>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

const INDIGO = "#4f46e5";
const INDIGO_LIGHT = "rgba(79,70,229,0.10)";

const baseChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 7px",
  borderRadius: 6,
  fontSize: 11,
  lineHeight: 1.5,
  whiteSpace: "nowrap",
};

const baseActionButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 30,
  height: 28,
  padding: "0 8px",
  borderRadius: 8,
  fontSize: 13,
  lineHeight: 1,
  cursor: "pointer",
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 24px 72px",
    background:
      "radial-gradient(ellipse 1200px 500px at 0% -10%, rgba(99,102,241,0.10) 0%, transparent 60%), " +
      "radial-gradient(ellipse 800px 600px at 100% 80%, rgba(79,70,229,0.06) 0%, transparent 55%), " +
      "#f1f5f9",
  },
  shell: {
    width: "100%",
    maxWidth: 1500,
    margin: "0 auto",
  },
  hero: {
    marginBottom: 24,
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
    letterSpacing: 0.4,
  },
  heroEyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: INDIGO,
  },
  heroTitle: {
    margin: "12px 0 8px",
    fontSize: "clamp(26px, 3vw, 36px)",
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: -1,
    color: "#0f172a",
  },
  heroNote: {
    margin: 0,
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.75,
    color: "#475569",
  },
  heroMeta: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  metaChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.08)",
    fontSize: 12,
    color: "#475569",
    fontWeight: 600,
  },
  metaOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "#22c55e",
  },
  noticeBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    padding: "10px 14px",
    borderRadius: 12,
    background: "#eef2ff",
    border: "1px solid rgba(79,70,229,0.20)",
    color: "#3730a3",
    fontSize: 13,
    fontWeight: 600,
  },
  noticeClose: {
    marginLeft: "auto",
    border: "none",
    background: "transparent",
    color: "#6366f1",
    cursor: "pointer",
    fontSize: 13,
    padding: 4,
  },
  panel: {
    background: "#ffffff",
    borderRadius: 24,
    padding: "20px 20px 24px",
    boxShadow: "0 1px 3px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 16,
    marginBottom: 14,
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  },
  filterItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: "0 1 auto",
    minWidth: 130,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
  },
  select: {
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#ffffff",
    padding: "8px 10px",
    fontSize: 13,
    color: "#374151",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  search: {
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#ffffff",
    padding: "8px 12px",
    fontSize: 13,
    color: "#0f172a",
    boxSizing: "border-box",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  resultsMeta: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 12,
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
  resultsNote: {
    marginLeft: 10,
    fontSize: 12,
    color: "#64748b",
  },
  tableLayout: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
  },
  tableScroll: {
    flex: "1 1 auto",
    minWidth: 0,
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
  },
  table: {
    width: "100%",
    minWidth: 960,
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    position: "sticky",
    top: 0,
    background: "#f8fafc",
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "left",
    padding: "10px 10px",
    borderBottom: "1px solid rgba(15,23,42,0.10)",
    whiteSpace: "nowrap",
  },
  tr: {
    cursor: "pointer",
    background: "#ffffff",
    borderLeft: "3px solid transparent",
  },
  trPicked: {
    cursor: "pointer",
    background: "#fffbeb",
    borderLeft: "3px solid #f59e0b",
  },
  trAdded: {
    cursor: "pointer",
    background: "#f0fdf4",
    borderLeft: "3px solid #22c55e",
  },
  trPassed: {
    cursor: "pointer",
    background: "#f8fafc",
    borderLeft: "3px solid #cbd5e1",
    opacity: 0.55,
  },
  trSelected: {
    cursor: "pointer",
    background: "#eef2ff",
    borderLeft: "3px solid #4f46e5",
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    color: "#334155",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  },
  tdCode: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    color: "#475569",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  },
  tdName: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    color: "#0f172a",
    fontWeight: 700,
    maxWidth: 240,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  },
  emptyCell: {
    padding: "36px 16px",
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
  },
  cellMuted: {
    color: "#cbd5e1",
  },
  chipRow: {
    display: "inline-flex",
    gap: 4,
    flexWrap: "wrap",
  },
  chipGeneralOk: {
    ...baseChip,
    background: "#dcfce7",
    color: "#15803d",
    fontWeight: 800,
    border: "1px solid rgba(34,197,94,0.25)",
  },
  chipGeneralCaution: {
    ...baseChip,
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: 800,
    border: "1px solid rgba(245,158,11,0.25)",
  },
  chipGeneralStop: {
    ...baseChip,
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 800,
    border: "1px solid rgba(239,68,68,0.25)",
  },
  chipGeneralOutOfStock: {
    ...baseChip,
    background: "#f1f5f9",
    color: "#94a3b8",
    fontWeight: 700,
    border: "1px solid rgba(15,23,42,0.06)",
  },
  chipInstitutional: {
    ...baseChip,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 800,
    border: "1px solid rgba(59,130,246,0.25)",
  },
  chipSbi: {
    ...baseChip,
    background: "#f0fdf4",
    color: "#166534",
    fontWeight: 800,
    border: "1px solid rgba(34,197,94,0.2)",
  },
  chipStrategy: {
    ...baseChip,
    background: "#eef2ff",
    color: "#4338ca",
    fontWeight: 700,
    border: "1px solid rgba(79,70,229,0.15)",
  },
  chipAcquired: {
    ...baseChip,
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: 800,
    border: "1px solid rgba(16,185,129,0.2)",
  },
  addedChip: {
    ...baseChip,
    background: "#f0fdf4",
    color: "#15803d",
    fontWeight: 700,
    border: "1px solid rgba(34,197,94,0.2)",
  },
  actionRow: {
    display: "inline-flex",
    gap: 4,
    alignItems: "center",
  },
  actionButton: {
    ...baseActionButton,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#ffffff",
    color: "#64748b",
  },
  actionPickActive: {
    ...baseActionButton,
    border: "1px solid rgba(245,158,11,0.35)",
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: 800,
  },
  actionPassActive: {
    ...baseActionButton,
    border: "1px solid rgba(100,116,139,0.35)",
    background: "#e2e8f0",
    color: "#475569",
    fontWeight: 800,
  },
  actionAdd: {
    ...baseActionButton,
    border: "1px solid rgba(79,70,229,0.25)",
    background: "#eef2ff",
    color: "#4338ca",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  detailPanel: {
    flex: "0 0 340px",
    maxWidth: 340,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#fdfdfe",
    padding: "16px 16px 20px",
    position: "sticky",
    top: 16,
    maxHeight: "calc(100vh - 32px)",
    overflowY: "auto",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
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
  },
  detailTitle: {
    margin: "6px 0 2px",
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.3,
    color: "#0f172a",
  },
  detailMonths: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },
  detailClose: {
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#ffffff",
    color: "#94a3b8",
    borderRadius: 999,
    width: 26,
    height: 26,
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  },
  detailActions: {
    marginBottom: 12,
  },
  detailSection: {
    paddingTop: 12,
    marginTop: 12,
    borderTop: "1px solid rgba(15,23,42,0.06)",
  },
  detailSectionTitle: {
    margin: "0 0 8px",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: 0.4,
  },
  detailText: {
    margin: "0 0 6px",
    fontSize: 13,
    lineHeight: 1.7,
    color: "#334155",
    whiteSpace: "pre-wrap",
  },
  detailSub: {
    margin: "4px 0",
    fontSize: 12,
    color: "#64748b",
  },
  detailLinks: {
    display: "flex",
    gap: 10,
    marginTop: 8,
    flexWrap: "wrap",
  },
  detailLink: {
    fontSize: 12,
    fontWeight: 700,
    color: INDIGO,
  },
  detailList: {
    margin: "6px 0 0",
    paddingLeft: 18,
  },
  detailListItem: {
    fontSize: 12,
    lineHeight: 1.7,
    color: "#475569",
    wordBreak: "break-all",
  },
  detailDl: {
    display: "grid",
    gridTemplateColumns: "90px 1fr",
    rowGap: 4,
    columnGap: 8,
    margin: 0,
  },
  detailDt: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 700,
  },
  detailDd: {
    margin: 0,
    fontSize: 12,
    color: "#334155",
    fontWeight: 600,
  },
  detailMemoText: {
    margin: "10px 0 8px",
    padding: "10px 12px",
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid rgba(15,23,42,0.05)",
    fontSize: 12,
    lineHeight: 1.7,
    color: "#334155",
    whiteSpace: "pre-wrap",
  },
};
