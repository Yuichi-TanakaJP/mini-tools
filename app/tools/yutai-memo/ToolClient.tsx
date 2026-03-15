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

const emptyDraft = (): Draft => ({
  name: "",
  code: "",
  months: [],
  tagIds: [],
  crossType: "長期：設定がない",
  entryTiming: "",
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
  const index = CROSS_TYPES.indexOf(current ?? "長期：設定がない");
  if (index < 0) return "長期：設定がない";
  return CROSS_TYPES[(index + 1) % CROSS_TYPES.length];
}

function isCurrentEntitlementMonth(month: number): boolean {
  return toJstYearMonth(new Date()).month === month;
}

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
  const [monthFilter, setMonthFilter] = useState<number | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [sortState, setSortState] = useState<SortState>(() => loadSortState());

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [mode, setMode] = useState<"list" | "edit">("list");

  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openArchiveMonths, setOpenArchiveMonths] = useState<Set<string>>(
    new Set()
  );
  const [bulkArchiveDrafts, setBulkArchiveDrafts] = useState<BulkArchiveDraft[]>([]);
  const [bulkArchivePromptOpen, setBulkArchivePromptOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // load

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

  function openNew() {
    setDraft(emptyDraft());
    setMode("edit");
  }

  function openEdit(it: MemoItem) {
    setDraft({
      id: it.id,
      createdAt: it.createdAt,
      name: it.name,
      code: it.code ?? "",
      months: it.months,
      tagIds: it.tagIds ?? [],
      crossType: it.crossType ?? "長期：設定がない",
      entryTiming: it.entryTiming ?? "",
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
    setTags((prev) => [{ id, name, createdAt: Date.now() }, ...prev]);
    setNewTagName("");
  }

  function renameTag(id: string, name: string) {
    const n = name.trim();
    if (!n) return;
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, name: n } : t)));
  }

  function deleteTag(id: string) {
    if (
      !confirm("このタグを削除しますか？（付与済みメモからは自動で外れます）")
    )
      return;
    setTags((prev) => prev.filter((t) => t.id !== id));
    setItems((prev) =>
      prev.map((m) => ({ ...m, tagIds: m.tagIds.filter((x) => x !== id) }))
    );
    // フィルタ中なら解除
    setTagFilter((f) => (f === id ? "all" : f));
    // 編集中のdraftからも外す
    setDraft((d) => ({ ...d, tagIds: d.tagIds.filter((x) => x !== id) }));
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

  function cycleCrossType(id: string) {
    const updatedAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              crossType: getNextCrossType(it.crossType),
              updatedAt,
            }
          : it
      )
    );
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

  return (
    <div className={styles.wrap}>
      <div className={styles.h1}>優待銘柄メモ帳</div>

      {mode === "list" ? (
        <>
          <div className={styles.row}>
            <input
              className={styles.input}
              placeholder="検索（銘柄/コード/メモ/任期/早打ち目安）"
              value={q}
              onChange={(e) => {
                clearSelection();
                setQ(e.target.value);
              }}
            />
          </div>

          <div className={styles.row} style={{ marginTop: 10 }}>
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
            <button className={styles.btnPrimary} onClick={openNew}>
              + 追加
            </button>
            <button
              className={styles.btn}
              type="button"
              onClick={() => setTagManagerOpen(true)}
            >
              タグ管理
            </button>
          </div>

          <div className={styles.bulkBar}>
            <div className={styles.small}>{selectedCount}件選択中</div>
            <button className={styles.btn} type="button" onClick={selectAllVisible}>
              全選択
            </button>
            <button className={styles.btn} type="button" onClick={clearSelection}>
              全解除
            </button>
            <button
              className={styles.btn}
              type="button"
              onClick={() => bulkSetAcquired(true)}
              disabled={selectedCount === 0}
            >
              取得済みにする
            </button>
            <button
              className={styles.btn}
              type="button"
              onClick={() => bulkSetAcquired(false)}
              disabled={selectedCount === 0}
            >
              未取得に戻す
            </button>
            <button
              className={styles.btn}
              type="button"
              onClick={bulkRemoveSelected}
              disabled={selectedCount === 0}
            >
              削除
            </button>
          </div>

          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.card}>
                <div className={styles.small}>
                  まだメモがありません。右上の「追加」から作れます。
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
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
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
                        <div style={{ fontWeight: 700 }}>
                          {it.name}
                          {it.code ? `（${it.code}）` : ""}
                        </div>
                      </div>
                        <div className={styles.cardSide}>
                          <div className={styles.monthPriorityRow}>
                            {it.months.map((month) => (
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                            onClick={() => cycleCrossType(it.id)}
                            title="タップで戦略タイプを切り替え"
                          >
                            {it.crossType ?? "長期：設定がない"}
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
                      {it.entryTiming ? `早打ち目安: ${it.entryTiming} / ` : ""}
                      {it.tenureRule ? `任期: ${it.tenureRule}` : ""}
                    </div>

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

          {noticeMessage ? (
            <div className={styles.overlay} onClick={() => setNoticeMessage(null)}>
              <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
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

          {tagManagerOpen ? (
            <div
              className={styles.overlay}
              onClick={() => setTagManagerOpen(false)}
            >
              <div
                className={styles.dialog}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.dialogTitle}>タグ管理</div>

                <div className={styles.dialogBody}>
                  <div className={styles.row} style={{ gap: 8 }}>
                    <input
                      className={styles.input}
                      placeholder="新しいタグ名"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                    <button
                      className={styles.btnPrimary}
                      type="button"
                      onClick={addTag}
                    >
                      追加
                    </button>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {tags.length === 0 ? (
                      <div className={styles.small}>タグがありません</div>
                    ) : (
                      tags.map((t) => (
                        <div
                          key={t.id}
                          className={styles.row}
                          style={{ gap: 8, alignItems: "center" }}
                        >
                          <input
                            className={styles.input}
                            value={t.name}
                            onChange={(e) => renameTag(t.id, e.target.value)}
                          />
                          <button
                            className={styles.btn}
                            type="button"
                            onClick={() => deleteTag(t.id)}
                          >
                            削除
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
                    onClick={() => setTagManagerOpen(false)}
                  >
                    閉じる
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

            <div className={styles.small} style={{ marginBottom: 6 }}>
              戦略タイプ
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

            <div className={styles.small} style={{ marginTop: 8 }}>
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
    </div>
  );
}
