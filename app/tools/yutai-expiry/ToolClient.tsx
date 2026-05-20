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
  coerceNumber,
  coerceItem,
  consume,
  restock,
  setUsedAll,
  itemValueYen,
  TrackMode,
  UsageEntry,
} from "./benefits/store";

import EditBenefitDialog from "./components/EditBenefitDialog";
import ImportBenefitDialog from "./components/ImportBenefitDialog";

type TabKey = "thisMonth" | "later" | "all" | "overdue";
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

function formatMonthLabel(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function fmtYen(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

function remainingText(it: BenefitItemV2): string {
  const rem = it.remaining ?? 0;
  if (it.trackMode === "amount") return `残高 ${fmtYen(rem)}`;
  const base = `残${rem}枚`;
  if (it.unitYen != null)
    return `${base} ×${fmtYen(it.unitYen)}（合計 ${fmtYen(itemValueYen(it))}）`;
  return base;
}

function historyText(h: UsageEntry): string {
  const d = h.at ? h.at.slice(0, 10) : "";
  if (h.deltaYen != null) {
    const sign = h.deltaYen < 0 ? "使用" : "追加";
    return `${d} ${sign} ${fmtYen(Math.abs(h.deltaYen))}${
      h.note ? `（${h.note}）` : ""
    }`;
  }
  const q = h.deltaQty ?? 0;
  const sign = q < 0 ? "使用" : "追加";
  return `${d} ${sign} ${Math.abs(q)}枚${h.note ? `（${h.note}）` : ""}`;
}

export type Draft = {
  id?: string;
  title: string;
  company: string;
  expiresOn: string; // 入力では空文字もあり得る
  trackMode: TrackMode; // 枚数 / 金額
  qty: string; // count: 残枚数（編集時は現在値）
  unitYen: string; // count: 1枚あたり額面（任意）
  balanceYen: string; // amount: 残高(円)
  memo: string;
  link: string; // URL（任意）
};

function toDraft(x?: BenefitItemV2): Draft {
  const mode: TrackMode = x?.trackMode ?? "count";
  return {
    id: x?.id,
    title: x?.title ?? "",
    company: x?.company ?? "",
    expiresOn: x?.expiresOn ?? "",
    trackMode: mode,
    qty: mode === "count" && x?.remaining != null ? String(x.remaining) : "",
    unitYen: x?.unitYen != null ? String(x.unitYen) : "",
    balanceYen:
      mode === "amount" && x?.remaining != null ? String(x.remaining) : "",
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

  if (d.trackMode === "count") {
    const q = coerceNumber(d.qty);
    if (q == null || q < 0)
      return { ok: false, message: "枚数を0以上の数値で入力してください。" };
    if (d.unitYen.trim() && coerceNumber(d.unitYen) == null)
      return { ok: false, message: "1枚あたり額面は数値で入力してください。" };
  } else {
    const b = coerceNumber(d.balanceYen);
    if (b == null || b < 0)
      return { ok: false, message: "残高を0以上の金額で入力してください。" };
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
      typeof updater === "function" ? updater(prev) : updater;
    writeBenefits(next);
  };

  const [tab, setTab] = useState<TabKey>("all");
  const isMobile = useMediaQuery("(max-width: 699px)");

  // WHY: レンダー中の localStorage 直読みは再レンダー乖離バグの原因になるため、
  // 遅延初期化で一度だけ読む。readSavedViewMode は SSR で null を返し hydration 安全。
  const [viewMode, setViewMode] = useState<ViewMode | null>(() =>
    readSavedViewMode()
  );

  const selectViewMode = (m: ViewMode) => {
    setViewMode(m);
    saveViewMode(m);
  };

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
    const today = todayISODate();

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

      if (tab === "overdue") {
        if (!it.expiresOn) return false;
        return it.expiresOn < today;
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

  const overdueCount = useMemo(() => {
    const today = todayISODate();
    return items.filter((it) => {
      if (it.isUsed) return false;
      if (!it.expiresOn) return false;
      return it.expiresOn < today;
    }).length;
  }, [items]);

  const noExpiryCount = useMemo(() => {
    return items.filter((it) => !it.isUsed && !it.expiresOn).length;
  }, [items]);

  const unusedTotalYen = useMemo(() => {
    return items.reduce(
      (sum, it) => (it.isUsed ? sum : sum + itemValueYen(it)),
      0
    );
  }, [items]);

  const expiringThisMonthYen = useMemo(() => {
    return items.reduce((sum, it) => {
      if (it.isUsed || !it.expiresOn) return sum;
      if (!isSameMonth(parseLocalDate(it.expiresOn), now)) return sum;
      return sum + itemValueYen(it);
    }, 0);
  }, [items, now]);

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
    const id = draft.id ?? safeUUID();
    const isAmount = draft.trackMode === "amount";
    const remainingInput = isAmount
      ? coerceNumber(draft.balanceYen)
      : coerceNumber(draft.qty);
    const unitYen = isAmount
      ? null
      : draft.unitYen.trim()
      ? coerceNumber(draft.unitYen)
      : null;

    setItems((prev) => {
      const prevItem = prev.find((p) => p.id === id);
      // 編集時は initial / history / createdAt を保全（残のみユーザー編集を反映）
      const built = coerceItem({
        id,
        title: draft.title.trim(),
        company: draft.company.trim(),
        expiresOn,
        trackMode: draft.trackMode,
        unitYen,
        initial: prevItem?.initial ?? remainingInput,
        remaining: remainingInput,
        history: prevItem?.history ?? [],
        memo: draft.memo?.trim() ?? "",
        link: draft.link.trim() ? draft.link.trim() : undefined,
        createdAt: prevItem?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });
      if (!built) return prev;
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return [built, ...prev];
      const copy = [...prev];
      copy[idx] = built;
      return copy;
    });

    editDialogRef.current?.close();
    setToast(editMode === "add" ? "追加しました" : "更新しました");
  }

  function toggleUsed(id: string) {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? setUsedAll(p, !p.isUsed) : p))
    );
  }

  function applyConsume(id: string, amount: number) {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? consume(p, amount) : p))
    );
  }

  function applyRestock(id: string, amount: number) {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? restock(p, amount) : p))
    );
  }

  // 「使う…」「＋追加」用の数値入力（割り切り: prompt）
  function promptAmount(it: BenefitItemV2, kind: "use" | "add"): number | null {
    const unitLabel = it.trackMode === "amount" ? "金額(円)" : "枚数";
    const verb = kind === "use" ? "使う" : "追加する";
    const raw = window.prompt(`${verb}${unitLabel}を入力してください`, "");
    if (raw == null) return null;
    const n = coerceNumber(raw);
    if (n == null || n <= 0) {
      setToast("数値を入力してください");
      return null;
    }
    return n;
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
    if (tab === "overdue") return "期限切れの優待はありません";
    return "まだデータがありません";
  }, [tab]);

  const effectiveViewMode: ViewMode = !hydrated
    ? "table"
    : viewMode ?? (isMobile ? "cards" : "table");

  // ===== layout parts =====
  const header = (
    <div className={styles.headerStack}>
      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>YUTAI BENEFITS</span>
          <h1 className={styles.heroName}>株主優待リスト</h1>
          <p className={styles.heroTitle}>期限切れ前に、使う優待だけを前に出す。</p>
          <p className={styles.heroLead}>
            {formatMonthLabel(now)}の未使用優待を中心に、期限の近いものからさっと確認できます。
            データはこの端末内だけに保存されます。
          </p>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>今月の未使用</span>
            <strong className={styles.statValue} suppressHydrationWarning>
              {thisMonthCount}
            </strong>
            <span className={styles.statHint}>{formatMonthLabel(now)}に使う候補</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>期限切れ注意</span>
            <strong className={styles.statValue} suppressHydrationWarning>
              {overdueCount}
            </strong>
            <span className={styles.statHint}>未使用の期限切れ分</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>期限未設定</span>
            <strong className={styles.statValue} suppressHydrationWarning>
              {noExpiryCount}
            </strong>
            <span className={styles.statHint}>あとで整理したい優待</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>未使用合計額</span>
            <strong className={styles.statValueYen} suppressHydrationWarning>
              {fmtYen(unusedTotalYen)}
            </strong>
            <span className={styles.statHint}>残っている優待の額面合計</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>今月失効する金額</span>
            <strong className={styles.statValueYen} suppressHydrationWarning>
              {fmtYen(expiringThisMonthYen)}
            </strong>
            <span className={styles.statHint}>{formatMonthLabel(now)}に期限切れ</span>
          </div>
        </div>
      </section>

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

          <button
            className={`${styles.tabBtn} ${
              tab === "overdue" ? styles.tabActive : ""
            }`}
            onClick={() => setTab("overdue")}
            type="button"
          >
            期限切れ
            <span className={styles.countPill} suppressHydrationWarning>
              {overdueCount}
            </span>
          </button>
        </div>

        <div className={styles.actionsRow}>
          <div className={`${styles.controlShell} ${styles.searchWrap}`}>
            <input
              className={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索（企業名 / 優待名 / メモ / リンク）"
              aria-label="検索"
            />
            {query && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setQuery("")}
                aria-label="検索をクリア"
              >
                ✕
              </button>
            )}
          </div>

          <div className={styles.compactRow}>
            <label
              className={`${styles.controlShell} ${styles.toggle}`}
            >
              <input
                type="checkbox"
                checked={showUsed}
                onChange={(e) => setShowUsed(e.target.checked)}
                className={styles.toggleInput}
              />
              <span
                className={`${styles.toggleCheck} ${
                  showUsed ? styles.toggleCheckOn : ""
                }`}
                aria-hidden="true"
              />
              <span>使用済含む</span>
            </label>

            <div
              className={`${styles.controlShell} ${styles.selectWrap}`}
            >
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

            <div
              className={`${styles.controlShell} ${styles.segment}`}
            >
              <button
                type="button"
                className={`${styles.segBtn} ${
                  effectiveViewMode === "cards" ? styles.segActive : ""
                }`}
                onClick={() => selectViewMode("cards")}
                aria-label="カード表示"
              >
                カード
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${
                  effectiveViewMode === "table" ? styles.segActive : ""
                }`}
                onClick={() => selectViewMode("table")}
                aria-label="表表示"
              >
                リスト
              </button>
            </div>

            <button
              type="button"
              className={`${styles.controlShell} ${styles.addBtnDesktop}`}
              onClick={openAdd}
            >
              ＋ 追加
            </button>
          </div>

          <div className={styles.mobileControlRow}>
            <div className={`${styles.controlShell} ${styles.selectWrap}`}>
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

            <div className={`${styles.controlShell} ${styles.segment}`}>
              <button
                type="button"
                className={`${styles.segBtn} ${
                  effectiveViewMode === "cards" ? styles.segActive : ""
                }`}
                onClick={() => selectViewMode("cards")}
                aria-label="カード表示"
              >
                <span className={styles.segIcon} aria-hidden="true">
                  ◫
                </span>
                カード
              </button>
              <button
                type="button"
                className={`${styles.segBtn} ${
                  effectiveViewMode === "table" ? styles.segActive : ""
                }`}
                onClick={() => selectViewMode("table")}
                aria-label="表表示"
              >
                <span className={styles.segIcon} aria-hidden="true">
                  ☰
                </span>
                リスト
              </button>
            </div>
          </div>

          <div className={styles.mobileUtilityRow}>
            <label
              className={`${styles.controlShell} ${styles.toggle} ${styles.mobileToggle}`}
            >
              <input
                type="checkbox"
                checked={showUsed}
                onChange={(e) => setShowUsed(e.target.checked)}
                className={styles.toggleInput}
              />
              <span
                className={`${styles.toggleCheck} ${
                  showUsed ? styles.toggleCheckOn : ""
                }`}
                aria-hidden="true"
              />
              <span>使用済含む</span>
            </label>
          </div>
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

                <div className={styles.cardBody}>
                  <div className={styles.kvRow}>
                    <span className={styles.kv}>
                      <b>{remainingText(it)}</b>
                    </span>
                  </div>
                  {it.memo && it.memo.trim() && (
                    <div className={styles.memo}>{it.memo}</div>
                  )}
                  {it.history.length > 0 && (
                    <details className={styles.history}>
                      <summary>履歴（{it.history.length}）</summary>
                      <ul>
                        {[...it.history].reverse().map((h, i) => (
                          <li key={i}>{historyText(h)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>

                {it.link && (
                  <div className={styles.cardBody} style={{ paddingTop: 0 }}>
                    <div className={styles.linkRow}>
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.link}
                        title={it.link}
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
                  {!it.isUsed && it.trackMode === "count" && (
                    <button
                      type="button"
                      className={styles.smallBtn}
                      onClick={() => applyConsume(it.id, 1)}
                    >
                      1枚使う
                    </button>
                  )}
                  {!it.isUsed && (
                    <button
                      type="button"
                      className={styles.smallBtn}
                      onClick={() => {
                        const n = promptAmount(it, "use");
                        if (n != null) applyConsume(it.id, n);
                      }}
                    >
                      使う…
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => {
                      const n = promptAmount(it, "add");
                      if (n != null) applyRestock(it.id, n);
                    }}
                  >
                    ＋追加
                  </button>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => toggleUsed(it.id)}
                  >
                    {it.isUsed ? "未使用に戻す" : "全部使う"}
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
                <th style={{ width: 160 }}>メモ</th>
                <th style={{ width: 260 }}>操作</th>
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
                    <div className={styles.rowSub}>
                      <span>{remainingText(it)}</span>
                    </div>
                    {it.history.length > 0 && (
                      <details className={styles.history}>
                        <summary>履歴（{it.history.length}）</summary>
                        <ul>
                          {[...it.history].reverse().map((h, i) => (
                            <li key={i}>{historyText(h)}</li>
                          ))}
                        </ul>
                      </details>
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
                    <div className={styles.rowActions}>
                      {!it.isUsed && it.trackMode === "count" && (
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => applyConsume(it.id, 1)}
                        >
                          1枚使う
                        </button>
                      )}
                      {!it.isUsed && (
                        <button
                          type="button"
                          className={styles.smallBtn}
                          onClick={() => {
                            const n = promptAmount(it, "use");
                            if (n != null) applyConsume(it.id, n);
                          }}
                        >
                          使う…
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => {
                          const n = promptAmount(it, "add");
                          if (n != null) applyRestock(it.id, n);
                        }}
                      >
                        ＋追加
                      </button>
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => toggleUsed(it.id)}
                      >
                        {it.isUsed ? "未使用に戻す" : "全部使う"}
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
