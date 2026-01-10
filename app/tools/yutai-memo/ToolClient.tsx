"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ToolClient.module.css";
import type { MemoItem, TagKey } from "./types";
import { TAG_LABEL } from "./types";
import { loadItems, saveItems } from "./storage";

function uid() {
  // 十分実用（uuid不要ならこれでOK）
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const TAGS: TagKey[] = ["early", "one_share", "tenure", "failure", "must"];

type Draft = {
  id?: string;
  name: string;
  code: string;
  months: number[];
  tags: TagKey[];
  entryTiming: string;
  tenureRule: string;
  oneShareHold: boolean;
  priority: 1 | 2 | 3;
  memo: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  code: "",
  months: [],
  tags: [],
  entryTiming: "",
  tenureRule: "",
  oneShareHold: false,
  priority: 2,
  memo: "",
});

export default function ToolClient() {
  const [items, setItems] = useState<MemoItem[]>(() => loadItems());
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<number | "all">("all");
  const [tagFilter, setTagFilter] = useState<TagKey | "all">("all");

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [mode, setMode] = useState<"list" | "edit">("list");

  // load

  // persist
  useEffect(() => {
    saveItems(items);
  }, [items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items
      .filter((it) => {
        if (monthFilter !== "all" && !it.months.includes(monthFilter))
          return false;
        if (tagFilter !== "all" && !it.tags.includes(tagFilter)) return false;

        if (!qq) return true;
        const hay = [
          it.name,
          it.code ?? "",
          it.memo ?? "",
          it.entryTiming ?? "",
          it.tenureRule ?? "",
          it.months.join(","),
          it.tags.join(","),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [items, q, monthFilter, tagFilter]);

  function openNew() {
    setDraft(emptyDraft());
    setMode("edit");
  }

  function openEdit(it: MemoItem) {
    setDraft({
      id: it.id,
      name: it.name,
      code: it.code ?? "",
      months: it.months,
      tags: it.tags,
      entryTiming: it.entryTiming ?? "",
      tenureRule: it.tenureRule ?? "",
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

  function toggleTag(t: TagKey) {
    setDraft((d) => {
      const has = d.tags.includes(t);
      const tags = has ? d.tags.filter((x) => x !== t) : [...d.tags, t];
      return { ...d, tags };
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
        months: draft.months,
        tags: draft.tags,
        entryTiming: draft.entryTiming.trim() || undefined,
        tenureRule: draft.tenureRule.trim() || undefined,
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
    setMode("list");
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
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className={styles.row} style={{ marginTop: 10 }}>
            <select
              className={styles.select}
              value={monthFilter}
              onChange={(e) => {
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
              onChange={(e) => setTagFilter(e.target.value as any)}
            >
              <option value="all">タグ: すべて</option>
              {TAGS.map((t) => (
                <option key={t} value={t}>
                  {TAG_LABEL[t]}
                </option>
              ))}
            </select>

            <button className={styles.btnPrimary} onClick={openNew}>
              + 追加
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
                <button
                  key={it.id}
                  className={styles.card}
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => openEdit(it)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {it.name}
                      {it.code ? `（${it.code}）` : ""}
                    </div>
                    <div className={styles.small}>★{it.priority}</div>
                  </div>

                  <div className={styles.meta}>
                    <span className={styles.chip}>
                      {it.months.join("/") + "月"}
                    </span>
                    {it.tags.map((t) => (
                      <span key={t} className={styles.chip}>
                        {TAG_LABEL[t]}
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
                </button>
              ))
            )}
          </div>
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
              {TAGS.map((t) => {
                const on = draft.tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                    onClick={() => toggleTag(t)}
                  >
                    {TAG_LABEL[t]}
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
