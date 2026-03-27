"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ToolClient.module.css";
import type { ArchivedMemoItem, CrossType, MemoItem, Tag } from "./types";
import { CROSS_TYPES, DEFAULT_TAGS } from "./types";
import {
  loadArchivedItems,
  loadItems,
  loadTags,
  saveArchivedItems,
  saveItems,
  saveTags,
} from "./storage";

function uid() {
  // 十分実用（uuid不要ならこれでOK）
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type SortKey = "createdAt" | "code" | "name";
type SortOrder = "asc" | "desc";
type SortState = { key: SortKey; order: SortOrder };
const SORT_KEY = "yutai_memo_sort_v1";
const LAST_SEEN_MONTH_KEY = "yutai_memo_last_seen_month_v1";

type Draft = {
  id?: string;
  createdAt?: string;
  name: string;
  code: string;
  months: number[];
  tagIds: string[];
  crossType: CrossType;
  entryTiming: string;
  relatedUrl: string;
  tenureRule: string;
  acquired: boolean;
  oneShareStartedAt: string;
  priority: 1 | 2 | 3;
  memo: string;
};

type BulkArchiveDraft = {
  memoId: string;
  targetYM: string;
};

type DeleteTarget = {
  id: string;
  name: string;
};

type TickerMasterItem = {
  as_of_date: string;
  code: string;
  name: string;
  market: string;
  sector: string | null;
};

const emptyDraft = (): Draft => ({
  name: "",
  code: "",
  months: [],
  tagIds: [],
  crossType: "長期優遇なし",
  entryTiming: "",
  relatedUrl: "",
  tenureRule: "",
  acquired: false,
  oneShareStartedAt: "",
  priority: 2,
  memo: "",
});

function loadSortState(): SortState {
  if (typeof window === "undefined") return { key: "createdAt", order: "desc" };
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (!raw) return { key: "createdAt", order: "desc" };
    const parsed = JSON.parse(raw) as Partial<SortState>;
    const key: SortKey =
      parsed.key === "code" || parsed.key === "name" || parsed.key === "createdAt"
        ? parsed.key
        : "createdAt";
    const order: SortOrder = parsed.order === "asc" ? "asc" : "desc";
    return { key, order };
  } catch {
    return { key: "createdAt", order: "desc" };
  }
}

function saveSortState(state: SortState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SORT_KEY, JSON.stringify(state));
}

function formatArchiveDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString("ja-JP");
}

function toJstYearMonth(d: Date): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  return { year, month };
}

function toMonthKeyFromDate(d: Date): string {
  const ym = toJstYearMonth(d);
  return `${ym.year}-${`${ym.month}`.padStart(2, "0")}`;
}

function toMonthKeyFromIso(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return toMonthKeyFromDate(new Date(t));
}

function getArchiveGroupKey(a: ArchivedMemoItem): string | null {
  if (a.entitlementMonthKey && /^\d{4}-\d{2}$/.test(a.entitlementMonthKey)) {
    return a.entitlementMonthKey;
  }
  return toMonthKeyFromIso(a.acquiredAt);
}

function resolveEntitlementMonthKey(months: number[], acquiredAt: string): string | null {
  if (!Array.isArray(months) || months.length === 0) return toMonthKeyFromIso(acquiredAt);
  const t = Date.parse(acquiredAt);
  if (Number.isNaN(t)) return null;
  const ym = toJstYearMonth(new Date(t));
  const currentYear = ym.year;
  const currentMonth = ym.month;
  const normalized = Array.from(
    new Set(
      months.filter(
        (m) => Number.isInteger(m) && m >= 1 && m <= 12
      )
    )
  ).sort((a, b) => a - b);

  if (normalized.length === 0) return toMonthKeyFromIso(acquiredAt);

  const candidate = [...normalized].reverse().find((m) => m <= currentMonth);
  const targetMonth = candidate ?? normalized[normalized.length - 1];
  const targetYear = targetMonth <= currentMonth ? currentYear : currentYear - 1;
  return `${targetYear}-${`${targetMonth}`.padStart(2, "0")}`;
}

function hasOneSharePosition(item: Pick<MemoItem, "oneShareStartedAt" | "oneShareHold">): boolean {
  return Boolean(item.oneShareStartedAt?.trim() || item.oneShareHold);
}

function formatOneShareStartedLabel(value?: string): string {
  const v = value?.trim();
  if (!v || v === "開始時期未設定") return "未設定";
  const m = v.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return v;
  if (m[3]) return `${m[1]}/${m[2]}/${m[3]}`;
  return `${m[1]}/${m[2]}`;
}

function getNextCrossType(current?: CrossType): CrossType {
  const index = CROSS_TYPES.indexOf(current ?? "長期優遇なし");
  if (index < 0) return "長期優遇なし";
  return CROSS_TYPES[(index + 1) % CROSS_TYPES.length];
}

function isCurrentEntitlementMonth(month: number): boolean {
  return toJstYearMonth(new Date()).month === month;
}

function normalizeTickerSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
    .replace(/\s+/g, "");
}

function toOpenableUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:)?\/\//i.test(trimmed) || /^[a-z]+:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeDisplayText(value: string): string {
  return value.normalize("NFKC");
}

const SORT_KEY_LABELS: Record<SortKey, string> = {
  createdAt: "作成日",
  code: "銘柄コード",
  name: "銘柄名",
};

const CROSS_TYPE_DESCRIPTIONS: Record<CrossType, string> = {
  長期優遇なし:
    "長期条件を特に気にせず、その都度判断する通常運用です。",
  単発クロス:
    "その期だけ狙う前提のクロスです。長期条件は基本的に追いません。",
  連続クロス:
    "優待を取りながら、割り増しや長期条件につながる継続保有も意識する運用です。",
  先行クロス:
    "制度変更や長期条件に備えて、来期以降を見据えて先に仕込む運用です。",
  "1株放置":
    "1株だけ持ち続けて保有年数を積み、将来の長期優待条件を満たすことを狙います。",
};

export default function ToolClient() {
  const [items, setItems] = useState<MemoItem[]>(() => loadItems());
  const [archives, setArchives] = useState<ArchivedMemoItem[]>(() =>
    loadArchivedItems()
  );

  const [tags, setTags] = useState<Tag[]>(() => {
    const t = loadTags();
    return t.length ? t : DEFAULT_TAGS;
  });

  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<number | "all">(
    () => toJstYearMonth(new Date()).month
  );
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [sortState, setSortState] = useState<SortState>(() => loadSortState());
  const [sortControlsOpen, setSortControlsOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [crossTypePopoverId, setCrossTypePopoverId] = useState<string | null>(null);
  const [crossTypePopoverPos, setCrossTypePopoverPos] = useState<{ top: number; right: number } | null>(null);

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [listScrollY, setListScrollY] = useState<number | null>(null);

  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagDrafts, setTagDrafts] = useState<Tag[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openArchiveMonths, setOpenArchiveMonths] = useState<Set<string>>(
    new Set()
  );
  const [bulkArchiveDrafts, setBulkArchiveDrafts] = useState<BulkArchiveDraft[]>([]);
  const [bulkArchivePromptOpen, setBulkArchivePromptOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingDeletedTagIds, setPendingDeletedTagIds] = useState<Set<string>>(
    new Set()
  );
  const [strategyHelpOpen, setStrategyHelpOpen] = useState(false);
  const [tickerMaster, setTickerMaster] = useState<TickerMasterItem[]>([]);
  const [tickerMasterError, setTickerMasterError] = useState<string | null>(null);

  // load
  useEffect(() => {
    let active = true;
    async function loadTickerMaster() {
      try {
        const res = await fetch("/data/jpx_listed_companies.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TickerMasterItem[];
        if (!active) return;
        setTickerMaster(
          data.filter((item) => item.market !== "ETF・ETN")
        );
      } catch {
        if (!active) return;
        setTickerMasterError("銘柄マスタを読み込めませんでした。手入力は引き続き可能です。");
      }
    }
    void loadTickerMaster();
    return () => {
      active = false;
    };
  }, []);

  // persist
  useEffect(() => {
    saveItems(items);
  }, [items]);

  useEffect(() => {
    saveArchivedItems(archives);
  }, [archives]);

  useEffect(() => {
    saveTags(tags);
  }, [tags]);
  useEffect(() => {
    saveSortState(sortState);
  }, [sortState]);

  useEffect(() => {
    if (mode !== "list" || listScrollY === null || typeof window === "undefined") {
      return;
    }
    let frame1 = 0;
    let frame2 = 0;
    frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => {
        window.scrollTo({ top: listScrollY, behavior: "auto" });
        setListScrollY(null);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
    };
  }, [mode, listScrollY]);

  const tagNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tags) m.set(t.id, t.name);
    return m;
  }, [tags]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
    const toMs = (iso: string) => {
      const t = Date.parse(iso);
      return Number.isNaN(t) ? 0 : t;
    };
    const compare = (a: MemoItem, b: MemoItem) => {
      let base = 0;
      if (sortState.key === "createdAt") {
        base = toMs(a.createdAt) - toMs(b.createdAt);
      } else if (sortState.key === "code") {
        base = collator.compare(a.code ?? "", b.code ?? "");
      } else {
        base = collator.compare(a.name, b.name);
      }

      if (base !== 0) return sortState.order === "asc" ? base : -base;

      const byCreatedDesc = toMs(b.createdAt) - toMs(a.createdAt);
      if (byCreatedDesc !== 0) return byCreatedDesc;
      return collator.compare(a.id, b.id);
    };

    return items
      .filter((it) => {
        if (monthFilter !== "all" && !it.months.includes(monthFilter))
          return false;
        if (tagFilter !== "all" && !it.tagIds.includes(tagFilter)) return false;

        if (!qq) return true;
        const hay = [
          it.name,
          it.code ?? "",
          it.memo ?? "",
          it.crossType ?? "",
          it.entryTiming ?? "",
          it.relatedUrl ?? "",
          it.tenureRule ?? "",
          it.oneShareStartedAt ?? "",
          it.months.join(","),
          (it.tagIds ?? []).map((id) => tagNameById.get(id) ?? id).join(","),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(qq);
      })
      .slice()
      .sort(compare);
  }, [items, q, monthFilter, tagFilter, tagNameById, sortState]);

  function openNew(seed?: Partial<Draft>) {
    if (typeof window !== "undefined") {
      setListScrollY(window.scrollY);
    }
    setStrategyHelpOpen(false);
    setDraft({ ...emptyDraft(), ...seed });
    setMode("edit");
  }

  function openTagManager() {
    setTagDrafts(tags.map((t) => ({ ...t })));
    setNewTagName("");
    setPendingDeletedTagIds(new Set());
    setTagManagerOpen(true);
  }

  function closeTagManager() {
    setTagDrafts([]);
    setNewTagName("");
    setPendingDeletedTagIds(new Set());
    setTagManagerOpen(false);
  }

  function shouldOpenEditFromCard(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return true;
    return !target.closest("button, a, input, label");
  }

  function openEdit(it: MemoItem) {
    if (typeof window !== "undefined") {
      setListScrollY(window.scrollY);
    }
    setStrategyHelpOpen(false);
    setDraft({
      id: it.id,
      createdAt: it.createdAt,
      name: it.name,
      code: it.code ?? "",
      months: it.months,
      tagIds: it.tagIds ?? [],
      crossType: it.crossType ?? "長期優遇なし",
      entryTiming: it.entryTiming ?? "",
      relatedUrl: it.relatedUrl ?? "",
      tenureRule: it.tenureRule ?? "",
      acquired: it.acquired,
      oneShareStartedAt: it.oneShareStartedAt ?? "",
      priority: it.priority,
      memo: it.memo,
    });
    setMode("edit");
  }

  function toggleMonth(m: number) {
    setDraft((d) => {
      const has = d.months.includes(m);
      if (!has && d.months.length >= 4) {
        setNoticeMessage("権利月は最大4つまで選択できます。");
        return d;
      }
      const months = has ? d.months.filter((x) => x !== m) : [...d.months, m];
      months.sort((a, b) => a - b);
      return { ...d, months };
    });
  }

  function toggleTag(id: string) {
    setDraft((d) => {
      const has = d.tagIds.includes(id);
      const tagIds = has ? d.tagIds.filter((x) => x !== id) : [...d.tagIds, id];
      return { ...d, tagIds };
    });
  }

  function validate(d: Draft): string | null {
    if (!d.name.trim()) return "銘柄名は必須です";
    if (d.months.length === 0) return "権利月は1つ以上選んでください";
    if (d.months.length > 4) return "権利月は最大4つまで選択できます";
    if (!CROSS_TYPES.includes(d.crossType)) return "戦略タイプを選択してください";
    return null;
  }

  function save() {
    const err = validate(draft);
    if (err) {
      alert(err);
      return;
    }
    const now = new Date().toISOString();
    setItems((prev) => {
      const base: MemoItem = {
        id: draft.id ?? uid(),
        name: draft.name.trim(),
        code: draft.code.trim() || undefined,
        createdAt: draft.createdAt ?? now,
        months: draft.months,
        tagIds: draft.tagIds,
        crossType: draft.crossType,
        entryTiming: draft.entryTiming.trim() || undefined,
        relatedUrl: draft.relatedUrl.trim() || undefined,
        tenureRule: draft.tenureRule.trim() || undefined,
        acquired: draft.acquired,
        oneShareStartedAt: draft.oneShareStartedAt.trim() || undefined,
        priority: draft.priority,
        memo: draft.memo.trim(),
        updatedAt: now,
      };

      if (!draft.id) return [base, ...prev];
      return prev.map((x) => (x.id === draft.id ? base : x));
    });
    setStrategyHelpOpen(false);
    setMode("list");
  }

  function deleteMemo(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function openDeleteDialog(item: MemoItem) {
    setDeleteTarget({ id: item.id, name: item.name });
  }

  function confirmDeleteTarget() {
    if (!deleteTarget) return;
    deleteMemo(deleteTarget.id);
    setDeleteTarget(null);
    setMode("list");
  }

  function addTag() {
    const name = newTagName.trim();
    if (!name) return;
    const id = uid();
    setTagDrafts((prev) => [{ id, name, createdAt: Date.now() }, ...prev]);
    setNewTagName("");
  }

  function updateTagDraftName(id: string, name: string) {
    setTagDrafts((prev) =>
      prev.map((tag) => (tag.id === id ? { ...tag, name } : tag))
    );
  }

  function saveTagDrafts() {
    const nextTags = tagDrafts
      .filter((tag) => !pendingDeletedTagIds.has(tag.id))
      .map((tag) => ({ ...tag, name: tag.name.trim() }));
    if (nextTags.some((tag) => !tag.name)) {
        setNoticeMessage("空のタグ名は保存できません。");
        return;
    }
    const nextIds = new Set(nextTags.map((tag) => tag.id));
    const removedIds = tags
      .filter((tag) => !nextIds.has(tag.id))
      .map((tag) => tag.id);

    setTags(nextTags);
    if (removedIds.length > 0) {
      setItems((prev) =>
        prev.map((memo) => ({
          ...memo,
          tagIds: memo.tagIds.filter((id) => !removedIds.includes(id)),
        }))
      );
      setDraft((prev) => ({
        ...prev,
        tagIds: prev.tagIds.filter((id) => !removedIds.includes(id)),
      }));
      setTagFilter((prev) =>
        prev !== "all" && removedIds.includes(prev) ? "all" : prev
      );
    }
    closeTagManager();
  }

  function toggleTagPendingDelete(id: string) {
    setPendingDeletedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filtered.map((it) => it.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function bulkRemoveSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択中の ${selectedIds.size} 件を削除しますか？`)) return;
    setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
    clearSelection();
  }

  function bulkSetAcquired(acquired: boolean) {
    if (selectedIds.size === 0) return;
    setItems((prev) =>
      prev.map((it) => (selectedIds.has(it.id) ? { ...it, acquired } : it))
    );
    clearSelection();
  }

  function toggleAcquired(id: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, acquired: !it.acquired } : it
      )
    );
  }

  function toggleOneSharePosition(id: string) {
    const startedAt = toMonthKeyFromDate(new Date());
    const updatedAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? hasOneSharePosition(it)
            ? {
                ...it,
                oneShareStartedAt: undefined,
                oneShareHold: false,
                updatedAt,
              }
            : {
                ...it,
                oneShareStartedAt: startedAt,
                oneShareHold: false,
                updatedAt,
              }
          : it
      )
    );
  }

  function setCrossTypeForItem(id: string, crossType: CrossType) {
    const updatedAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, crossType, updatedAt } : it))
    );
    setCrossTypePopoverId(null);
    setCrossTypePopoverPos(null);
  }

  function openCrossTypePopover(id: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (crossTypePopoverId === id) {
      setCrossTypePopoverId(null);
      setCrossTypePopoverPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setCrossTypePopoverPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
    setCrossTypePopoverId(id);
  }

  function createArchiveRecord(
    target: MemoItem,
    acquiredAt: string,
    entitlementMonthKey?: string
  ): ArchivedMemoItem {
    return {
      id: uid(),
      memoId: target.id,
      code: target.code,
      name: target.name,
      acquiredAt,
      entitlementMonthKey:
        entitlementMonthKey ??
        resolveEntitlementMonthKey(target.months, acquiredAt) ??
        undefined,
      note: target.memo?.trim() || undefined,
    };
  }

  function archiveTargets(
    targets: MemoItem[],
    acquiredAt: string,
    entitlementByMemoId?: Map<string, string>
  ) {
    if (targets.length === 0) return { archivedCount: 0, skippedCount: 0 };
    const existing = new Set(
      archives
        .map((a) => {
          const key = getArchiveGroupKey(a);
          return key ? `${a.memoId}::${key}` : null;
        })
        .filter((v): v is string => Boolean(v))
    );

    const archiveRecords: ArchivedMemoItem[] = [];
    const archivedIds = new Set<string>();
    let skippedCount = 0;

    for (const t of targets) {
      const resolvedYm =
        entitlementByMemoId?.get(t.id) ??
        resolveEntitlementMonthKey(t.months, acquiredAt);
      if (!resolvedYm) {
        skippedCount += 1;
        continue;
      }
      const dedupKey = `${t.id}::${resolvedYm}`;
      if (existing.has(dedupKey)) {
        skippedCount += 1;
        continue;
      }
      archiveRecords.push(createArchiveRecord(t, acquiredAt, resolvedYm));
      archivedIds.add(t.id);
      existing.add(dedupKey);
    }

    if (archiveRecords.length === 0) {
      return { archivedCount: 0, skippedCount };
    }

    setArchives((prev) => [...archiveRecords, ...prev]);
    setItems((prev) =>
      prev.map((it) =>
        archivedIds.has(it.id)
          ? { ...it, acquired: false, updatedAt: acquiredAt }
          : it
      )
    );
    return { archivedCount: archiveRecords.length, skippedCount };
  }

  function archiveMemo(id: string) {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    const now = new Date().toISOString();
    const targetYm = resolveEntitlementMonthKey(target.months, now);
    if (
      targetYm &&
      archives.some(
        (a) => a.memoId === target.id && getArchiveGroupKey(a) === targetYm
      )
    ) {
      setNoticeMessage("同じ取得年月で既にアーカイブ済みです。重複登録はしません。");
      return;
    }
    if (!confirm("取得リストに追加し、メモを未取得に戻します。よろしいですか？")) {
      return;
    }
    const result = archiveTargets(
      [target],
      now,
      targetYm ? new Map([[target.id, targetYm]]) : undefined
    );
    if (result.archivedCount > 0) {
      alert("アーカイブしました（取得リストに追加・未取得へ戻しました）。");
    }
  }

  function runBulkArchiveWithDrafts(drafts: BulkArchiveDraft[]) {
    if (drafts.length === 0) return;
    const idSet = new Set(drafts.map((d) => d.memoId));
    const targetYmMap = new Map(drafts.map((d) => [d.memoId, d.targetYM]));
    const targets = items.filter((it) => idSet.has(it.id) && it.acquired);
    if (targets.length === 0) return;
    const now = new Date().toISOString();
    const result = archiveTargets(targets, now, targetYmMap);
    if (result.archivedCount === 0) {
      setNoticeMessage("対象はすべて重複のため、アーカイブされませんでした。");
      return;
    }
    if (result.skippedCount > 0) {
      setNoticeMessage(
        `${result.archivedCount}件を一括アーカイブしました（重複 ${result.skippedCount} 件はスキップ）。`
      );
      return;
    }
    alert(`${result.archivedCount}件を一括アーカイブしました。`);
  }

  function handleBulkArchiveExecute() {
    if (bulkArchiveDrafts.length === 0) {
      setBulkArchivePromptOpen(false);
      return;
    }
    if (!confirm(`取得済み ${bulkArchiveDrafts.length} 件を一括アーカイブします。よろしいですか？`)) {
      return;
    }
    runBulkArchiveWithDrafts(bulkArchiveDrafts);
    setBulkArchivePromptOpen(false);
    setBulkArchiveDrafts([]);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const currentMonth = toMonthKeyFromDate(now);
    const lastSeen = localStorage.getItem(LAST_SEEN_MONTH_KEY);

    if (!lastSeen) {
      localStorage.setItem(LAST_SEEN_MONTH_KEY, currentMonth);
      return;
    }
    if (lastSeen === currentMonth) return;

    const nowIso = now.toISOString();
    const candidates = items.filter((it) => {
      if (!it.acquired) return false;
      const monthKey = resolveEntitlementMonthKey(it.months, nowIso);
      if (!monthKey) return false;
      return !archives.some(
        (a) => a.memoId === it.id && getArchiveGroupKey(a) === monthKey
      );
    });
    const nextDrafts: BulkArchiveDraft[] = candidates.map((it) => ({
      memoId: it.id,
      targetYM: resolveEntitlementMonthKey(it.months, nowIso) ?? toMonthKeyFromDate(now),
    }));
    const acquiredCount = items.filter((it) => it.acquired).length;
    const timer = window.setTimeout(() => {
      setBulkArchiveDrafts(nextDrafts);
      setBulkArchivePromptOpen(nextDrafts.length > 0);
      if (nextDrafts.length === 0 && acquiredCount > 0) {
        setNoticeMessage(
          "今月分の取得候補は既に登録済みです。重複防止のため一括アーカイブ提案は表示しません。"
        );
      }
    }, 0);
    localStorage.setItem(LAST_SEEN_MONTH_KEY, currentMonth);
    return () => window.clearTimeout(timer);
  // items / archives の更新後に同月で再表示しないため、lastSeen でガードする。
  }, [items, archives]);

  function removeArchive(id: string) {
    if (!confirm("この履歴を削除しますか？")) return;
    setArchives((prev) => prev.filter((a) => a.id !== id));
  }

  const selectedCount = selectedIds.size;
  const archiveGroups = useMemo(() => {
    const byMonth = new Map<string, ArchivedMemoItem[]>();
    const unknown: ArchivedMemoItem[] = [];
    const toMs = (iso: string) => {
      const t = Date.parse(iso);
      return Number.isNaN(t) ? 0 : t;
    };
    const sortByDateDesc = (a: ArchivedMemoItem, b: ArchivedMemoItem) => {
      const diff = toMs(b.acquiredAt) - toMs(a.acquiredAt);
      if (diff !== 0) return diff;
      return b.id.localeCompare(a.id);
    };

    for (const a of archives) {
      const key = getArchiveGroupKey(a);
      if (!key) {
        unknown.push(a);
        continue;
      }
      const list = byMonth.get(key);
      if (list) list.push(a);
      else byMonth.set(key, [a]);
    }

    const groups = Array.from(byMonth.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, list]) => ({
        key: month,
        label: month,
        items: list.slice().sort(sortByDateDesc),
      }));

    if (unknown.length > 0) {
      groups.push({
        key: "unknown",
        label: "不明",
        items: unknown.slice().sort(sortByDateDesc),
      });
    }

    return groups;
  }, [archives]);

  function toggleArchiveMonth(month: string) {
    setOpenArchiveMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  const tickerSearchResult = useMemo(() => {
    const query = normalizeTickerSearch(q);
    if (!query) return { items: [] as TickerMasterItem[], total: 0 };
    const isCodeSearch = /^[0-9a-z]+$/i.test(query);
    const minLength = isCodeSearch ? 3 : 2;
    if (query.length < minLength) return { items: [] as TickerMasterItem[], total: 0 };

    const scored = tickerMaster
      .map((item) => {
        const normalizedCode = normalizeTickerSearch(item.code);
        const normalizedName = normalizeTickerSearch(item.name);
        let score = -1;
        if (normalizedCode === query) score = 0;
        else if (normalizedCode.startsWith(query)) score = 1;
        else if (normalizedName.startsWith(query)) score = 2;
        else if (normalizedName.includes(query)) score = 3;
        if (score < 0) return null;
        return { item, score };
      })
      .filter((v): v is { item: TickerMasterItem; score: number } => Boolean(v))
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.item.code.localeCompare(b.item.code, "ja", { numeric: true });
      });

    return {
      items: scored.slice(0, 10).map((v) => v.item),
      total: scored.length,
    };
  }, [q, tickerMaster]);
  const tickerCandidates = tickerSearchResult.items;
  const tickerCandidateTotal = tickerSearchResult.total;
  const normalizedTickerQuery = normalizeTickerSearch(q);
  const tickerQueryIsCodeLike = /^[0-9a-z]+$/i.test(normalizedTickerQuery);
  const tickerQueryHasText = normalizedTickerQuery.length > 0;
  const tickerQueryNeedsMoreChars =
    tickerQueryHasText &&
    ((tickerQueryIsCodeLike && normalizedTickerQuery.length < 4) ||
      (!tickerQueryIsCodeLike && normalizedTickerQuery.length < 2));
  const tickerQueryIsFourCharCode =
    tickerQueryIsCodeLike && normalizedTickerQuery.length === 4;
  const exactTickerCandidate =
    tickerCandidates.find(
      (item) => normalizeTickerSearch(item.code) === normalizedTickerQuery
    ) ?? null;
  const preferredTickerCandidate =
    exactTickerCandidate ?? (tickerCandidates.length === 1 ? tickerCandidates[0] : null);

  function openNewFromSearch(item?: TickerMasterItem) {
    const selected = item ?? preferredTickerCandidate;
    if (selected) {
      openNew({
        name: selected.name,
        code: selected.code,
      });
      setQ("");
      return;
    }
    const raw = q.trim();
    if (!raw) {
      openNew();
      return;
    }
    const normalized = normalizeTickerSearch(raw);
    openNew({
      code: /^[0-9a-z]+$/i.test(normalized) ? raw : "",
      name: /^[0-9a-z]+$/i.test(normalized) ? "" : raw,
    });
    setQ("");
  }

  const showTickerAssist = mode === "list" && q.trim().length > 0 && filtered.length === 0;
  const showTickerSearchHint =
    mode === "list" && filtered.length === 0 && tickerQueryNeedsMoreChars;

  function selectTickerCandidate(item: TickerMasterItem) {
    openNewFromSearch(item);
  }

  const tickerAssistMessage = tickerMasterError
    ? tickerMasterError
    : tickerCandidateTotal > tickerCandidates.length
      ? `候補が ${tickerCandidateTotal} 件あります。上位 ${tickerCandidates.length} 件を表示しています。もう少し絞り込むと選びやすくなります。`
    : tickerQueryIsFourCharCode && tickerCandidates.length === 0
      ? "銘柄マスタに候補がありません。コードだけで追加するか、入力内容を見直してください。"
      : preferredTickerCandidate
        ? "銘柄マスタに候補が見つかりました。追加すると銘柄名も自動で入ります。"
        : "該当するメモがありません。候補から追加できます。";

  const tickerAssistActionLabel = preferredTickerCandidate
    ? `${preferredTickerCandidate.code} ${preferredTickerCandidate.name} を追加`
    : tickerQueryIsFourCharCode && q.trim()
      ? `コード ${q.trim()} で追加`
      : "この条件で追加";

  const tickerSearchHintMessage = tickerQueryIsCodeLike
    ? "コード検索は4文字以上で候補を表示します。"
    : "銘柄名検索は2文字以上で候補を表示します。";

  return (
    <div className={styles.wrap}>
      {mode === "list" ? (
        <>
          <div className={styles.pageHeader}>
            <div className={styles.h1}>優待銘柄メモ帳</div>
            <div className={styles.headerActions}>
              <button className={styles.btnPrimary} onClick={() => openNew()}>
                + 追加
              </button>
              <button
                className={styles.btn}
                type="button"
                onClick={openTagManager}
              >
                タグ管理
              </button>
            </div>
          </div>
          <div className={styles.pageSub}>
            株主優待の銘柄メモや長期条件をスマホやPCに残せます。
          </div>

          <div className={styles.searchGroup}>
            <div className={styles.searchInputWrap}>
              <input
                className={`${styles.input} ${styles.searchInput}`}
                placeholder="検索（銘柄/コード/メモ/任期/リンク）"
                value={q}
                onChange={(e) => {
                  clearSelection();
                  setQ(e.target.value);
                }}
              />
              {q.length > 0 && (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={() => { setQ(""); clearSelection(); }}
                  aria-label="検索をクリア"
                >
                  ×
                </button>
              )}
            </div>
            <select
              className={styles.select}
              value={monthFilter}
              onChange={(e) => {
                clearSelection();
                const v = e.target.value;
                setMonthFilter(v === "all" ? "all" : Number(v));
              }}
            >
              <option value="all">権利月: すべて</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              value={tagFilter}
              onChange={(e) => {
                clearSelection();
                setTagFilter(e.target.value as any);
              }}
            >
              <option value="all">タグ: すべて</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {showTickerSearchHint ? (
            <div className={styles.small}>{tickerSearchHintMessage}</div>
          ) : null}

          {showTickerAssist ? (
            <div className={styles.tickerAssistPanel}>
              <div className={styles.small}>{tickerAssistMessage}</div>
              {tickerCandidates.length > 0 ? (
                <div className={styles.tickerCandidateList}>
                  {tickerCandidates.map((item) => (
                    <button
                      key={`${item.code}-${item.name}`}
                      type="button"
                      className={styles.tickerCandidate}
                      onClick={() => selectTickerCandidate(item)}
                    >
                      <span className={styles.tickerCandidateCode}>{item.code}</span>
                      <span className={styles.tickerCandidateName}>{item.name}</span>
                      <span className={styles.tickerCandidateMarket}>{item.market}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className={styles.tickerAssistActions}>
                <button
                  className={styles.btnPrimary}
                  type="button"
                  onClick={() => openNewFromSearch()}
                >
                  {tickerAssistActionLabel}
                </button>
              </div>
            </div>
          ) : null}

          <div className={styles.sortToggleRow}>
            <button
              className={styles.sortToggleBtn}
              type="button"
              onClick={() => setSortControlsOpen((prev) => !prev)}
            >
              表示順: {SORT_KEY_LABELS[sortState.key]}
              <span className={styles.sortToggleChevron} aria-hidden="true">
                {sortControlsOpen ? "▲" : "▼"}
              </span>
            </button>
          </div>

          {sortControlsOpen ? (
            <div className={styles.sortGroup}>
              <select
                className={styles.select}
                value={sortState.key}
                onChange={(e) =>
                  setSortState((s) => ({ ...s, key: e.target.value as SortKey }))
                }
              >
                <option value="createdAt">並び替え: 作成日</option>
                <option value="code">並び替え: 銘柄コード</option>
                <option value="name">並び替え: 銘柄名</option>
              </select>
              <select
                className={styles.select}
                value={sortState.order}
                onChange={(e) =>
                  setSortState((s) => ({
                    ...s,
                    order: e.target.value as SortOrder,
                  }))
                }
              >
                <option value="desc">順序: 降順</option>
                <option value="asc">順序: 昇順</option>
              </select>
            </div>
          ) : null}

          <div className={styles.bulkBarSection}>
            <div className={styles.bulkBarHeader}>
              {selectedCount > 0 && (
                <span className={styles.bulkBarCount}>{selectedCount}件選択中</span>
              )}
              <button
                className={styles.bulkBarToggle}
                type="button"
                onClick={() => setBulkActionsOpen((prev) => !prev)}
              >
                一括操作
                <span className={styles.bulkBarChevron} aria-hidden="true">
                  {bulkActionsOpen ? "▲" : "▼"}
                </span>
              </button>
            </div>

            {bulkActionsOpen && (
              <div className={styles.bulkBar}>
                <button
                  className={`${styles.btn} ${styles.bulkBarButton}`}
                  type="button"
                  onClick={selectAllVisible}
                >
                  全選択
                </button>
                <button
                  className={`${styles.btn} ${styles.bulkBarButton}`}
                  type="button"
                  onClick={clearSelection}
                >
                  全解除
                </button>
                <button
                  className={`${styles.btn} ${styles.bulkBarButton}`}
                  type="button"
                  onClick={() => bulkSetAcquired(true)}
                  disabled={selectedCount === 0}
                >
                  取得済みにする
                </button>
                <button
                  className={`${styles.btn} ${styles.bulkBarButton}`}
                  type="button"
                  onClick={() => bulkSetAcquired(false)}
                  disabled={selectedCount === 0}
                >
                  未取得に戻す
                </button>
                <button
                  className={`${styles.btn} ${styles.bulkBarButton}`}
                  type="button"
                  onClick={bulkRemoveSelected}
                  disabled={selectedCount === 0}
                >
                  削除
                </button>
              </div>
            )}
          </div>

          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.card}>
                <div className={styles.small}>
                  {items.length === 0
                    ? "まだメモがありません。右上の「追加」から作れます。"
                    : "フィルター条件に合うメモがありません。"}
                </div>
              </div>
            ) : (
                filtered.map((it) => (
                  <div key={it.id} className={styles.cardRow}>
                  <label className={styles.selectBox}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(it.id)}
                      onChange={() => toggleSelect(it.id)}
                    />
                  </label>
                  <div
                    className={styles.card}
                    onClick={(e) => {
                      if (!shouldOpenEditFromCard(e.target)) return;
                      openEdit(it);
                    }}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderTop}>
                        <div
                          className={styles.cardMain}
                          role="button"
                          tabIndex={0}
                          onClick={() => openEdit(it)}
                          onKeyDown={(e) => {
                            if (e.currentTarget !== e.target) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openEdit(it);
                            }
                          }}
                        >
                          <div className={styles.cardTitleText}>
                            <span className={styles.cardName}>
                              {normalizeDisplayText(it.name)}
                            </span>
                            {it.code ? (
                              <span className={styles.cardCode}>
                                ({normalizeDisplayText(it.code)})
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className={styles.monthPriorityRow}>
                          {it.months.slice(0, 4).map((month) => (
                            <span
                              key={`${it.id}-${month}`}
                              className={`${styles.monthPriorityBadge} ${
                                isCurrentEntitlementMonth(month)
                                  ? styles.monthPriorityBadgeCurrent
                                  : ""
                              }`}
                            >
                              {month}月
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={styles.cardSide}>
                        <div className={styles.statusRow}>
                          <button
                            type="button"
                            className={`${styles.stateToggle} ${
                              it.acquired ? styles.stateOn : ""
                            }`}
                            onClick={() => toggleAcquired(it.id)}
                          >
                            {it.acquired ? "取得済み" : "未取得"}
                          </button>
                          <button
                            type="button"
                            className={styles.archiveBtn}
                            onClick={() => archiveMemo(it.id)}
                            disabled={!it.acquired}
                            title={it.acquired ? "取得履歴へ移動" : "取得済みのメモのみ対応"}
                          >
                            アーカイブ
                          </button>
                          <button
                            type="button"
                            className={styles.listDeleteBtn}
                            onClick={() => openDeleteDialog(it)}
                          >
                            削除
                          </button>
                        </div>

                        <div className={styles.statusRow}>
                          <button
                            type="button"
                            className={styles.strategyBadge}
                            onClick={(e) => openCrossTypePopover(it.id, e)}
                          >
                            {it.crossType ?? "長期優遇なし"}
                          </button>
                          <button
                            type="button"
                            className={`${styles.oneShareToggle} ${
                              hasOneSharePosition(it) ? styles.oneShareToggleOn : ""
                            }`}
                            onClick={() => toggleOneSharePosition(it.id)}
                          >
                            1株保有:{" "}
                            {hasOneSharePosition(it)
                              ? formatOneShareStartedLabel(it.oneShareStartedAt)
                              : "未設定"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.meta}>
                      {it.tagIds.map((id) => (
                        <span key={id} className={styles.chip}>
                          {tagNameById.get(id) ?? "（不明タグ）"}
                        </span>
                      ))}
                    </div>

                    <div className={styles.small} style={{ marginTop: 6 }}>
                      {it.tenureRule ? `任期: ${it.tenureRule}` : ""}
                    </div>

                    {it.relatedUrl ? (
                      <div className={styles.small} style={{ marginTop: 6 }}>
                        <a
                          href={toOpenableUrl(it.relatedUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.memoLink}
                        >
                          関連リンクを開く
                        </a>
                      </div>
                    ) : null}

                    <div className={styles.small} style={{ marginTop: 6 }}>
                      {it.memo
                        ? it.memo.slice(0, 60) + (it.memo.length > 60 ? "…" : "")
                        : "（メモなし）"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.archivePanel}>
            <div className={styles.archiveTitle}>
              取得リスト（履歴）
              <span className={styles.small} style={{ marginLeft: 8 }}>
                {archives.length}件
              </span>
            </div>
            {archives.length === 0 ? (
              <div className={styles.small}>まだ履歴はありません。</div>
            ) : (
              <div className={styles.archiveList}>
                {archiveGroups.map((g) => {
                  const isOpen = openArchiveMonths.has(g.key);
                  return (
                    <div key={g.key} className={styles.archiveGroup}>
                      <button
                        type="button"
                        className={styles.archiveGroupHeader}
                        onClick={() => toggleArchiveMonth(g.key)}
                      >
                        <span style={{ fontWeight: 700 }}>
                          {g.label} ({g.items.length}件)
                        </span>
                        <span
                          className={`${styles.archiveChevron} ${
                            isOpen ? styles.archiveChevronOpen : ""
                          }`}
                          aria-hidden="true"
                        >
                          ▼
                        </span>
                      </button>
                      {isOpen ? (
                        <div className={styles.archiveGroupBody}>
                          {g.items.map((a) => (
                            <div key={a.id} className={styles.archiveRow}>
                              <div className={styles.archiveRowHead}>
                                <div style={{ fontWeight: 600 }}>
                                  {a.name}
                                  {a.code ? `（${a.code}）` : ""}
                                </div>
                                <button
                                  type="button"
                                  className={styles.archiveDeleteBtn}
                                  onClick={() => removeArchive(a.id)}
                                >
                                  削除
                                </button>
                              </div>
                              <div className={styles.small}>
                                取得日: {formatArchiveDate(a.acquiredAt)}
                              </div>
                              {a.note ? (
                                <div className={styles.small}>
                                  {a.note.slice(0, 80)}
                                  {a.note.length > 80 ? "…" : ""}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {bulkArchivePromptOpen ? (
            <div
              className={styles.overlay}
              onClick={() => setBulkArchivePromptOpen(false)}
            >
              <div
                className={styles.dialog}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.dialogTitle}>月替わりの一括アーカイブ提案</div>
                <div className={styles.dialogBody}>
                  <div className={styles.small} style={{ fontSize: 14, color: "#333" }}>
                    取得済みのメモが {bulkArchiveDrafts.length} 件あります。
                  </div>
                  <div className={styles.small} style={{ marginTop: 8 }}>
                    月替わりのため、まとめて取得リストへ移動しますか？
                  </div>
                  <div className={styles.small} style={{ marginTop: 8 }}>
                    取得年月は権利月ルールで自動判定します（手修正は一時停止中）。
                  </div>
                </div>
                <div className={`${styles.actions} ${styles.dialogFooter}`}>
                  <button
                    className={styles.btn}
                    type="button"
                    onClick={() => setBulkArchivePromptOpen(false)}
                  >
                    今回は表示しない
                  </button>
                  <button
                    className={styles.btnPrimary}
                    type="button"
                    onClick={handleBulkArchiveExecute}
                  >
                    実行
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {deleteTarget ? (
            <div className={styles.overlay} onClick={() => setDeleteTarget(null)}>
              <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.dialogTitle}>メモを削除しますか？</div>
                <div className={styles.dialogBody}>
                  <div className={styles.small} style={{ fontSize: 14, color: "#333" }}>
                    {deleteTarget.name} を削除します。
                  </div>
                  <div className={styles.small} style={{ marginTop: 8 }}>
                    この操作は元に戻せません。
                  </div>
                </div>
                <div className={`${styles.actions} ${styles.dialogFooter}`}>
                  <button
                    className={styles.btn}
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                  >
                    キャンセル
                  </button>
                  <button
                    className={styles.btnPrimary}
                    type="button"
                    onClick={confirmDeleteTarget}
                  >
                    削除する
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {crossTypePopoverId && crossTypePopoverPos && (
            <>
              <div
                className={styles.strategyPopoverBackdrop}
                onClick={() => {
                  setCrossTypePopoverId(null);
                  setCrossTypePopoverPos(null);
                }}
              />
              <div
                className={styles.strategyPopover}
                style={{ top: crossTypePopoverPos.top, right: crossTypePopoverPos.right }}
              >
                {CROSS_TYPES.map((type) => {
                  const current = items.find((it) => it.id === crossTypePopoverId)?.crossType ?? "長期優遇なし";
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`${styles.strategyPopoverItem} ${type === current ? styles.strategyPopoverItemActive : ""}`}
                      onClick={() => setCrossTypeForItem(crossTypePopoverId, type)}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tagManagerOpen ? (
            <div
              className={styles.overlay}
              onClick={closeTagManager}
            >
              <div
                className={styles.dialog}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.dialogTitle}>タグ管理</div>

                <div className={styles.dialogBody}>
                  <div className={styles.tagManagerRow}>
                    <input
                      className={`${styles.input} ${styles.tagManagerInput}`}
                      placeholder="新しいタグ名"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                    <button
                      className={`${styles.btnPrimary} ${styles.tagManagerButton}`}
                      type="button"
                      onClick={addTag}
                    >
                      追加
                    </button>
                  </div>

                  <div className={styles.tagManagerList}>
                    {tagDrafts.length === 0 ? (
                      <div className={styles.small}>タグがありません</div>
                    ) : (
                      tagDrafts.map((t) => (
                        <div
                          key={t.id}
                          className={`${styles.tagManagerRow} ${
                            pendingDeletedTagIds.has(t.id)
                              ? styles.tagManagerRowPending
                              : ""
                          }`}
                        >
                          <input
                            className={`${styles.input} ${styles.tagManagerInput}`}
                            value={t.name}
                            onChange={(e) => updateTagDraftName(t.id, e.target.value)}
                            disabled={pendingDeletedTagIds.has(t.id)}
                          />
                          <button
                            className={`${styles.btn} ${styles.tagManagerButton}`}
                            type="button"
                            onClick={() => toggleTagPendingDelete(t.id)}
                          >
                            {pendingDeletedTagIds.has(t.id) ? "取消" : "削除"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className={`${styles.actions} ${styles.dialogFooter}`}>
                  <button
                    className={styles.btn}
                    type="button"
                    onClick={closeTagManager}
                  >
                    キャンセル
                  </button>
                  <button
                    className={styles.btnPrimary}
                    type="button"
                    onClick={saveTagDrafts}
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className={styles.card}>
            <div className={styles.row}>
              <input
                className={styles.input}
                placeholder="銘柄名（必須）"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </div>

            <div className={styles.row} style={{ marginTop: 8 }}>
              <input
                className={styles.input}
                placeholder="銘柄コード（任意）"
                value={draft.code}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, code: e.target.value }))
                }
              />
            </div>

            <hr className={styles.hr} />

            <div className={styles.small} style={{ marginBottom: 6 }}>
              権利月（複数選択OK）
            </div>
            <div className={styles.months}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const on = draft.months.includes(m);
                return (
                  <button
                    key={m}
                    className={`${styles.monthBtn} ${on ? styles.monthOn : ""}`}
                    onClick={() => toggleMonth(m)}
                    type="button"
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <hr className={styles.hr} />

            <div className={styles.small} style={{ marginBottom: 6 }}>
              タグ
            </div>

            <div className={styles.chips}>
              {tags.map((t) => {
                const on = draft.tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>

            <hr className={styles.hr} />

            <div className={styles.strategyTwoCol}>
              <div>
                <div
                  className={`${styles.small} ${styles.labelWithInfo}`}
                  style={{ marginBottom: 6 }}
                >
                  戦略タイプ
                  <button
                    className={styles.infoButton}
                    type="button"
                    onClick={() => setStrategyHelpOpen((prev) => !prev)}
                    aria-expanded={strategyHelpOpen}
                    aria-label="戦略タイプの説明を表示"
                  >
                    ?
                  </button>
                </div>
                <select
                  className={styles.select}
                  value={draft.crossType}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      crossType: e.target.value as CrossType,
                    }))
                  }
                >
                  {CROSS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className={styles.small} style={{ marginBottom: 6 }}>
                  1株保有開始時期
                </div>
                <input
                  className={styles.input}
                  placeholder="YYYY-MM / 例: 2024-08"
                  value={draft.oneShareStartedAt}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, oneShareStartedAt: e.target.value }))
                  }
                />
              </div>
            </div>
            {strategyHelpOpen ? (
              <div className={styles.inlineHelpBox}>
                <div className={styles.inlineHelpTitle}>戦略タイプの意味</div>
                <ul className={styles.inlineHelpList}>
                  {CROSS_TYPES.map((type) => (
                    <li key={type}>
                      <strong>{type}</strong>
                      <span>{CROSS_TYPE_DESCRIPTIONS[type]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <hr className={styles.hr} />

            <div className={styles.row}>
              <input
                className={styles.input}
                placeholder="早打ち目安（例：権利月の2ヶ月前 / 8月中旬）"
                value={draft.entryTiming}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, entryTiming: e.target.value }))
                }
              />
            </div>

            <div className={styles.row} style={{ marginTop: 8 }}>
              <input
                className={styles.input}
                placeholder="関連リンク（例：公式優待ページ / IR）"
                value={draft.relatedUrl}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, relatedUrl: e.target.value }))
                }
              />
            </div>

            <div className={styles.row} style={{ marginTop: 8 }}>
              <input
                className={styles.input}
                placeholder="任期条件（例：1年以上 / 3月・9月連続）"
                value={draft.tenureRule}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, tenureRule: e.target.value }))
                }
              />
            </div>

            <div
              className={styles.row}
              style={{ marginTop: 10, justifyContent: "space-between" }}
            >
              <div className={styles.row}>
                <label
                  className={styles.small}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={draft.acquired}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, acquired: e.target.checked }))
                    }
                  />
                  取得済み
                </label>
              </div>
            </div>

            <div className={styles.row} style={{ marginTop: 10 }}>
              <textarea
                className={styles.input}
                placeholder="メモ（失敗ログ/早取り理由/去年の反省など）"
                value={draft.memo}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, memo: e.target.value }))
                }
                rows={5}
              />
            </div>

            <div className={styles.actions} style={{ marginTop: 12 }}>
              <button
                className={styles.btn}
                onClick={() => setMode("list")}
                type="button"
              >
                戻る
              </button>
              <button
                className={styles.btnPrimary}
                onClick={save}
                type="button"
              >
                保存
              </button>
            </div>
          </div>
        </>
      )}

      {noticeMessage ? (
        <div
          className={`${styles.overlay} ${styles.noticeOverlay}`}
          onClick={() => setNoticeMessage(null)}
        >
          <div
            className={`${styles.dialog} ${styles.noticeDialog}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogTitle}>お知らせ</div>
            <div className={styles.dialogBody}>
              <div className={styles.small} style={{ fontSize: 14, color: "#333" }}>
                {noticeMessage}
              </div>
            </div>
            <div className={`${styles.actions} ${styles.dialogFooter}`}>
              <button
                className={styles.btnPrimary}
                type="button"
                onClick={() => setNoticeMessage(null)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
