"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import styles from "./ToolClient.module.css";
import MobileLayout from "./MobileLayout";
import DesktopLayout from "./DesktopLayout";

import {
  EMPTY_ITEMS,
  getBenefitsServerSnapshot,
  getBenefitsSnapshot,
  subscribeBenefitsStore,
  writeBenefits,
  BenefitItemV2,
  normalizeLegacyToV2,
  safeUUID,
} from "./benefits/store";

import EditBenefitDialog from "./components/EditBenefitDialog";
import ImportBenefitDialog from "./components/ImportBenefitDialog";

type TabKey = "thisMonth" | "later" | "all";
type ViewMode = "cards" | "table";
type SortKey = "expiryAsc" | "companyAsc" | "createdDesc";

const VIEW_MODE_KEY = "mini-tools:benefits:viewMode";

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

export type Draft = {
  id?: string;
  title: string;
  company: string;
  expiresOn: string; // 入力では空文字もあり得る
  isUsed: boolean;
  quantity: string;
  amountYen: string;
  memo: string;
  link: string; // URL（任意）
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
    link: x?.link ?? "",
  };
}

function validateHttpUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null; // 未入力OK
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "リンクは http:// または https:// のURLのみ保存できます。";
    }
    return null;
  } catch {
    return "リンクURLの形式が正しくありません（例: https://example.com）。";
  }
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

  const linkErr = validateHttpUrl(d.link);
  if (linkErr) return { ok: false, message: linkErr };

  return { ok: true };
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function readSavedViewMode(): ViewMode | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(VIEW_MODE_KEY);
  return v === "cards" || v === "table" ? (v as ViewMode) : null;
}

function saveViewMode(mode: ViewMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VIEW_MODE_KEY, mode);
}

function useMediaQuery(query: string) {
  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onStoreChange);
    return () => mql.removeEventListener("change", onStoreChange);
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  };

  // SSR/Hydration中は必ず false（= Desktop扱い）で固定する
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function useHydrated() {
  const subscribe = () => () => {};
  const getSnapshot = () => true; // クライアントは true
  const getServerSnapshot = () => false; // サーバは false
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function parseNumberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return n;
}

export default function ToolClient() {
  const hydrated = useHydrated();

  const itemsStore = useSyncExternalStore(
    subscribeBenefitsStore,
    getBenefitsSnapshot,
    getBenefitsServerSnapshot
  );

  // ★A-2：表示に使うのは hydration 後だけ
  const items = hydrated ? itemsStore : EMPTY_ITEMS;

  // setItems互換（updater関数もOK）
  const setItems = (
    updater: BenefitItemV2[] | ((prev: BenefitItemV2[]) => BenefitItemV2[])
  ) => {
    const prev = getBenefitsSnapshot();
    const next =
      typeof updater === "function" ? (updater as any)(prev) : updater;
    writeBenefits(next);
  };

  const [tab, setTab] = useState<TabKey>("all");
  const isMobile = useMediaQuery("(max-width: 699px)");

  const [hasManualViewMode, setHasManualViewMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return readSavedViewMode() !== null;
  });

  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const [showUsed, setShowUsed] = useState(true);
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
        const hay = `${it.title} ${it.company} ${it.memo ?? ""} ${
          it.link ?? ""
        }`.toLowerCase();
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
      quantity: parseNumberOrNull(draft.quantity),
      amountYen: parseNumberOrNull(draft.amountYen),
      memo: draft.memo?.trim() ?? "",
      link: draft.link.trim() ? draft.link.trim() : undefined,
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

  const savedViewMode: ViewMode | null = hydrated ? readSavedViewMode() : null;

  const effectiveViewMode: ViewMode = !hydrated
    ? "table"
    : savedViewMode ?? (isMobile ? "cards" : viewMode);

  // ===== layout parts =====
  const header = (
    <div className={styles.topBar}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${
            tab === "all" ? styles.tabActive : ""
          }`}
          onClick={() => setTab("all")}
          type="button"
        >
          すべて
          <span className={styles.countPill} suppressHydrationWarning>
            {allCount}
          </span>
        </button>

        <button
          className={`${styles.tabBtn} ${
            tab === "thisMonth" ? styles.tabActive : ""
          }`}
          onClick={() => setTab("thisMonth")}
          type="button"
        >
          今月
          <span className={styles.countPill} suppressHydrationWarning>
            {thisMonthCount}
          </span>
        </button>

        <button
          className={`${styles.tabBtn} ${
            tab === "later" ? styles.tabActive : ""
          }`}
          onClick={() => setTab("later")}
          type="button"
        >
          先の期限
          <span className={styles.countPill} suppressHydrationWarning>
            {laterCount}
          </span>
        </button>
      </div>

      <div className={styles.actionsRow}>
        <div className={styles.searchWrap}>
          <input
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索（企業名 / 優待名 / メモ / リンク）"
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
            <span>使用済含む</span>
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

          <div className={`${styles.segment} ${styles.desktopOnly}`}>
            <button
              type="button"
              className={`${styles.segBtn} ${
                effectiveViewMode === "cards" ? styles.segActive : ""
              }`}
              onClick={() => {
                setViewMode("cards");
                setHasManualViewMode(true);
                saveViewMode("cards");
              }}
              aria-label="カード表示"
            >
              カード
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${
                effectiveViewMode === "table" ? styles.segActive : ""
              }`}
              onClick={() => {
                setViewMode("table");
                setHasManualViewMode(true);
                saveViewMode("table");
              }}
              aria-label="表表示"
            >
              リスト
            </button>
          </div>

          {/* PC用の追加ボタン */}
          <button
            type="button"
            className={`${styles.addBtnDesktop} ${styles.desktopOnly}`}
            onClick={openAdd}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );

  const list = (
    <>
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
              追加
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
      ) : effectiveViewMode === "cards" ? (
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

                {it.link && (
                  <div className={styles.cardBody} style={{ paddingTop: 0 }}>
                    <div className={styles.kvRow}>
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.mono}
                        title={it.link}
                        style={{ textDecoration: "underline" }}
                      >
                        🔗 {displayHost(it.link)}
                      </a>
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={async () => {
                          const ok = await copyToClipboard(it.link!);
                          setToast(
                            ok
                              ? "リンクをコピーしました"
                              : "コピーに失敗しました"
                          );
                        }}
                      >
                        コピー
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => toggleUsed(it.id)}
                  >
                    {it.isUsed ? "使用済" : "未使用"}
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
                <th style={{ width: 180 }}>メモ</th>
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

                    {it.link && (
                      <div className={styles.rowSub}>
                        <a
                          href={it.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.mono}
                          title={it.link}
                          style={{ textDecoration: "underline" }}
                        >
                          🔗 {displayHost(it.link)}
                        </a>
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={async () => {
                            const ok = await copyToClipboard(it.link!);
                            setToast(
                              ok
                                ? "リンクをコピーしました"
                                : "コピーに失敗しました"
                            );
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          コピー
                        </button>
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
    </>
  );

  const footer = (
    <>
      {/* bottom utility */}
      <div className={styles.bottomBar}>
        <div className={styles.hint}>期限なしは「すべて」に含まれます。</div>
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
        className={`${styles.fab} ${styles.fabBtn} ${styles.mobileOnly}`}
        onClick={openAdd}
        aria-label="追加"
      >
        ＋
      </button>

      {/* Edit/Add dialog */}
      <EditBenefitDialog
        dialogRef={editDialogRef}
        editMode={editMode}
        draft={draft}
        setDraft={setDraft}
        draftError={draftError}
        onSubmit={upsertFromDraft}
      />

      {/* Import dialog */}
      <ImportBenefitDialog
        dialogRef={importDialogRef}
        importText={importText}
        setImportText={setImportText}
        importError={importError}
        onImportReplace={() => doImport(false)}
        onImportMerge={() => doImport(true)}
      />

      {/* toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </>
  );

  const showMobile = hydrated && isMobile;

  return showMobile ? (
    <MobileLayout header={header} list={list} footer={footer} />
  ) : (
    <DesktopLayout header={header} list={list} footer={footer} />
  );
}
