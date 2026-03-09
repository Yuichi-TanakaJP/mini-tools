"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ToolClient.module.css";
import type { MemoItem, Tag } from "./types";
import { DEFAULT_TAGS } from "./types";
import { loadItems, saveItems, loadTags, saveTags } from "./storage";

function uid() {
  // 十分実用（uuid不要ならこれでOK）
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

type SortKey = "createdAt" | "code" | "name";
type SortOrder = "asc" | "desc";
type SortState = { key: SortKey; order: SortOrder };
const SORT_KEY = "yutai_memo_sort_v1";

type Draft = {
  id?: string;
  createdAt?: string;
  name: string;
  code: string;
  months: number[];
  tagIds: string[];
  entryTiming: string;
  tenureRule: string;
  acquired: boolean;
  oneShareHold: boolean;
  priority: 1 | 2 | 3;
  memo: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  code: "",
  months: [],
  tagIds: [],
  entryTiming: "",
  tenureRule: "",
  acquired: false,
  oneShareHold: false,
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

export default function ToolClient() {
  const [items, setItems] = useState<MemoItem[]>(() => loadItems());

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

  // load

  // persist
  useEffect(() => {
    saveItems(items);
  }, [items]);

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
          it.entryTiming ?? "",
          it.tenureRule ?? "",
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
      entryTiming: it.entryTiming ?? "",
      tenureRule: it.tenureRule ?? "",
      acquired: it.acquired,
      oneShareHold: it.oneShareHold,
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

  function setPriority(p: 1 | 2 | 3) {
    setDraft((d) => ({ ...d, priority: p }));
  }

  function validate(d: Draft): string | null {
    if (!d.name.trim()) return "銘柄名は必須です";
    if (d.months.length === 0) return "権利月は1つ以上選んでください";
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
        entryTiming: draft.entryTiming.trim() || undefined,
        tenureRule: draft.tenureRule.trim() || undefined,
        acquired: draft.acquired,
        oneShareHold: draft.oneShareHold,
        priority: draft.priority,
        memo: draft.memo.trim(),
        updatedAt: now,
      };

      if (!draft.id) return [base, ...prev];
      return prev.map((x) => (x.id === draft.id ? base : x));
    });
    setMode("list");
  }

  function remove() {
    if (!draft.id) {
      setMode("list");
      return;
    }
    if (!confirm("削除しますか？")) return;
    setItems((prev) => prev.filter((x) => x.id !== draft.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(draft.id as string);
      return next;
    });
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

  const selectedCount = selectedIds.size;

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
                  <div
                    className={styles.card}
                    role="button"
                    tabIndex={0}
                    style={{ textAlign: "left", cursor: "pointer" }}
                    onClick={() => openEdit(it)}
                    onKeyDown={(e) => {
                      if (e.currentTarget !== e.target) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openEdit(it);
                      }
                    }}
                  >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {it.name}
                      {it.code ? `（${it.code}）` : ""}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className={`${styles.stateToggle} ${
                          it.acquired ? styles.stateOn : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAcquired(it.id);
                        }}
                      >
                        {it.acquired ? "取得済み" : "未取得"}
                      </button>
                      <div className={styles.small}>★{it.priority}</div>
                    </div>
                  </div>

                  <div className={styles.meta}>
                    <span className={styles.chip}>
                      {it.months.join("/") + "月"}
                    </span>
                    {it.tagIds.map((id) => (
                      <span key={id} className={styles.chip}>
                        {tagNameById.get(id) ?? "（不明タグ）"}
                      </span>
                    ))}
                    {it.oneShareHold ? (
                      <span className={styles.chip}>1株保有中</span>
                    ) : null}
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
                <label
                  className={styles.small}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={draft.oneShareHold}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, oneShareHold: e.target.checked }))
                    }
                  />
                  1株保有中（長期優遇用）
                </label>
              </div>

              <div className={styles.stars}>
                <span className={styles.small}>重要度</span>
                {[1, 2, 3].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.starBtn} ${
                      draft.priority === p ? styles.starOn : ""
                    }`}
                    onClick={() => setPriority(p as 1 | 2 | 3)}
                    aria-label={`priority ${p}`}
                  >
                    ★{p}
                  </button>
                ))}
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
              <button className={styles.btn} onClick={remove} type="button">
                削除
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
