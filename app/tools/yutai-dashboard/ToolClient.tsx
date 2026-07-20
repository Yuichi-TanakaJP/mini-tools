"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addMemoItemFromCandidate, isImportedMonthlyYutaiCandidate } from "@/app/tools/yutai-memo/candidate-import";
import { loadArchivedItems, loadItems, saveItems } from "@/app/tools/yutai-memo/storage";
import { CROSS_TYPES, type ArchivedMemoItem, type CrossType, type MemoItem } from "@/app/tools/yutai-memo/types";
import { isPreparationMonth, toJstYearMonth } from "@/app/tools/yutai-memo/date-utils";
import {
  applyMemoEdit,
  buildMemoEditDraft,
  type MemoEditDraft,
} from "@/app/tools/_shared/yutai-memo-edit";
import { buildCalendarCells } from "./calendar";
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
  saveCardMemos,
  saveCodeSet,
  type CalendarCardMemo,
} from "@/app/tools/_shared/yutai-selection";
import { calculateSimpleYutaiEfficiency } from "@/app/tools/_shared/yutai-efficiency";
import type { MonthlyYutaiCandidate, MonthlyYutaiPageData, NikkoCreditRecord } from "@/app/tools/yutai-candidates/types";

type StatusFilter = "all" | "added" | "picked" | "passed" | "unselected";
type CrossFilter = "all" | "general" | "general_watch" | "institutional" | "any";
type SbiFilter = "all" | "sbi_any";
type StrategyFilter = "all" | CrossType;
type SortKey = "code" | "company" | "investment" | "efficiency" | "available_shares";
type CalendarAxis = "entitlement" | "preparation";

// data-loader の ALL_MONTHS_ID と同じ値。data-loader は node:fs を使うため client からは import しない。
const ALL_MONTHS_ID = "all";

// 表のセルからその場で編集できる項目
type InlineField = "crossType" | "preparationMonthsBefore" | "oneShareStartedAt";

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

function formatYen(value: number) {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatEfficiencyPercent(value: number) {
  return `${value.toLocaleString("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function getRowEfficiency(row: DashboardRow, cardMemos: Record<string, CalendarCardMemo>) {
  // 仕込み月軸の memo 行は複数権利月を持ち得るため、月別入力の対象外にする。
  if (!row.candidate || row.key.startsWith("memo:")) return null;
  const cardMemo = cardMemos[getCardMemoKey(row.candidate)];
  return calculateSimpleYutaiEfficiency({
    minimumInvestmentYen: row.candidate.minimum_investment_yen,
    requiredShares: cardMemo?.requiredShares,
    benefitValueYen: cardMemo?.benefitValueYen,
  });
}

// oneShareStartedAt（YYYY-MM 想定）から開始の年・月を取り出す。フリーテキストは null。
function parseOneShareStart(value: string | undefined): { year: number; month: number } | null {
  const matched = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
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
  const jstNow = useMemo(() => toJstYearMonth(new Date()), []);
  const calendarNowIso = useMemo(() => new Date().toISOString(), []);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calendarYear, setCalendarYear] = useState(jstNow.year);
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
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState<MemoEditDraft | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowKey: string; field: InlineField } | null>(null);
  // 1株保有開始の月ピッカー。セルを押し広げないよう、クリック位置に fixed で浮かせる。
  const [monthPicker, setMonthPicker] = useState<{ rowKey: string; year: number; left: number; top: number } | null>(null);
  const monthPickerRef = useRef<HTMLDivElement | null>(null);
  const didPersistPicked = useRef(false);
  const didPersistPassed = useRef(false);

  const isAllMonths = data.selectedMonthId === ALL_MONTHS_ID;
  const selectedMonth = isAllMonths ? null : Number(data.selectedMonthId.slice(5, 7));

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

  useEffect(() => {
    if (!monthPicker) return;
    function onDocMouseDown(event: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setMonthPicker(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMonthPicker(null);
    }
    // fixed 配置なのでスクロールしたら位置がずれる。閉じて開き直してもらう。
    function onScroll() {
      setMonthPicker(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [monthPicker]);

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

  // 12ヶ月ビュー用の行。登録済みメモを対象にし、検索・クロス戦略で絞り込む。
  const calendarRows = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
    return memoItems
      .filter((memo) => {
        if (strategyFilter !== "all" && memo.crossType !== strategyFilter) return false;
        if (!normalizedQuery) return true;
        return normalizeText([memo.name, memo.code ?? "", memo.memo, memo.entryTiming ?? ""].join(" "))
          .includes(normalizedQuery);
      })
      .map((memo) => {
        const acquired = memo.code ? acquiredByCode.get(memo.code) : undefined;
        const start = parseOneShareStart(memo.oneShareStartedAt);
        // 選択年度での 1 株保有経過年数（開始年を 1 年目とする）。未保有なら null。
        const holdYear = start && calendarYear >= start.year ? calendarYear - start.year + 1 : null;
        return {
          memo,
          cells: buildCalendarCells(memo, acquired?.entries ?? [], calendarYear, calendarNowIso),
          holdYear,
        };
      })
      .sort((a, b) => {
        const firstA = Math.min(...(a.memo.months?.length ? a.memo.months : [13]));
        const firstB = Math.min(...(b.memo.months?.length ? b.memo.months : [13]));
        if (firstA !== firstB) return firstA - firstB;
        return collator.compare(a.memo.name, b.memo.name);
      });
  }, [acquiredByCode, calendarNowIso, calendarYear, memoItems, query, strategyFilter]);

  // 年度セレクタの選択肢。取得実績の最古年〜今年+1 を降順で並べる。
  const availableCalendarYears = useMemo(() => {
    let minYear = jstNow.year - 1;
    for (const archive of archivedItems) {
      const matched = archive.entitlementMonthKey ? /^(\d{4})-\d{2}$/.exec(archive.entitlementMonthKey) : null;
      if (matched) minYear = Math.min(minYear, Number(matched[1]));
    }
    const maxYear = jstNow.year + 1;
    const years: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) years.push(year);
    return years;
  }, [archivedItems, jstNow.year]);

  const rows = useMemo<DashboardRow[]>(() => {
    if (axis === "preparation") {
      // 仕込み月軸はメモ登録済み＋仕込み時期設定済みに限定する（2026-07-03 決定）
      // 全月表示では「仕込み時期を設定した銘柄すべて」を対象にする
      const candidateByCode = new Map(data.items.map((item) => [item.code, item]));
      return memoItems
        .filter((item) => (
          selectedMonth === null
            ? item.preparationMonthsBefore !== undefined
            : isPreparationMonth(item.months, item.preparationMonthsBefore, selectedMonth)
        ))
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
        // 各行はその候補の権利月そのものを示す。別権利月で登録済みの銘柄でも、
        // メモの月ではなくこの候補の月を表示する（別月行が同じ月に見えるのを防ぐ）。
        months: [item.month],
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
        if (sortKey === "efficiency") {
          const aEfficiency = getRowEfficiency(a, cardMemos)?.efficiencyPercent;
          const bEfficiency = getRowEfficiency(b, cardMemos)?.efficiencyPercent;
          if (aEfficiency === undefined && bEfficiency === undefined) return collator.compare(a.code, b.code);
          if (aEfficiency === undefined) return 1;
          if (bEfficiency === undefined) return -1;
          return bEfficiency - aEfficiency;
        }
        if (sortKey === "available_shares" && byCode) {
          const aShares = byCode[a.code]?.available_shares ?? -1;
          const bShares = byCode[b.code]?.available_shares ?? -1;
          return bShares - aShares;
        }
        return collator.compare(a.name, b.name);
      });
  }, [cardMemos, crossFilter, data.nikkoCredit, data.sbiCredit, query, rows, sbiFilter, sortKey, statusFilter, strategyFilter]);

  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.key === selectedRowKey) ?? null,
    [filteredRows, selectedRowKey],
  );
  const selectedEfficiencyMemoKey = selectedRow?.candidate && !selectedRow.key.startsWith("memo:")
    ? getCardMemoKey(selectedRow.candidate)
    : null;
  const selectedCardMemo = selectedEfficiencyMemoKey ? cardMemos[selectedEfficiencyMemoKey] : undefined;
  const selectedEfficiency = selectedRow ? getRowEfficiency(selectedRow, cardMemos) : null;

  function updateSelectedEfficiencyInput(
    field: "requiredShares" | "benefitValueYen",
    rawValue: string,
  ) {
    if (!selectedEfficiencyMemoKey) return;
    const parsed = Number(rawValue);
    const value = rawValue !== "" && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    setCardMemos((prev) => {
      const current = prev[selectedEfficiencyMemoKey] ?? {
        longTermRequired: false,
        longTermBenefit: false,
        updatedAt: "",
      };
      const next = {
        ...prev,
        [selectedEfficiencyMemoKey]: {
          ...current,
          [field]: value,
          updatedAt: new Date().toISOString(),
        },
      };
      saveCardMemos(next);
      return next;
    });
  }

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

  function openMemoEdit(memo: MemoItem) {
    // 保存直前に最新を読み直すため id だけ保持し、draft は現在値から作る
    const items = loadItems();
    const target = items.find((item) => item.id === memo.id);
    if (!target) {
      setMemoItems(items);
      setAddedKeys(getAddedKeysFromMemoItems(items));
      setNotice("編集対象の優待メモが見つかりませんでした。");
      return;
    }
    setEditingMemoId(target.id);
    setMemoDraft(buildMemoEditDraft(target));
    setNotice(null);
  }

  function closeMemoEdit() {
    setEditingMemoId(null);
    setMemoDraft(null);
  }

  function saveMemoEdit() {
    if (!editingMemoId || !memoDraft) return;
    const items = loadItems();
    const { items: next, updated } = applyMemoEdit(items, editingMemoId, memoDraft, new Date().toISOString());
    if (!updated) {
      setMemoItems(items);
      setAddedKeys(getAddedKeysFromMemoItems(items));
      setNotice("保存対象の優待メモが見つかりませんでした。");
      closeMemoEdit();
      return;
    }
    saveItems(next);
    setMemoItems(next);
    setAddedKeys(getAddedKeysFromMemoItems(next));
    setNotice(`${memoDraft.name.trim() || "優待メモ"} を保存しました。`);
    closeMemoEdit();
  }

  function updateDraft<K extends keyof MemoEditDraft>(key: K, value: MemoEditDraft[K]) {
    setMemoDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // その行の対象月の優待メモを返す。未登録なら候補からメモへ追加してから返す。
  // これにより「メモ追加済みかどうか」に関係なく、セルを編集すると自動でメモ化される。
  function resolveEditableMemo(
    row: DashboardRow,
  ): { items: MemoItem[]; memo: MemoItem; addedNew: boolean } | null {
    const items = loadItems();
    // 1) この行の対象月をすでに含むメモがあればそれを編集する
    if (row.added && row.memo) {
      const memo = items.find((item) => item.id === row.memo!.id);
      if (memo) return { items, memo, addedNew: false };
    }
    // 2) 同じ銘柄が別権利月で登録済みなら、当月をそのメモの権利月に足して編集する。
    //    銘柄単位の値（クロス戦略・1株保有開始など）を失わずに引き継げる。
    if (row.candidate && row.memo) {
      const base = items.find((item) => item.id === row.memo!.id);
      if (base) {
        const month = row.candidate.month;
        const months = Array.isArray(base.months) ? base.months : [];
        if (months.includes(month)) return { items, memo: base, addedNew: false };
        const merged = { ...base, months: [...months, month].sort((a, b) => a - b), updatedAt: new Date().toISOString() };
        const nextItems = items.map((item) => (item.id === base.id ? merged : item));
        saveItems(nextItems);
        return { items: nextItems, memo: merged, addedNew: true };
      }
    }
    // 3) 銘柄自体が未登録なら候補から新規メモを作る
    if (row.candidate) {
      const candidate = row.candidate;
      const result = addMemoItemFromCandidate({
        code: candidate.code,
        companyName: candidate.company_name,
        month: candidate.month,
        preparationMonthsBefore: cardMemos[getCardMemoKey(candidate)]?.preparationMonthsBefore,
        minimumInvestmentText: candidate.minimum_investment_text,
        benefitCategoryTags: candidate.benefit_category_tags,
        minkabuYutaiUrl: candidate.minkabu_yutai_url,
        officialBenefitUrl: candidate.official_benefit_url,
        officialLinkStatus: candidate.official_link_status,
        source: "minkabu",
        pickedFrom: "monthly_yutai_list",
      });
      if (!result.added) return null;
      const nextItems = loadItems();
      const created = nextItems.find(
        (item) => item.code === candidate.code && Array.isArray(item.months) && item.months.includes(candidate.month),
      );
      return created ? { items: nextItems, memo: created, addedNew: true } : null;
    }
    return null;
  }

  // 表のセルを直接編集して 1 項目だけ保存する。共有の applyMemoEdit を再利用する。
  function commitRowInlineEdit(row: DashboardRow, patch: Partial<MemoEditDraft>) {
    const resolved = resolveEditableMemo(row);
    if (!resolved) {
      setNotice("優待メモの更新に失敗しました。");
      setEditingCell(null);
      return;
    }
    const draft = { ...buildMemoEditDraft(resolved.memo), ...patch };
    const { items: next, updated } = applyMemoEdit(resolved.items, resolved.memo.id, draft, new Date().toISOString());
    if (updated) {
      saveItems(next);
      setMemoItems(next);
      setAddedKeys(getAddedKeysFromMemoItems(next));
      if (resolved.addedNew) setNotice(`${row.name} を優待メモに追加しました。`);
    }
    setEditingCell(null);
  }

  function beginCellEdit(row: DashboardRow, field: InlineField) {
    setEditingCell({ rowKey: row.key, field });
  }

  // 誤って優待メモへ追加した行を戻す。対象月だけを外し、権利月が無くなればメモごと削除する。
  function removeMemoForRow(row: DashboardRow) {
    if (!row.memo) return;
    const items = loadItems();
    const target = items.find((item) => item.id === row.memo!.id);
    if (!target) {
      setMemoItems(items);
      setAddedKeys(getAddedKeysFromMemoItems(items));
      setNotice("解除対象の優待メモが見つかりませんでした。");
      return;
    }
    const months = Array.isArray(target.months) ? target.months : [];
    // 候補行はその権利月だけを外す。それ以外（仕込み月軸のメモ行）はメモごと削除する。
    const month = row.candidate ? row.candidate.month : null;
    // 別権利月で登録済みの銘柄を未登録月の行から消そうとした場合は、無関係なメモを守る。
    if (month !== null && !months.includes(month)) {
      setNotice(`${row.name} の ${month}月権利は優待メモに追加されていません。`);
      return;
    }
    const removesWholeMemo = month === null || months.length <= 1;
    const message = removesWholeMemo
      ? `${row.name} の優待メモを削除して未追加に戻します。よろしいですか？`
      : `${row.name} の ${month}月権利を優待メモから外します。よろしいですか？`;
    if (!window.confirm(message)) return;

    const now = new Date().toISOString();
    const next = removesWholeMemo
      ? items.filter((item) => item.id !== target.id)
      : items.map((item) =>
          item.id === target.id
            ? { ...item, months: months.filter((value) => value !== month), updatedAt: now }
            : item,
        );
    saveItems(next);
    setMemoItems(next);
    setAddedKeys(getAddedKeysFromMemoItems(next));
    closeMemoEdit();
    setEditingCell(null);
    setNotice(
      removesWholeMemo
        ? `${row.name} の優待メモを削除しました。`
        : `${row.name} の ${month}月権利を優待メモから外しました。`,
    );
  }

  function openMonthPicker(row: DashboardRow, event: React.MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const current = row.memo?.oneShareStartedAt ?? "";
    const matched = /^(\d{4})-\d{2}$/.exec(current);
    setEditingCell(null);
    setMonthPicker({
      rowKey: row.key,
      year: matched ? Number(matched[1]) : new Date().getFullYear(),
      left: rect.left,
      top: rect.bottom + 4,
    });
  }

  function pickMonth(row: DashboardRow, value: string) {
    commitRowInlineEdit(row, { oneShareStartedAt: value });
    setMonthPicker(null);
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
    closeMemoEdit();
    setEditingCell(null);
    setMonthPicker(null);
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

  // クリックで開く編集ボタン用のラッパー。登録有無に関わらず編集でき、
  // 未登録の場合は確定時に優待メモへ自動追加する。
  function renderEditableCell(row: DashboardRow, field: InlineField, display: React.ReactNode) {
    return (
      <button
        type="button"
        style={styles.cellEditTrigger}
        title="クリックで編集"
        onClick={(event) => {
          event.stopPropagation();
          beginCellEdit(row, field);
        }}
      >
        {display}
      </button>
    );
  }

  function isEditingCell(row: DashboardRow, field: InlineField) {
    return editingCell?.rowKey === row.key && editingCell.field === field;
  }

  function renderPreparationCell(row: DashboardRow) {
    // 表示・初期値は銘柄単位のメモ（別権利月で登録済みでも値を見せる）。
    const memo = row.memo;
    if (isEditingCell(row, "preparationMonthsBefore")) {
      return (
        <select
          autoFocus
          value={memo?.preparationMonthsBefore ?? ""}
          style={styles.cellSelect}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const value = event.target.value === "" ? "" : Number(event.target.value);
            commitRowInlineEdit(row, { preparationMonthsBefore: value as MemoEditDraft["preparationMonthsBefore"] });
          }}
          onBlur={() => setEditingCell(null)}
        >
          <option value="">未設定</option>
          {Array.from({ length: 12 }, (_, i) => i).map((n) => (
            <option key={n} value={n}>{n}ヶ月前</option>
          ))}
        </select>
      );
    }
    const display = memo?.preparationMonthsBefore !== undefined
      ? `${memo.preparationMonthsBefore}ヶ月前`
      : <span style={styles.cellMuted}>未設定</span>;
    return renderEditableCell(row, "preparationMonthsBefore", display);
  }

  function renderOneShareCell(row: DashboardRow) {
    const memo = row.memo;
    const display = memo?.oneShareStartedAt
      ? memo.oneShareStartedAt
      : <span style={styles.cellMuted}>未購入</span>;
    const isOpen = monthPicker?.rowKey === row.key;
    return (
      <button
        type="button"
        style={isOpen ? { ...styles.cellEditTrigger, ...styles.cellEditTriggerActive } : styles.cellEditTrigger}
        title="クリックで月を選ぶ"
        onClick={(event) => {
          event.stopPropagation();
          if (isOpen) setMonthPicker(null);
          else openMonthPicker(row, event);
        }}
      >
        {display}
      </button>
    );
  }

  function renderCrossTypeCell(row: DashboardRow) {
    const memo = row.memo;
    if (isEditingCell(row, "crossType")) {
      return (
        <select
          autoFocus
          value={memo?.crossType ?? "長期優遇なし"}
          style={styles.cellSelect}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => commitRowInlineEdit(row, { crossType: event.target.value as CrossType })}
          onBlur={() => setEditingCell(null)}
        >
          {CROSS_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      );
    }
    const display = memo
      ? <span style={styles.chipStrategy}>{memo.crossType}</span>
      : <span style={styles.cellMuted}>未設定</span>;
    return renderEditableCell(row, "crossType", display);
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
  const isEditingSelectedMemo = Boolean(selectedRow?.memo && editingMemoId === selectedRow.memo.id);

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
                <option value={ALL_MONTHS_ID}>全月</option>
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
                <option value="efficiency">簡易優待効率が高い順</option>
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

          <div style={styles.viewToggleRow}>
            <div style={styles.viewToggle}>
              <button
                type="button"
                style={viewMode === "table" ? styles.viewToggleActive : styles.viewToggleButton}
                onClick={() => setViewMode("table")}
              >
                テーブル
              </button>
              <button
                type="button"
                style={viewMode === "calendar" ? styles.viewToggleActive : styles.viewToggleButton}
                onClick={() => setViewMode("calendar")}
              >
                12ヶ月ビュー
              </button>
            </div>
          </div>

          <div style={styles.resultsMeta}>
            <span style={styles.resultsCount}>
              {hydrated ? (viewMode === "calendar" ? calendarRows.length : filteredRows.length) : "-"}
            </span>
            <span style={styles.resultsLabel}>件</span>
            {viewMode === "calendar" ? (
              <span style={styles.resultsNote}>
                12ヶ月ビューは登録済み銘柄が対象。権利月・仕込みは毎年共通、取得と1株保有は選択年度で表示します。
              </span>
            ) : axis === "preparation" ? (
              <span style={styles.resultsNote}>
                仕込み月軸は、優待メモに仕込み開始（◯か月前）を設定した銘柄だけが対象です。
              </span>
            ) : null}
          </div>

          {viewMode === "calendar" ? (
            <div style={styles.calendarScroll}>
              <div style={styles.calendarControls}>
                <label style={styles.calYearField}>
                  <span style={styles.filterLabel}>年度</span>
                  <select
                    value={calendarYear}
                    onChange={(event) => setCalendarYear(Number(event.target.value))}
                    style={styles.select}
                  >
                    {availableCalendarYears.map((year) => (
                      <option key={year} value={year}>{year}年{year === jstNow.year ? "（今年）" : ""}</option>
                    ))}
                  </select>
                </label>
                <div style={styles.calendarLegend}>
                  <span style={styles.legendItem}><span style={{ ...styles.legendSwatch, ...styles.calCellEntitlement }}>権</span>権利月</span>
                  <span style={styles.legendItem}><span style={{ ...styles.legendSwatch, ...styles.calCellPrep }}>仕</span>仕込み開始</span>
                  <span style={styles.legendItem}><span style={{ ...styles.legendSwatch, ...styles.calCellBand }} />仕込み期間</span>
                  <span style={styles.legendItem}>
                    <span style={styles.legendSwatchPlain}><span style={styles.calOverlapDot} /></span>
                    仕込みと権利が同月
                  </span>
                  <span style={styles.legendDivider} />
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendSwatch, ...styles.calCellEntitlement }}>権<span style={styles.calAcquiredMark}>✓</span></span>
                    今年度に取得
                  </span>
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendSwatch, ...styles.calCellEntitlement }}>権<span style={styles.calAcquiredPastMark}>✓</span></span>
                    他年度に取得
                  </span>
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendSwatch, ...styles.calCellBand }}><span style={styles.calPrepMark} /></span>
                    仕込み実施
                  </span>
                  <span style={styles.legendDivider} />
                  <span style={styles.legendItem}><span style={{ ...styles.legendStrip, ...styles.calHold }} />1株保有</span>
                  <span style={styles.legendItem}><span style={{ ...styles.legendStrip, ...styles.calHoldStart }} />1株開始</span>
                </div>
              </div>
              <table style={styles.calendarTable}>
                <thead>
                  <tr>
                    <th style={{ ...styles.calTh, ...styles.calNameTh }}>銘柄</th>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const isCurrent = calendarYear === jstNow.year && month === jstNow.month;
                      return (
                        <th key={month} style={isCurrent ? { ...styles.calTh, ...styles.calThCurrent } : styles.calTh}>
                          {month}月
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {!hydrated ? (
                    <tr><td colSpan={13} style={styles.emptyCell}>読み込み中…</td></tr>
                  ) : calendarRows.length === 0 ? (
                    <tr><td colSpan={13} style={styles.emptyCell}>登録済みの銘柄がありません。テーブルで「＋メモ」やセル編集を行うと登録されます。</td></tr>
                  ) : (
                    calendarRows.map(({ memo, cells, holdYear }) => (
                      <tr key={memo.id}>
                        <td style={styles.calNameCell} title={memo.name}>
                          <span style={styles.calName}>{memo.name}</span>
                          <span style={styles.calNameSub}>
                            {memo.code ? <span style={styles.calCode}>{memo.code}</span> : null}
                            {memo.oneShareStartedAt ? (
                              <span style={styles.calHoldNote} title={`1株保有開始: ${memo.oneShareStartedAt}`}>
                                1株 {memo.oneShareStartedAt}〜{holdYear ? `（${holdYear}年目）` : ""}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        {cells.map((cell, index) => {
                          const month = index + 1;
                          const isCurrent = calendarYear === jstNow.year && month === jstNow.month;
                          const badgeStyle = cell.entitlement
                            ? styles.calCellEntitlement
                            : cell.prepStart
                              ? styles.calCellPrep
                              : cell.band
                                ? styles.calCellBand
                                : styles.calCellEmpty;
                          const label = cell.entitlement ? "権" : cell.prepStart ? "仕" : "";
                          const overlapPrep = cell.entitlement && cell.prepStart;
                          const holdStyle = cell.oneShareHeld
                            ? (cell.oneShareStart ? styles.calHoldStart : styles.calHold)
                            : styles.calHoldEmpty;
                          const acquiredTitle = cell.acquiredYears.length
                            ? `取得: ${cell.acquiredYears.map((year) => `${year}年`).join("・")}`
                            : null;
                          const title = [
                            `${month}月`,
                            cell.entitlement ? "権利月" : cell.prepStart ? "仕込み開始" : cell.band ? "仕込み期間" : null,
                            cell.prepCompleted ? "仕込み実施" : null,
                            acquiredTitle,
                            overlapPrep ? "仕込み開始も同月" : null,
                            cell.oneShareStart ? "1株保有開始" : cell.oneShareHeld ? "1株保有中" : null,
                          ].filter(Boolean).join(" / ");
                          const tdStyle = {
                            ...styles.calTd,
                            ...(isCurrent ? styles.calTdCurrent : null),
                          };
                          return (
                            <td
                              key={index}
                              style={tdStyle}
                              title={title}
                            >
                              <div style={styles.calCellStack}>
                                <span style={badgeStyle}>
                                  {label}
                                  {cell.acquiredThisYear ? (
                                    <span style={styles.calAcquiredMark}>✓</span>
                                  ) : cell.acquiredPast ? (
                                    <span style={styles.calAcquiredPastMark}>✓</span>
                                  ) : null}
                                  {overlapPrep ? <span style={styles.calOverlapDot} /> : null}
                                  {cell.prepCompleted ? <span style={styles.calPrepMark} /> : null}
                                </span>
                                <span style={holdStyle} />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
          <div style={styles.tableLayout}>
            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 64 }}>コード</th>
                    <th style={{ ...styles.th, minWidth: 110 }}>銘柄</th>
                    <th style={{ ...styles.th, width: 84 }}>権利月</th>
                    <th style={{ ...styles.th, width: 88 }}>簡易効率</th>
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
                      <td colSpan={11} style={styles.emptyCell}>読み込み中…</td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={styles.emptyCell}>
                        {axis === "preparation"
                          ? "この月に仕込みを開始する登録銘柄はありません。"
                          : "条件に一致する銘柄がありません。"}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const acquired = acquiredByCode.get(row.code);
                      const efficiency = getRowEfficiency(row, cardMemos);
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
                          onClick={() => {
                            setSelectedRowKey(isSelected ? null : row.key);
                            closeMemoEdit();
                          }}
                        >
                          <td style={styles.tdCode}>{row.code || "-"}</td>
                          <td style={styles.tdName} title={row.candidate?.benefit_summary ?? row.memo?.memo ?? ""}>
                            {row.name}
                          </td>
                          <td style={styles.td}>{formatMonths(row.months)}</td>
                          <td style={styles.td}>
                            {efficiency ? (
                              <span
                                style={styles.chipEfficiency}
                                title={"必要資金: " + formatYen(efficiency.requiredCapitalYen)}
                              >
                                {formatEfficiencyPercent(efficiency.efficiencyPercent)}
                              </span>
                            ) : (
                              <span style={styles.cellMuted}>-</span>
                            )}
                          </td>
                          <td style={styles.td}>{renderNikkoCell(row.code)}</td>
                          <td style={styles.td}>{renderSbiCell(row.code)}</td>
                          <td style={styles.td}>{renderPreparationCell(row)}</td>
                          <td style={styles.td}>{renderOneShareCell(row)}</td>
                          <td style={styles.td}>{renderCrossTypeCell(row)}</td>
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
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRowKey(null);
                      closeMemoEdit();
                    }}
                    style={styles.detailClose}
                    aria-label="詳細を閉じる"
                  >
                    ✕
                  </button>
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
                  <h3 style={styles.detailSectionTitle}>簡易優待効率</h3>
                  {selectedEfficiencyMemoKey ? (
                    <>
                      <div style={styles.efficiencyInputGrid}>
                        <label style={styles.efficiencyInputLabel}>
                          <span>必要株数</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={selectedCardMemo?.requiredShares ?? ""}
                            onChange={(event) => updateSelectedEfficiencyInput("requiredShares", event.target.value)}
                            placeholder="例: 100"
                            aria-label="優待の必要株数"
                            style={styles.efficiencyInput}
                          />
                        </label>
                        <label style={styles.efficiencyInputLabel}>
                          <span>優待価値（円）</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={selectedCardMemo?.benefitValueYen ?? ""}
                            onChange={(event) => updateSelectedEfficiencyInput("benefitValueYen", event.target.value)}
                            placeholder="例: 3000"
                            aria-label="優待価値（円）"
                            style={styles.efficiencyInput}
                          />
                        </label>
                      </div>
                      {selectedEfficiency ? (
                        <div style={styles.efficiencyResult}>
                          <strong style={styles.efficiencyResultValue}>
                            {formatEfficiencyPercent(selectedEfficiency.efficiencyPercent)}
                          </strong>
                          <span>必要資金 {formatYen(selectedEfficiency.requiredCapitalYen)}</span>
                          <span>概算株価 {formatYen(selectedEfficiency.estimatedSharePriceYen)}</span>
                        </div>
                      ) : (
                        <p style={styles.detailSub}>
                          必要株数・優待価値・最低投資金額が揃うと計算します。
                        </p>
                      )}
                      <p style={styles.efficiencyNote}>
                        最低投資金額を100株分として概算。手数料・配当・株価変動は未反映です。
                      </p>
                    </>
                  ) : (
                    <p style={styles.detailSub}>
                      月別の候補行（権利月軸）から入力してください。
                    </p>
                  )}
                </section>

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
                    <div style={styles.detailSectionHead}>
                      <h3 style={styles.detailSectionTitle}>優待メモ</h3>
                      {isEditingSelectedMemo ? null : (
                        <div style={styles.detailSectionActions}>
                          <button
                            type="button"
                            onClick={() => openMemoEdit(selectedRow.memo as MemoItem)}
                            style={styles.detailEditButton}
                          >
                            編集
                          </button>
                          {selectedRow.added ? (
                            <button
                              type="button"
                              onClick={() => removeMemoForRow(selectedRow)}
                              style={styles.detailRemoveButton}
                            >
                              メモから外す
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {isEditingSelectedMemo && memoDraft ? (
                      <div style={styles.editForm}>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>銘柄名</span>
                          <input
                            type="text"
                            value={memoDraft.name}
                            onChange={(event) => updateDraft("name", event.target.value)}
                            style={styles.editInput}
                          />
                        </label>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>クロス戦略</span>
                          <select
                            value={memoDraft.crossType}
                            onChange={(event) => updateDraft("crossType", event.target.value as CrossType)}
                            style={styles.editInput}
                          >
                            {CROSS_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </label>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>仕込み開始（権利月の◯ヶ月前）</span>
                          <select
                            value={memoDraft.preparationMonthsBefore === "" ? "" : String(memoDraft.preparationMonthsBefore)}
                            onChange={(event) =>
                              updateDraft(
                                "preparationMonthsBefore",
                                event.target.value === "" ? "" : (Number(event.target.value) as MemoEditDraft["preparationMonthsBefore"]),
                              )
                            }
                            style={styles.editInput}
                          >
                            <option value="">未設定</option>
                            {Array.from({ length: 12 }, (_, i) => i).map((n) => (
                              <option key={n} value={n}>{n}ヶ月前</option>
                            ))}
                          </select>
                        </label>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>早打ち目安</span>
                          <input
                            type="text"
                            value={memoDraft.entryTiming}
                            onChange={(event) => updateDraft("entryTiming", event.target.value)}
                            placeholder="例: 8月中旬まで"
                            style={styles.editInput}
                          />
                        </label>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>1株保有開始</span>
                          <input
                            type="text"
                            value={memoDraft.oneShareStartedAt}
                            onChange={(event) => updateDraft("oneShareStartedAt", event.target.value)}
                            placeholder="例: 2025-06"
                            style={styles.editInput}
                          />
                        </label>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>任期条件</span>
                          <input
                            type="text"
                            value={memoDraft.tenureRule}
                            onChange={(event) => updateDraft("tenureRule", event.target.value)}
                            style={styles.editInput}
                          />
                        </label>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>関連リンク</span>
                          <input
                            type="url"
                            value={memoDraft.relatedUrl}
                            onChange={(event) => updateDraft("relatedUrl", event.target.value)}
                            style={styles.editInput}
                          />
                        </label>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>優先度</span>
                          <select
                            value={String(memoDraft.priority)}
                            onChange={(event) => updateDraft("priority", Number(event.target.value) as 1 | 2 | 3)}
                            style={styles.editInput}
                          >
                            <option value="1">★（高）</option>
                            <option value="2">★★（中）</option>
                            <option value="3">★★★（低）</option>
                          </select>
                        </label>
                        <label style={styles.editCheckboxRow}>
                          <input
                            type="checkbox"
                            checked={memoDraft.acquired}
                            onChange={(event) => updateDraft("acquired", event.target.checked)}
                          />
                          <span style={styles.editLabel}>取得済み</span>
                        </label>
                        <label style={styles.editField}>
                          <span style={styles.editLabel}>メモ</span>
                          <textarea
                            value={memoDraft.memo}
                            onChange={(event) => updateDraft("memo", event.target.value)}
                            rows={4}
                            style={{ ...styles.editInput, resize: "vertical" }}
                          />
                        </label>
                        <div style={styles.editButtonRow}>
                          <button type="button" onClick={saveMemoEdit} style={styles.editSave}>保存</button>
                          <button type="button" onClick={closeMemoEdit} style={styles.editCancel}>キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                          <dt style={styles.detailDt}>取得済み</dt>
                          <dd style={styles.detailDd}>{selectedRow.memo.acquired ? "はい" : "いいえ"}</dd>
                          <dt style={styles.detailDt}>優先度</dt>
                          <dd style={styles.detailDd}>{"★".repeat(selectedRow.memo.priority)}</dd>
                        </dl>
                        {selectedRow.memo.memo ? (
                          <p style={styles.detailMemoText}>{selectedRow.memo.memo}</p>
                        ) : null}
                        <a href="/tools/yutai-memo" style={styles.detailLink}>優待メモ帳で開く</a>
                      </>
                    )}
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
          )}
        </section>
      </div>

      {monthPicker ? (() => {
        const row = filteredRows.find((item) => item.key === monthPicker.rowKey);
        if (!row) return null;
        const current = row.memo?.oneShareStartedAt ?? "";
        return (
          <div
            ref={monthPickerRef}
            style={{ ...styles.monthPopover, left: monthPicker.left, top: monthPicker.top }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.monthPopoverHead}>
              <button
                type="button"
                style={styles.monthNavButton}
                aria-label="前の年"
                onClick={() => setMonthPicker((prev) => (prev ? { ...prev, year: prev.year - 1 } : prev))}
              >
                ‹
              </button>
              <span style={styles.monthPopoverYear}>{monthPicker.year}年</span>
              <button
                type="button"
                style={styles.monthNavButton}
                aria-label="次の年"
                onClick={() => setMonthPicker((prev) => (prev ? { ...prev, year: prev.year + 1 } : prev))}
              >
                ›
              </button>
            </div>
            <div style={styles.monthGrid}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const value = `${monthPicker.year}-${String(month).padStart(2, "0")}`;
                const selected = current === value;
                return (
                  <button
                    key={month}
                    type="button"
                    style={selected ? styles.monthCellActive : styles.monthCell}
                    onClick={() => pickMonth(row, value)}
                  >
                    {month}月
                  </button>
                );
              })}
            </div>
            <button type="button" style={styles.monthClear} onClick={() => pickMonth(row, "")}>
              未購入に戻す
            </button>
          </div>
        );
      })() : null}
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
  viewToggleRow: {
    display: "flex",
    marginBottom: 12,
  },
  viewToggle: {
    display: "inline-flex",
    gap: 4,
    padding: 4,
    borderRadius: 12,
    background: "#f1f5f9",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  viewToggleButton: {
    border: "none",
    background: "transparent",
    color: "#64748b",
    borderRadius: 9,
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  viewToggleActive: {
    border: "none",
    background: "#ffffff",
    color: "#4338ca",
    borderRadius: 9,
    padding: "6px 16px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(15,23,42,0.10)",
  },
  calendarScroll: {
    width: "100%",
    overflowX: "auto",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
  },
  calendarControls: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
    padding: "10px 12px",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    background: "#f8fafc",
  },
  calYearField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flexShrink: 0,
  },
  calendarLegend: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
  },
  legendDivider: {
    width: 1,
    height: 16,
    background: "rgba(15,23,42,0.12)",
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#475569",
    fontWeight: 600,
  },
  legendSwatch: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800,
  },
  calendarTable: {
    borderCollapse: "collapse",
    fontSize: 12,
    minWidth: 720,
  },
  calTh: {
    position: "sticky",
    top: 0,
    background: "#f8fafc",
    color: "#475569",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "center",
    padding: "8px 6px",
    borderBottom: "1px solid rgba(15,23,42,0.10)",
    width: 48,
    whiteSpace: "nowrap",
  },
  calThCurrent: {
    background: "#eef2ff",
    color: "#4338ca",
    boxShadow: "inset 0 -2px 0 #6366f1",
  },
  calNameTh: {
    textAlign: "left",
    minWidth: 160,
    width: 200,
    position: "sticky",
    left: 0,
    zIndex: 1,
  },
  calNameCell: {
    padding: "6px 10px",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    borderRight: "1px solid rgba(15,23,42,0.06)",
    background: "#ffffff",
    position: "sticky",
    left: 0,
    zIndex: 1,
    maxWidth: 200,
  },
  calName: {
    display: "block",
    fontWeight: 700,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  calNameSub: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  calCode: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 700,
  },
  calHoldNote: {
    fontSize: 11,
    color: "#0d9488",
    fontWeight: 700,
  },
  calTd: {
    padding: 3,
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    textAlign: "center",
  },
  calTdCurrent: {
    background: "rgba(99,102,241,0.08)",
  },
  calPrepMark: {
    position: "absolute",
    bottom: 1,
    left: "50%",
    transform: "translateX(-50%)",
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#c026d3",
    border: "1px solid #ffffff",
  },
  calCellStack: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    alignItems: "stretch",
    minWidth: 40,
  },
  calCellEmpty: {
    position: "relative",
    display: "block",
    height: 22,
    borderRadius: 5,
  },
  calCellBand: {
    position: "relative",
    display: "block",
    height: 22,
    borderRadius: 5,
    background: "rgba(79,70,229,0.12)",
  },
  calCellPrep: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    borderRadius: 5,
    background: "rgba(79,70,229,0.28)",
    color: "#3730a3",
    fontSize: 11,
    fontWeight: 800,
  },
  calCellEntitlement: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    borderRadius: 5,
    background: "#4f46e5",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 800,
  },
  calAcquiredMark: {
    position: "absolute",
    top: 1,
    right: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#16a34a",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 900,
    border: "1px solid #ffffff",
  },
  calAcquiredPastMark: {
    position: "absolute",
    top: 1,
    right: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#cbd5e1",
    color: "#475569",
    fontSize: 9,
    fontWeight: 900,
    border: "1px solid #ffffff",
  },
  calOverlapDot: {
    position: "absolute",
    top: 1,
    left: 1,
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "#f59e0b",
    border: "1px solid #ffffff",
  },
  calHoldEmpty: {
    display: "block",
    height: 5,
    borderRadius: 3,
  },
  calHold: {
    display: "block",
    height: 5,
    borderRadius: 3,
    background: "#5eead4",
  },
  calHoldStart: {
    display: "block",
    height: 5,
    borderRadius: 3,
    background: "#0d9488",
  },
  legendSwatchPlain: {
    position: "relative",
    display: "inline-flex",
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "#eef2ff",
  },
  legendStrip: {
    display: "inline-block",
    width: 22,
    height: 6,
    borderRadius: 3,
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
    maxWidth: 150,
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
  cellEditTrigger: {
    // border はロングハンドで指定する。active 時に borderStyle/borderColor を
    // 上書きしてもショートハンドと混在せず、再レンダー時の style 警告を避ける。
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "100%",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(79,70,229,0.28)",
    background: "transparent",
    borderRadius: 6,
    padding: "2px 6px",
    margin: "-2px -2px",
    font: "inherit",
    color: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  cellSelect: {
    width: "100%",
    minWidth: 88,
    borderRadius: 6,
    border: "1px solid rgba(79,70,229,0.35)",
    background: "#ffffff",
    padding: "4px 6px",
    fontSize: 12,
    color: "#0f172a",
    cursor: "pointer",
  },
  cellEditTriggerActive: {
    borderStyle: "solid",
    borderColor: "rgba(79,70,229,0.6)",
    background: "#eef2ff",
  },
  monthPopover: {
    position: "fixed",
    zIndex: 50,
    width: 220,
    background: "#ffffff",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    boxShadow: "0 8px 28px rgba(15,23,42,0.18)",
    padding: 10,
  },
  monthPopoverHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthPopoverYear: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },
  monthNavButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#ffffff",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
  },
  monthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 6,
  },
  monthCell: {
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#ffffff",
    color: "#334155",
    fontSize: 12,
    fontWeight: 700,
    padding: "7px 0",
    cursor: "pointer",
  },
  monthCellActive: {
    borderRadius: 8,
    border: "1px solid rgba(79,70,229,0.5)",
    background: "#4f46e5",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 800,
    padding: "7px 0",
    cursor: "pointer",
  },
  monthClear: {
    width: "100%",
    marginTop: 8,
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    padding: "7px 0",
    cursor: "pointer",
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
  chipEfficiency: {
    ...baseChip,
    background: "#fff7ed",
    color: "#c2410c",
    fontWeight: 800,
    border: "1px solid rgba(249,115,22,0.22)",
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
  efficiencyInputGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  efficiencyInputLabel: {
    display: "grid",
    gap: 4,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },
  efficiencyInput: {
    width: "100%",
    minWidth: 0,
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#ffffff",
    padding: "7px 8px",
    color: "#0f172a",
    fontSize: 13,
  },
  efficiencyResult: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "baseline",
    gap: "2px 10px",
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 10,
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: 11,
  },
  efficiencyResultValue: {
    gridRow: "1 / span 2",
    fontSize: 20,
    color: "#c2410c",
  },
  efficiencyNote: {
    margin: "8px 0 0",
    color: "#94a3b8",
    fontSize: 10,
    lineHeight: 1.5,
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
  detailSectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  detailSectionActions: {
    display: "flex",
    gap: 6,
  },
  detailEditButton: {
    border: "1px solid rgba(79,70,229,0.25)",
    background: "#eef2ff",
    color: "#4338ca",
    borderRadius: 8,
    padding: "3px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  detailRemoveButton: {
    border: "1px solid rgba(220,38,38,0.25)",
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "3px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  editForm: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  editField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  editLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
  },
  editInput: {
    width: "100%",
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#ffffff",
    padding: "7px 9px",
    fontSize: 13,
    color: "#0f172a",
    boxSizing: "border-box",
  },
  editCheckboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  editButtonRow: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  editSave: {
    flex: 1,
    border: "1px solid rgba(79,70,229,0.30)",
    background: INDIGO,
    color: "#ffffff",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  editCancel: {
    flex: 1,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#ffffff",
    color: "#475569",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
};
