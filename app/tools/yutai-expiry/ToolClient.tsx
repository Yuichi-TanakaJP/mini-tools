"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ToolClient.module.css";

type TabKey = "thisMonth" | "later" | "all";
type ViewMode = "cards" | "table";
type SortKey = "expiryAsc" | "companyAsc" | "createdDesc";

type BenefitItemV2 = {
  id: string;
  title: string; // 優待名
  company: string; // 企業名
  expiresOn: string | null; // YYYY-MM-DD or null(期限なし)
  isUsed: boolean;

  // 任意（ユーザーの要望：隠さない、任意）
  quantity?: number | null;
  amountYen?: number | null;
  memo?: string;

  createdAt: string; // ISO
  updatedAt: string; // ISO
};

const STORAGE_KEY_V2 = "mini-tools:benefits:v2";
const LEGACY_KEYS = [
  "benefits-tracker-items-v1",
  "benefits-tracker-items",
  "mini-tools:benefits",
];

type CryptoWithUUID = Crypto & { randomUUID?: () => string };

function safeUUID() {
  const c = globalThis.crypto as CryptoWithUUID | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function todayISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(yyyy_mm_dd: string): Date {
  // タイムゾーン事故を避けるためローカル日付として生成
  return new Date(`${yyyy_mm_dd}T00:00:00`);
}

function fmtJPDate(yyyy_mm_dd: string): string {
  const d = parseLocalDate(yyyy_mm_dd);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}/${m}/${day}`;
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function toNumberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return n;
}

// 旧データ(v1)をできるだけ救う
// v1: { id,title,company,expiresAt,isUsed,usedAt,quantity,amount,note,createdAt,updatedAt }
function normalizeLegacyToV2(raw: unknown): BenefitItemV2[] {
  if (!Array.isArray(raw)) return [];

  const nowIso = new Date().toISOString();

  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const obj = x as Record<string, unknown>;

      const id =
        typeof obj.id === "string" && obj.id.trim() ? obj.id : safeUUID();

      const title = typeof obj.title === "string" ? obj.title : "";
      const company = typeof obj.company === "string" ? obj.company : "";

      const expiresAt =
        typeof obj.expiresAt === "string" ? obj.expiresAt : null;
      // expiresAt が ISO の日付だったりするケースもあるので YYYY-MM-DD に寄せる
      const expiresOn = expiresAt ? expiresAt.slice(0, 10) : null;

      const isUsed = typeof obj.isUsed === "boolean" ? obj.isUsed : false;

      const quantity = (() => {
        if (typeof obj.quantity === "number") return obj.quantity;
        if (typeof obj.quantity === "string")
          return toNumberOrNull(obj.quantity);
        return null;
      })();

      const amountYen = (() => {
        if (typeof obj.amount === "number") return obj.amount;
        if (typeof obj.amount === "string") return toNumberOrNull(obj.amount);
        // v1で amount が "¥1,000" みたいに入ってる可能性を拾う
        if (typeof obj.amount === "string") {
          const cleaned = obj.amount.replace(/[^\d.-]/g, "");
          return toNumberOrNull(cleaned);
        }
        return null;
      })();

      const memo =
        typeof obj.note === "string"
          ? obj.note
          : typeof obj.memo === "string"
          ? obj.memo
          : "";

      const createdAt =
        typeof obj.createdAt === "string" && obj.createdAt
          ? obj.createdAt
          : nowIso;

      const updatedAt =
        typeof obj.updatedAt === "string" && obj.updatedAt
          ? obj.updatedAt
          : nowIso;

      return {
        id,
        title: title.trim(),
        company: company.trim(),
        expiresOn: expiresOn && expiresOn.trim() ? expiresOn.trim() : null,
        isUsed,
        quantity: quantity ?? null,
        amountYen: amountYen ?? null,
        memo: memo?.toString() ?? "",
        createdAt,
        updatedAt,
      } satisfies BenefitItemV2;
    })
    .filter(Boolean) as BenefitItemV2[];
}

function loadFromLocalStorage(): BenefitItemV2[] {
  if (typeof window === "undefined") return [];

  // v2 があればそれを優先
  const v2 = window.localStorage.getItem(STORAGE_KEY_V2);
  if (v2) {
    try {
      const parsed = JSON.parse(v2);
      if (Array.isArray(parsed)) return parsed as BenefitItemV2[];
    } catch {
      // ignore
    }
  }

  // v1/旧キーを探索して移行
  for (const k of LEGACY_KEYS) {
    const s = window.localStorage.getItem(k);
    if (!s) continue;
    try {
      const parsed = JSON.parse(s);
      const normalized = normalizeLegacyToV2(parsed);
      if (normalized.length) return normalized;
    } catch {
      // ignore
    }
  }

  return [];
}

function saveToLocalStorage(items: BenefitItemV2[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(items));
}

function compareISODesc(a: string, b: string) {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

function cmpText(a: string, b: string) {
  return a.localeCompare(b, "ja");
}

function dueBadge(
  expiresOn: string | null
): { label: string; tone: "muted" | "warn" | "danger" } | null {
  if (!expiresOn) return null;
  const d = parseLocalDate(expiresOn);
  const today = parseLocalDate(todayISODate());
  const diffDays = Math.floor(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return { label: "期限切れ", tone: "danger" };
  if (diffDays === 0) return { label: "今日まで", tone: "danger" };
  if (diffDays <= 7) return { label: `あと${diffDays}日`, tone: "warn" };
  return { label: "期限あり", tone: "muted" };
}

type Draft = {
  id?: string;
  title: string;
  company: string;
  expiresOn: string; // 入力では空文字もあり得る
  isUsed: boolean;
  quantity: string;
  amountYen: string;
  memo: string;
};

function toDraft(x?: BenefitItemV2): Draft {
  return {
    id: x?.id,
    title: x?.title ?? "",
    company: x?.company ?? "",
    expiresOn: x?.expiresOn ?? "",
    isUsed: x?.isUsed ?? false,
    quantity: x?.quantity != null ? String(x.quantity) : "",
    amountYen: x?.amountYen != null ? String(x.amountYen) : "",
    memo: x?.memo ?? "",
  };
}

function validateDraft(d: Draft): { ok: boolean; message?: string } {
  if (!d.title.trim())
    return { ok: false, message: "優待名を入力してください。" };
  if (!d.company.trim())
    return { ok: false, message: "企業名を入力してください。" };
  if (d.expiresOn.trim()) {
    // YYYY-MM-DD のみ許可
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expiresOn.trim())) {
      return {
        ok: false,
        message: "期限は YYYY-MM-DD 形式で入力してください（例: 2026-03-31）。",
      };
    }
  }
  return { ok: true };
}

export default function ToolClient() {
  // --- state ---
  const [items, setItems] = useState<BenefitItemV2[]>(() =>
    loadFromLocalStorage()
  );
  const [tab, setTab] = useState<TabKey>("thisMonth");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showUsed, setShowUsed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("expiryAsc");
  const [query, setQuery] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  // dialogs
  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const importDialogRef = useRef<HTMLDialogElement | null>(null);

  const [editMode, setEditMode] = useState<"add" | "edit">("add");
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [draftError, setDraftError] = useState<string | null>(null);

  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // --- persist ---
  useEffect(() => {
    saveToLocalStorage(items);
  }, [items]);

  // --- derived ---
  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKey(now);
  const nextMonthStart = startOfNextMonth(now);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const base = items.filter((it) => {
      if (!showUsed && it.isUsed) return false;

      // 検索
      if (q) {
        const hay = `${it.title} ${it.company} ${it.memo ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      // タブ
      if (tab === "thisMonth") {
        // 期限なしは今月には出さない（ノイズ防止）
        if (!it.expiresOn) return false;
        const d = parseLocalDate(it.expiresOn);
        return monthKey(d) === thisMonthKey;
      }

      if (tab === "later") {
        // 期限なしは later にも出さない（期限があるものだけ）
        if (!it.expiresOn) return false;
        const d = parseLocalDate(it.expiresOn);
        return d.getTime() >= nextMonthStart.getTime();
      }

      // all
      return true;
    });

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "createdDesc")
        return compareISODesc(a.createdAt, b.createdAt);
      if (sortKey === "companyAsc") return cmpText(a.company, b.company);

      // expiryAsc（期限なしは最後）
      const ax = a.expiresOn;
      const bx = b.expiresOn;
      if (!ax && !bx) return cmpText(a.company, b.company);
      if (!ax) return 1;
      if (!bx) return -1;
      if (ax === bx) return cmpText(a.company, b.company);
      return ax < bx ? -1 : 1;
    });

    return sorted;
  }, [items, showUsed, query, tab, sortKey, thisMonthKey, nextMonthStart]);

  const thisMonthCount = useMemo(() => {
    return items.filter((it) => {
      if (it.isUsed) return false; // “基本表示：未使用だけ” の数字に寄せる
      if (!it.expiresOn) return false;
      return isSameMonth(parseLocalDate(it.expiresOn), now);
    }).length;
  }, [items, now]);

  const laterCount = useMemo(() => {
    return items.filter((it) => {
      if (it.isUsed) return false;
      if (!it.expiresOn) return false;
      return parseLocalDate(it.expiresOn).getTime() >= nextMonthStart.getTime();
    }).length;
  }, [items, nextMonthStart]);

  const allCount = useMemo(() => {
    return items.filter((it) => !it.isUsed).length;
  }, [items]);

  // --- actions ---
  function openAdd() {
    setEditMode("add");
    setDraft(toDraft());
    setDraftError(null);
    editDialogRef.current?.showModal();
  }

  function openEdit(it: BenefitItemV2) {
    setEditMode("edit");
    setDraft(toDraft(it));
    setDraftError(null);
    editDialogRef.current?.showModal();
  }

  function upsertFromDraft() {
    const v = validateDraft(draft);
    if (!v.ok) {
      setDraftError(v.message ?? "入力内容を確認してください。");
      return;
    }

    const nowIso = new Date().toISOString();
    const expiresOn = draft.expiresOn.trim() ? draft.expiresOn.trim() : null;

    const next: BenefitItemV2 = {
      id: draft.id ?? safeUUID(),
      title: draft.title.trim(),
      company: draft.company.trim(),
      expiresOn,
      isUsed: draft.isUsed,
      quantity: toNumberOrNull(draft.quantity),
      amountYen: toNumberOrNull(draft.amountYen),
      memo: draft.memo?.trim() ?? "",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === next.id);
      if (idx === -1) {
        return [next, ...prev];
      }
      const merged: BenefitItemV2 = {
        ...prev[idx],
        ...next,
        createdAt: prev[idx].createdAt,
        updatedAt: nowIso,
      };
      const copy = [...prev];
      copy[idx] = merged;
      return copy;
    });

    editDialogRef.current?.close();
    setToast(editMode === "add" ? "追加しました" : "更新しました");
  }

  function toggleUsed(id: string) {
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, isUsed: !p.isUsed, updatedAt: new Date().toISOString() }
          : p
      )
    );
  }

  function removeItem(id: string) {
    const ok = window.confirm("削除しますか？（元に戻せません）");
    if (!ok) return;
    setItems((prev) => prev.filter((p) => p.id !== id));
    setToast("削除しました");
  }

  function exportJSON() {
    const payload = JSON.stringify(items, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benefits_${todayISODate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openImport() {
    setImportText("");
    setImportError(null);
    importDialogRef.current?.showModal();
  }

  function doImport(merge: boolean) {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      const normalized = normalizeLegacyToV2(parsed);
      if (!normalized.length) {
        setImportError(
          "読み込めるデータがありませんでした（配列JSONを貼り付けてください）。"
        );
        return;
      }

      setItems((prev) => {
        if (!merge) return normalized;
        const byId = new Map<string, BenefitItemV2>();
        for (const p of prev) byId.set(p.id, p);
        for (const n of normalized) byId.set(n.id, n);
        return Array.from(byId.values()).sort((a, b) =>
          compareISODesc(a.createdAt, b.createdAt)
        );
      });

      importDialogRef.current?.close();
      setToast(
        merge ? "インポート（統合）しました" : "インポート（置換）しました"
      );
    } catch {
      setImportError("JSONの形式が正しくありません。");
    }
  }

  // toast auto clear
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // empty state messages
  const emptyMessage = useMemo(() => {
    if (tab === "thisMonth") return "今月の期限はありません";
    if (tab === "later") return "今後の期限（来月以降）はありません";
    return "まだデータがありません";
  }, [tab]);

  return (
    <section className={styles.shell}>
      {/* top controls */}
      <div className={styles.topBar}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${
              tab === "thisMonth" ? styles.tabActive : ""
            }`}
            onClick={() => setTab("thisMonth")}
            type="button"
          >
            今月 <span className={styles.countPill}>{thisMonthCount}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${
              tab === "later" ? styles.tabActive : ""
            }`}
            onClick={() => setTab("later")}
            type="button"
          >
            先の期限 <span className={styles.countPill}>{laterCount}</span>
          </button>
          <button
            className={`${styles.tabBtn} ${
              tab === "all" ? styles.tabActive : ""
            }`}
            onClick={() => setTab("all")}
            type="button"
          >
            すべて <span className={styles.countPill}>{allCount}</span>
          </button>
        </div>

        <div className={styles.actionsRow}>
          <div className={styles.searchWrap}>
            <input
              className={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索（企業名 / 優待名 / メモ）"
              aria-label="検索"
            />
          </div>

          <div className={styles.compactRow}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={showUsed}
                onChange={(e) => setShowUsed(e.target.checked)}
              />
              <span>完了も表示</span>
            </label>

            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="並び替え"
              >
                <option value="expiryAsc">期限が近い順</option>
                <option value="companyAsc">企業名（A→Z）</option>
                <option value="createdDesc">追加が新しい順</option>
              </select>
            </div>

            <div className={styles.segment}>
              <button
                type="button"
                className={`${styles.segBtn} ${
                  viewMode === "cards" ? styles.segActive : ""
                }`}
                onClick={() => setViewMode("cards")}
                aria-label="カード表示"
              >
                カード
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${
                  viewMode === "table" ? styles.segActive : ""
                }`}
                onClick={() => setViewMode("table")}
                aria-label="表表示"
              >
                表
              </button>
            </div>

            {/* PC用の追加ボタン */}
            <button
              type="button"
              className={styles.addBtnDesktop}
              onClick={openAdd}
            >
              ＋ 追加
            </button>
          </div>
        </div>
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>{emptyMessage}</div>
          <div className={styles.emptySub}>
            {tab === "thisMonth" ? (
              <>期限なし（ノイズ防止）は「すべて」にだけ表示されます。</>
            ) : (
              <>「＋ 追加」から登録できます。</>
            )}
          </div>
          <div className={styles.emptyCtaRow}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={openAdd}
            >
              ＋ 追加
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={openImport}
            >
              インポート
            </button>
          </div>
        </div>
      ) : viewMode === "cards" ? (
        <div className={styles.cardGrid}>
          {filtered.map((it) => {
            const badge = dueBadge(it.expiresOn);
            return (
              <div
                key={it.id}
                className={`${styles.card} ${it.isUsed ? styles.cardUsed : ""}`}
              >
                <div className={styles.cardTop}>
                  <div className={styles.cardTitleRow}>
                    <div className={styles.cardTitle}>{it.title}</div>
                    {badge ? (
                      <span
                        className={`${styles.badge} ${
                          badge.tone === "danger"
                            ? styles.badgeDanger
                            : badge.tone === "warn"
                            ? styles.badgeWarn
                            : styles.badgeMuted
                        }`}
                      >
                        {badge.label}
                      </span>
                    ) : (
                      tab === "all" && (
                        <span
                          className={`${styles.badge} ${styles.badgeMuted}`}
                        >
                          期限なし
                        </span>
                      )
                    )}
                  </div>

                  <div className={styles.cardMeta}>
                    <div className={styles.company}>{it.company}</div>
                    <div className={styles.expiry}>
                      {it.expiresOn
                        ? `期限: ${fmtJPDate(it.expiresOn)}`
                        : "期限: なし"}
                    </div>
                  </div>
                </div>

                {(it.quantity != null ||
                  it.amountYen != null ||
                  (it.memo && it.memo.trim())) && (
                  <div className={styles.cardBody}>
                    {(it.quantity != null || it.amountYen != null) && (
                      <div className={styles.kvRow}>
                        {it.quantity != null && (
                          <span className={styles.kv}>
                            数量: <b>{it.quantity}</b>
                          </span>
                        )}
                        {it.amountYen != null && (
                          <span className={styles.kv}>
                            金額: <b>{it.amountYen.toLocaleString()}円</b>
                          </span>
                        )}
                      </div>
                    )}
                    {it.memo && it.memo.trim() && (
                      <div className={styles.memo}>{it.memo}</div>
                    )}
                  </div>
                )}

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => toggleUsed(it.id)}
                  >
                    {it.isUsed ? "未使用に戻す" : "使用済みにする"}
                  </button>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => openEdit(it)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className={`${styles.smallBtn} ${styles.dangerBtn}`}
                    onClick={() => removeItem(it.id)}
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 120 }}>期限</th>
                <th>優待</th>
                <th style={{ width: 180 }}>企業</th>
                <th style={{ width: 120 }}>状態</th>
                <th style={{ width: 180 }}>メモ/任意</th>
                <th style={{ width: 240 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className={it.isUsed ? styles.rowUsed : ""}>
                  <td className={styles.mono}>
                    {it.expiresOn ? fmtJPDate(it.expiresOn) : "—"}
                  </td>
                  <td>
                    <div className={styles.rowTitle}>{it.title}</div>
                    {(it.quantity != null || it.amountYen != null) && (
                      <div className={styles.rowSub}>
                        {it.quantity != null && (
                          <span>数量: {it.quantity}</span>
                        )}
                        {it.amountYen != null && (
                          <span>金額: {it.amountYen.toLocaleString()}円</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{it.company}</td>
                  <td>{it.isUsed ? "使用済み" : "未使用"}</td>
                  <td className={styles.rowMemo}>{it.memo ?? ""}</td>
                  <td>
                    <div className={styles.rowBtns}>
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => toggleUsed(it.id)}
                      >
                        {it.isUsed ? "未使用" : "使用済み"}
                      </button>
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => openEdit(it)}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className={`${styles.smallBtn} ${styles.dangerBtn}`}
                        onClick={() => removeItem(it.id)}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* bottom utility */}
      <div className={styles.bottomBar}>
        <div className={styles.hint}>
          期限なしは「すべて」にだけ表示（今月/先の期限からは除外）。
        </div>
        <div className={styles.bottomBtns}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={exportJSON}
          >
            エクスポート
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={openImport}
          >
            インポート
          </button>
        </div>
      </div>

      {/* FAB (mobile) */}
      <button
        type="button"
        className={styles.fab}
        onClick={openAdd}
        aria-label="追加"
      >
        ＋
      </button>

      {/* Edit/Add dialog */}
      <dialog ref={editDialogRef} className={styles.dialog}>
        <form
          method="dialog"
          className={styles.dialogInner}
          onSubmit={(e) => {
            e.preventDefault();
            upsertFromDraft();
          }}
        >
          <div className={styles.dialogHeader}>
            <div className={styles.dialogTitle}>
              {editMode === "add" ? "追加" : "編集"}
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => editDialogRef.current?.close()}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>優待名 *</span>
              <input
                value={draft.title}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="例：QUOカード / 食事券 / 自社製品"
                required
              />
            </label>

            <label className={styles.field}>
              <span>企業名 *</span>
              <input
                value={draft.company}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, company: e.target.value }))
                }
                placeholder="例：ビックカメラ"
                required
              />
            </label>

            <label className={styles.field}>
              <span>期限（任意）</span>
              <input
                value={draft.expiresOn}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, expiresOn: e.target.value }))
                }
                placeholder="YYYY-MM-DD（例：2026-03-31）"
                inputMode="numeric"
              />
              <span className={styles.help}>
                空なら「期限なし」。今月タブには出ません（ノイズ防止）。
              </span>
            </label>

            <div className={styles.row2}>
              <label className={styles.field}>
                <span>数量（任意）</span>
                <input
                  value={draft.quantity}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, quantity: e.target.value }))
                  }
                  placeholder="例：1"
                  inputMode="numeric"
                />
              </label>

              <label className={styles.field}>
                <span>金額（円・任意）</span>
                <input
                  value={draft.amountYen}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, amountYen: e.target.value }))
                  }
                  placeholder="例：1000"
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>メモ（任意）</span>
              <textarea
                value={draft.memo}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, memo: e.target.value }))
                }
                placeholder="例：店舗限定 / ネット不可 / 家族分"
                rows={3}
              />
            </label>

            <label className={styles.toggleLine}>
              <input
                type="checkbox"
                checked={draft.isUsed}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, isUsed: e.target.checked }))
                }
              />
              <span>使用済み</span>
            </label>

            {draftError && <div className={styles.error}>{draftError}</div>}
          </div>

          <div className={styles.dialogFooter}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => editDialogRef.current?.close()}
            >
              キャンセル
            </button>
            <button type="submit" className={styles.primaryBtn}>
              {editMode === "add" ? "追加する" : "更新する"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Import dialog */}
      <dialog ref={importDialogRef} className={styles.dialog}>
        <form method="dialog" className={styles.dialogInner}>
          <div className={styles.dialogHeader}>
            <div className={styles.dialogTitle}>インポート</div>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => importDialogRef.current?.close()}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.help}>
              配列JSONを貼り付けてください。旧バージョン形式も自動で取り込みます。
            </div>
            <textarea
              className={styles.bigTextarea}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='例：[{ "id":"...", "title":"...", "company":"...", "expiresAt":"2026-03-31", ... }]'
              rows={10}
            />
            {importError && <div className={styles.error}>{importError}</div>}
          </div>

          <div className={styles.dialogFooter}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => importDialogRef.current?.close()}
            >
              閉じる
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => doImport(true)}
            >
              統合
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => doImport(false)}
            >
              置換
            </button>
          </div>
        </form>
      </dialog>

      {/* toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </section>
  );
}
