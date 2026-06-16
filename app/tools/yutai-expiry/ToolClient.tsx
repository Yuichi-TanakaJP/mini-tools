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
  setArchived,
  removeHistoryEntry,
  itemValueYen,
  itemUsedYen,
  itemGrantedYen,
  SCAN_MERGE_NOTE,
  EDIT_ADJUST_NOTE,
  TrackMode,
  UsageEntry,
} from "./benefits/store";

import EditBenefitDialog from "./components/EditBenefitDialog";
import ImportBenefitDialog from "./components/ImportBenefitDialog";
import UsageDialog from "./components/UsageDialog";
import CameraScanButton from "./components/CameraScanButton";
import type { ScanResult } from "./scan-utils";

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

function isExpired(it: BenefitItemV2, today: string): boolean {
  return !!it.expiresOn && it.expiresOn < today;
}

function isArchived(it: BenefitItemV2): boolean {
  return !!it.archivedAt;
}

function StatTile({
  label,
  value,
  variant = "yen",
  positive = false,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  variant?: "yen" | "num";
  positive?: boolean;
  hint?: string;
}) {
  const valueClass = [
    variant === "num" ? styles.statTileValueNum : styles.statTileValue,
    positive ? styles.statTileValuePositive : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={styles.statTile} title={hint}>
      <span className={styles.statTileLabel}>{label}</span>
      <strong className={valueClass} suppressHydrationWarning>
        {value}
      </strong>
    </div>
  );
}

function remainingText(it: BenefitItemV2): string {
  const rem = it.remaining ?? 0;
  if (it.trackMode === "amount") return `残高 ${fmtYen(rem)}`;
  const base = `残${rem}枚`;
  if (it.unitYen != null)
    return `${base} ×${fmtYen(it.unitYen)}（合計 ${fmtYen(itemValueYen(it))}）`;
  return base;
}

function itemTotalsText(it: BenefitItemV2): string | null {
  // 額面未設定の count アイテムは yen 換算不可。乖離理由を明示する。
  if (it.trackMode === "count" && it.unitYen == null) {
    const hasActivity = (it.initial ?? 0) > 0 || it.history.length > 0;
    return hasActivity ? "額面未設定のため累計金額に反映されません" : null;
  }
  const granted = itemGrantedYen(it);
  const used = itemUsedYen(it);
  if (granted === 0 && used === 0) return null;
  return `もらった ${fmtYen(granted)} ／ 使った ${fmtYen(used)}`;
}

type DuplicateMatch = {
  item: BenefitItemV2;
  // restock 量。null なら統合不可（スキャン情報不足）
  restockQty: number | null;
  restockYen: number | null;
  hint: string;
};

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function findScanDuplicates(
  items: BenefitItemV2[],
  s: ScanResult
): DuplicateMatch[] {
  const sc = normalizeKey(s.company ?? "");
  const st = normalizeKey(s.title ?? "");
  if (!sc || !st) return [];
  const today = todayISODate();
  return items
    .filter(
      (it) =>
        normalizeKey(it.company) === sc && normalizeKey(it.title) === st
    )
    .sort((a, b) => {
      // 未期限切れ → 期限切れ、その上で期限が近いものを優先
      const aExp = !!a.expiresOn && a.expiresOn < today;
      const bExp = !!b.expiresOn && b.expiresOn < today;
      if (aExp !== bExp) return aExp ? 1 : -1;
      const ae = a.expiresOn ?? "9999-12-31";
      const be = b.expiresOn ?? "9999-12-31";
      return ae < be ? -1 : ae > be ? 1 : 0;
    })
    .map((item): DuplicateMatch => {
      if (item.trackMode === "amount") {
        if (s.amountYen != null && s.amountYen > 0) {
          return {
            item,
            restockQty: null,
            restockYen: s.amountYen,
            hint: `残高に +${fmtYen(s.amountYen)} を追加`,
          };
        }
        return {
          item,
          restockQty: null,
          restockYen: null,
          hint: "金額未取得のため統合不可（新規追加してください）",
        };
      }
      if (s.quantity != null && s.quantity > 0) {
        return {
          item,
          restockQty: s.quantity,
          restockYen: null,
          hint: `+${s.quantity} 枚を既存に追加`,
        };
      }
      if (
        s.amountYen != null &&
        s.amountYen > 0 &&
        item.unitYen != null &&
        item.unitYen > 0
      ) {
        const qty = Math.floor(s.amountYen / item.unitYen);
        if (qty > 0) {
          return {
            item,
            restockQty: qty,
            restockYen: null,
            hint: `+${qty} 枚を追加（${fmtYen(s.amountYen)} ÷ @${fmtYen(item.unitYen)}）`,
          };
        }
      }
      return {
        item,
        restockQty: null,
        restockYen: null,
        hint: "枚数未取得のため統合不可（新規追加してください）",
      };
    });
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

function scanResultToDraft(s: ScanResult): Draft {
  const hasQty = s.quantity != null && s.quantity > 0;
  const hasAmt = s.amountYen != null && s.amountYen > 0;
  // 枚数が読めれば count、金額のみなら amount、どちらも無ければ count を初期に
  const mode: TrackMode = hasQty ? "count" : hasAmt ? "amount" : "count";
  return {
    title: s.title ?? "",
    company: s.company ?? "",
    expiresOn: s.expiresOn ?? "",
    trackMode: mode,
    qty: mode === "count" && hasQty ? String(s.quantity) : "",
    unitYen: mode === "count" && hasAmt ? String(s.amountYen) : "",
    balanceYen: mode === "amount" && hasAmt ? String(s.amountYen) : "",
    memo: "",
    link: "",
  };
}

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
    // qty > 0 のとき 1 枚あたり額面は必須（未設定だと金額集計に反映されないため）
    if (q > 0 && !d.unitYen.trim()) {
      return {
        ok: false,
        message:
          "1枚あたり額面を入力してください。額面が不明な場合は『金額モード』に切り替えてください。",
      };
    }
    if (d.unitYen.trim()) {
      const u = coerceNumber(d.unitYen);
      if (u == null || u <= 0)
        return {
          ok: false,
          message: "1枚あたり額面は 0 より大きい数値で入力してください。",
        };
    }
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


type Props = {
  // 画像スキャン機能を露出するかどうか。page.tsx 側で premium セッションを
  // 検証して渡す。サーバー側 API も同じ認証で gate されているため、
  // 仮にクライアント側で書き換えても 404 が返る。
  scanEnabled?: boolean;
};

export default function ToolClient({ scanEnabled = false }: Props) {
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
  // アーカイブ済みは既定で非表示。トグルで一覧に含められる。
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("expiryAsc");
  const [query, setQuery] = useState("");

  type ToastState = { message: string; action?: { label: string; onClick: () => void } };
  const [toast, setToast] = useState<ToastState | null>(null);

  // 単一アイテムを変更前のスナップショットに戻す。Undo Toast 用。
  function restoreItemSnapshot(snapshot: BenefitItemV2) {
    setItems((prev) => prev.map((p) => (p.id === snapshot.id ? snapshot : p)));
  }

  function showUndoableToast(message: string, snapshot: BenefitItemV2) {
    setToast({
      message,
      action: {
        label: "取り消す",
        onClick: () => {
          restoreItemSnapshot(snapshot);
          setToast({ message: "操作を取り消しました" });
        },
      },
    });
  }

  // dialogs
  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const importDialogRef = useRef<HTMLDialogElement | null>(null);
  const usageDialogRef = useRef<HTMLDialogElement | null>(null);
  const scanDupDialogRef = useRef<HTMLDialogElement | null>(null);
  const [scanDup, setScanDup] = useState<{
    scan: ScanResult;
    model: string | null;
    matches: DuplicateMatch[];
  } | null>(null);

  const [editMode, setEditMode] = useState<"add" | "edit">("add");
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [draftError, setDraftError] = useState<string | null>(null);

  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // 使う / ＋追加 ダイアログ状態
  const [usageTarget, setUsageTarget] = useState<{
    itemId: string;
    kind: "use" | "add";
  } | null>(null);
  const [usageAmount, setUsageAmount] = useState("");
  const [usageAmountYen, setUsageAmountYen] = useState("");
  const [usageNote, setUsageNote] = useState("");
  const [usageError, setUsageError] = useState<string | null>(null);

  // --- derived ---
  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKey(now);
  const nextMonthStart = startOfNextMonth(now);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = todayISODate();

    const base = items.filter((it) => {
      // アーカイブ済みは既定で隠す（「アーカイブを含む」ON のときだけ出す）
      if (!showArchived && isArchived(it)) return false;
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
        return isExpired(it, today);
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
  }, [
    items,
    showUsed,
    showArchived,
    query,
    tab,
    sortKey,
    thisMonthKey,
    nextMonthStart,
  ]);

  const thisMonthCount = useMemo(() => {
    return items.filter((it) => {
      if (isArchived(it)) return false;
      if (it.isUsed) return false; // “基本表示：未使用だけ” の数字に寄せる
      if (!it.expiresOn) return false;
      return isSameMonth(parseLocalDate(it.expiresOn), now);
    }).length;
  }, [items, now]);

  const laterCount = useMemo(() => {
    return items.filter((it) => {
      if (isArchived(it)) return false;
      if (it.isUsed) return false;
      if (!it.expiresOn) return false;
      return parseLocalDate(it.expiresOn).getTime() >= nextMonthStart.getTime();
    }).length;
  }, [items, nextMonthStart]);

  const allCount = useMemo(() => {
    return items.filter((it) => !isArchived(it) && !it.isUsed).length;
  }, [items]);

  const overdueCount = useMemo(() => {
    const today = todayISODate();
    return items.filter(
      (it) => !isArchived(it) && !it.isUsed && isExpired(it, today)
    ).length;
  }, [items]);

  const noExpiryCount = useMemo(() => {
    return items.filter((it) => !isArchived(it) && !it.isUsed && !it.expiresOn)
      .length;
  }, [items]);

  // アーカイブ済み件数（トグルの横に出して存在を可視化する）
  const archivedCount = useMemo(() => {
    return items.filter((it) => isArchived(it)).length;
  }, [items]);

  const unusedTotalYen = useMemo(() => {
    const today = todayISODate();
    return items.reduce((sum, it) => {
      if (isArchived(it) || it.isUsed || isExpired(it, today)) return sum;
      return sum + itemValueYen(it);
    }, 0);
  }, [items]);

  const expiringThisMonthYen = useMemo(() => {
    return items.reduce((sum, it) => {
      if (isArchived(it) || it.isUsed || !it.expiresOn) return sum;
      if (!isSameMonth(parseLocalDate(it.expiresOn), now)) return sum;
      return sum + itemValueYen(it);
    }, 0);
  }, [items, now]);

  // 累計（生涯記録）はアーカイブ済みも含める。一度確定した「もらった/使った/失効」は
  // 退避しても記録として残し、`もらった − 使った − 失効 = 未使用` の関係を保つ。
  const expiredTotalYen = useMemo(() => {
    const today = todayISODate();
    return items.reduce((sum, it) => {
      if (it.isUsed || !isExpired(it, today)) return sum;
      return sum + itemValueYen(it);
    }, 0);
  }, [items]);

  const usedTotalYen = useMemo(() => {
    return items.reduce((sum, it) => sum + itemUsedYen(it), 0);
  }, [items]);

  const grantedTotalYen = useMemo(() => {
    return items.reduce((sum, it) => sum + itemGrantedYen(it), 0);
  }, [items]);

  // 額面未設定の count アイテム数（金額集計に反映されない既存データの救済導線）
  const missingUnitYenCount = useMemo(() => {
    return items.filter(
      (it) =>
        !isArchived(it) &&
        it.trackMode === "count" &&
        it.unitYen == null &&
        (it.initial ?? 0) > 0
    ).length;
  }, [items]);

  function openFirstMissingUnitYen() {
    const target = items.find(
      (it) =>
        !isArchived(it) &&
        it.trackMode === "count" &&
        it.unitYen == null &&
        (it.initial ?? 0) > 0
    );
    if (target) openEdit(target);
  }

  // --- actions ---
  function openAdd() {
    setEditMode("add");
    setDraft(toDraft());
    setDraftError(null);
    editDialogRef.current?.showModal();
  }

  function openAddFromScan(s: ScanResult, model: string | null) {
    const matches = findScanDuplicates(items, s);
    if (matches.length > 0) {
      setScanDup({ scan: s, model, matches });
      scanDupDialogRef.current?.showModal();
      return;
    }
    proceedAddFromScan(s, model);
  }

  function proceedAddFromScan(s: ScanResult, model: string | null) {
    setEditMode("add");
    setDraft(scanResultToDraft(s));
    setDraftError(null);
    editDialogRef.current?.showModal();
    const conf = (s.confidence * 100).toFixed(0);
    const modelLabel = model ? ` / ${model}` : "";
    setToast({ message: `スキャン結果を反映しました（確信度 ${conf}%${modelLabel}）` });
  }

  function mergeIntoExisting(match: DuplicateMatch) {
    const snapshot = items.find((p) => p.id === match.item.id);
    if (!snapshot) return;
    const amount =
      match.restockYen != null ? match.restockYen : match.restockQty ?? 0;
    if (amount <= 0) return;
    applyRestock(match.item.id, amount, SCAN_MERGE_NOTE);
    scanDupDialogRef.current?.close();
    setScanDup(null);
    showUndoableToast(`「${match.item.title}」に追加しました`, snapshot);
  }

  function dismissScanDup(addAsNew: boolean) {
    const pending = scanDup;
    scanDupDialogRef.current?.close();
    setScanDup(null);
    if (addAsNew && pending) {
      proceedAddFromScan(pending.scan, pending.model);
    }
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
      // 編集時は initial / history / createdAt を保全（残のみユーザー編集を反映）。
      // ただしモード(枚数/金額)を変えた場合は単位が変わるので initial を新値で取り直す。
      const keepInitial =
        prevItem && prevItem.trackMode === draft.trackMode;
      // 編集で remaining が変わった場合は履歴に差分を記録して集計の整合を保つ。
      // 例: 残高 0 → 3000 に編集すると history += {+3000, "編集による補正"} となり
      // 「もらった」も +3000 される（restock と同等扱い）。
      const adjustedHistory = (() => {
        if (!keepInitial || !prevItem || remainingInput == null)
          return keepInitial ? prevItem!.history : [];
        const prevRem = prevItem.remaining ?? 0;
        const delta = remainingInput - prevRem;
        if (delta === 0) return prevItem.history;
        const entry: UsageEntry =
          draft.trackMode === "amount"
            ? { at: nowIso, deltaYen: delta, note: EDIT_ADJUST_NOTE }
            : { at: nowIso, deltaQty: delta, note: EDIT_ADJUST_NOTE };
        return [...prevItem.history, entry];
      })();
      const built = coerceItem({
        id,
        title: draft.title.trim(),
        company: draft.company.trim(),
        expiresOn,
        trackMode: draft.trackMode,
        unitYen,
        initial: keepInitial ? prevItem!.initial : remainingInput,
        remaining: remainingInput,
        history: adjustedHistory,
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
    setToast({ message: editMode === "add" ? "追加しました" : "更新しました" });
  }

  function toggleUsed(id: string) {
    const snapshot = items.find((p) => p.id === id);
    if (!snapshot) return;
    setItems((prev) =>
      prev.map((p) => (p.id === id ? setUsedAll(p, !p.isUsed) : p))
    );
    const message = snapshot.isUsed ? "未使用に戻しました" : "全部使ったとして記録しました";
    showUndoableToast(message, snapshot);
  }

  function toggleArchived(id: string) {
    const snapshot = items.find((p) => p.id === id);
    if (!snapshot) return;
    const willArchive = !isArchived(snapshot);
    setItems((prev) =>
      prev.map((p) => (p.id === id ? setArchived(p, willArchive) : p))
    );
    // アーカイブ直後は既定で一覧から消えるので、Undo を出して誤操作を可逆にする。
    const message = willArchive
      ? "アーカイブしました"
      : "アーカイブを解除しました";
    showUndoableToast(message, snapshot);
  }

  function applyConsume(id: string, amount: number, note?: string) {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? consume(p, amount, note) : p))
    );
  }

  function applyRestock(id: string, amount: number, note?: string) {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? restock(p, amount, note) : p))
    );
  }

  function openUsage(it: BenefitItemV2, kind: "use" | "add") {
    setUsageTarget({ itemId: it.id, kind });
    setUsageAmount("");
    setUsageAmountYen("");
    setUsageNote("");
    setUsageError(null);
    usageDialogRef.current?.showModal();
  }

  function submitUsage() {
    if (!usageTarget) return;
    const item = items.find((p) => p.id === usageTarget.itemId);
    if (!item) return;

    const baseNote = usageNote.trim();
    let amount: number | null = null;
    let extraNote = "";

    if (item.trackMode === "count") {
      const qty = coerceNumber(usageAmount);
      const yen = coerceNumber(usageAmountYen);
      if (yen != null && yen > 0) {
        // 金額入力を優先（unitYen で枚数換算）
        if (!(item.unitYen && item.unitYen > 0)) {
          setUsageError(
            "1枚あたり額面が未設定です。編集で設定するか、枚数で入力してください。"
          );
          return;
        }
        const derived = Math.round(yen / item.unitYen);
        if (derived <= 0) {
          setUsageError("換算した枚数が0です。金額または額面を見直してください。");
          return;
        }
        // 「使う」で残量超過は履歴の整合性を壊すので弾く（追加側は青天井OK）
        if (
          usageTarget.kind === "use" &&
          derived > (item.remaining ?? 0)
        ) {
          setUsageError(
            `残${item.remaining ?? 0}枚を超えています（換算 ${derived}枚）。金額を見直してください。`
          );
          return;
        }
        amount = derived;
        extraNote = `¥${yen.toLocaleString()} 相当（@¥${item.unitYen.toLocaleString()} → ${derived}枚）`;
      } else if (qty != null && qty > 0) {
        amount = qty;
      } else {
        setUsageError("枚数または金額を入力してください（0より大きい）。");
        return;
      }
    } else {
      const yen = coerceNumber(usageAmount);
      if (yen == null || yen <= 0) {
        setUsageError("金額を入力してください（0より大きい）。");
        return;
      }
      amount = yen;
    }

    const note =
      baseNote && extraNote
        ? `${baseNote} / ${extraNote}`
        : baseNote || extraNote || undefined;

    const snapshot = items.find((p) => p.id === usageTarget.itemId);
    if (usageTarget.kind === "use") {
      applyConsume(usageTarget.itemId, amount, note);
      if (snapshot) showUndoableToast("使用を記録しました", snapshot);
    } else {
      applyRestock(usageTarget.itemId, amount, note);
      if (snapshot) showUndoableToast("追加しました", snapshot);
    }
    usageDialogRef.current?.close();
  }

  function removeHistoryAt(id: string, index: number) {
    const snapshot = items.find((p) => p.id === id);
    if (!snapshot) return;
    setItems((prev) =>
      prev.map((p) => (p.id === id ? removeHistoryEntry(p, index) : p))
    );
    showUndoableToast("履歴を取り消しました", snapshot);
  }

  function removeItem(id: string) {
    const snapshot = items.find((p) => p.id === id);
    if (!snapshot) return;
    const snapshotIndex = items.findIndex((p) => p.id === id);
    setItems((prev) => prev.filter((p) => p.id !== id));
    setToast({
      message: "削除しました",
      action: {
        label: "取り消す",
        onClick: () => {
          setItems((prev) => {
            const next = [...prev];
            next.splice(snapshotIndex, 0, snapshot);
            return next;
          });
          setToast({ message: "削除を取り消しました" });
        },
      },
    });
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
      setToast({
        message: merge ? "インポート（統合）しました" : "インポート（置換）しました",
      });
    } catch {
      setImportError("JSONの形式が正しくありません。");
    }
  }

  // toast auto clear（取り消しボタン付きは長め）
  useEffect(() => {
    if (!toast) return;
    const duration = toast.action ? 5000 : 1600;
    const t = window.setTimeout(() => setToast(null), duration);
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

        <div className={styles.statDashboard}>
          <div className={styles.statDashHeadline}>
            <span className={styles.statDashHeadlineLabel}>未使用合計額</span>
            <strong className={styles.statDashHeadlineValue} suppressHydrationWarning>
              {fmtYen(unusedTotalYen)}
            </strong>
            <span className={styles.statDashHeadlineHint}>残っている優待の額面合計</span>
          </div>

          <div className={`${styles.statDashRow} ${styles.statDashRowWide}`}>
            <StatTile
              label="もらった"
              value={fmtYen(grantedTotalYen)}
              hint="累計（アーカイブ済みも含む）"
            />
            <StatTile
              label="使った"
              value={fmtYen(usedTotalYen)}
              positive
              hint="累計（アーカイブ済みも含む）"
            />
            <StatTile
              label="失効"
              value={fmtYen(expiredTotalYen)}
              hint="累計（アーカイブ済みも含む）"
            />
            <StatTile label="今月失効" value={fmtYen(expiringThisMonthYen)} />
          </div>

          <div className={styles.statDashDivider} />

          <div className={styles.statDashRow}>
            <StatTile label="今月の未使用" value={thisMonthCount} variant="num" />
            <StatTile label="期限切れ" value={overdueCount} variant="num" />
            <StatTile label="期限未設定" value={noExpiryCount} variant="num" />
          </div>
        </div>

        {missingUnitYenCount > 0 && (
          <button
            type="button"
            className={styles.unitYenBanner}
            onClick={openFirstMissingUnitYen}
          >
            <span className={styles.unitYenBannerLabel}>
              額面未設定の優待が <b>{missingUnitYenCount}</b> 件あります
            </span>
            <span className={styles.unitYenBannerHint}>
              金額集計に反映されていません ・ タップで修正 →
            </span>
          </button>
        )}
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

            <label
              className={`${styles.controlShell} ${styles.toggle}`}
            >
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className={styles.toggleInput}
              />
              <span
                className={`${styles.toggleCheck} ${
                  showArchived ? styles.toggleCheckOn : ""
                }`}
                aria-hidden="true"
              />
              <span>
                アーカイブを含む
                {archivedCount > 0 && (
                  <span className={styles.countPill} suppressHydrationWarning>
                    {archivedCount}
                  </span>
                )}
              </span>
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

            {scanEnabled && (
              <>
                <CameraScanButton
                  mode="camera"
                  className={`${styles.controlShell} ${styles.addBtnDesktop}`}
                  onResult={openAddFromScan}
                  onError={(m) => setToast({ message: m })}
                />
                <CameraScanButton
                  mode="gallery"
                  className={`${styles.controlShell} ${styles.addBtnDesktop}`}
                  onResult={openAddFromScan}
                  onError={(m) => setToast({ message: m })}
                />
              </>
            )}
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

            <label
              className={`${styles.controlShell} ${styles.toggle} ${styles.mobileToggle}`}
            >
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className={styles.toggleInput}
              />
              <span
                className={`${styles.toggleCheck} ${
                  showArchived ? styles.toggleCheckOn : ""
                }`}
                aria-hidden="true"
              />
              <span>
                アーカイブ
                {archivedCount > 0 && (
                  <span className={styles.countPill} suppressHydrationWarning>
                    {archivedCount}
                  </span>
                )}
              </span>
            </label>

            {scanEnabled && (
              <>
                <CameraScanButton
                  mode="camera"
                  className={`${styles.controlShell} ${styles.mobileToggle}`}
                  onResult={openAddFromScan}
                  onError={(m) => setToast({ message: m })}
                />
                <CameraScanButton
                  mode="gallery"
                  className={`${styles.controlShell} ${styles.mobileToggle}`}
                  onResult={openAddFromScan}
                  onError={(m) => setToast({ message: m })}
                />
              </>
            )}
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
                className={`${styles.card} ${
                  it.isUsed || isArchived(it) ? styles.cardUsed : ""
                }`}
              >
                <div className={styles.cardTop}>
                  <div className={styles.cardTitleRow}>
                    <div className={styles.cardTitle}>{it.title}</div>
                    {isArchived(it) && (
                      <span className={`${styles.badge} ${styles.badgeMuted}`}>
                        アーカイブ済
                      </span>
                    )}
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
                  {itemTotalsText(it) && (
                    <div className={styles.itemTotals}>{itemTotalsText(it)}</div>
                  )}
                  {it.memo && it.memo.trim() && (
                    <div className={styles.memo}>{it.memo}</div>
                  )}
                  {it.history.length > 0 && (
                    <details className={styles.history}>
                      <summary>履歴（{it.history.length}）</summary>
                      <ul>
                        {it.history
                          .map((h, idx) => ({ h, idx }))
                          .slice()
                          .reverse()
                          .map(({ h, idx }) => (
                            <li key={idx} className={styles.historyItem}>
                              <span>{historyText(h)}</span>
                              <button
                                type="button"
                                className={styles.historyDel}
                                onClick={() => removeHistoryAt(it.id, idx)}
                                aria-label="この履歴を取り消す"
                                title="この履歴を取り消す（残量を巻き戻す）"
                              >
                                ✕
                              </button>
                            </li>
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
                          setToast({
                            message: ok
                              ? "リンクをコピーしました"
                              : "コピーに失敗しました",
                          });
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
                      onClick={() => openUsage(it, "use")}
                    >
                      使う…
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.smallBtn}
                    onClick={() => openUsage(it, "add")}
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
                    className={styles.smallBtn}
                    onClick={() => toggleArchived(it.id)}
                  >
                    {isArchived(it) ? "アーカイブ解除" : "アーカイブ"}
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
                <tr
                  key={it.id}
                  className={
                    it.isUsed || isArchived(it) ? styles.rowUsed : ""
                  }
                >
                  <td className={styles.mono}>
                    {it.expiresOn ? fmtJPDate(it.expiresOn) : "—"}
                  </td>
                  <td>
                    <div className={styles.rowTitle}>{it.title}</div>
                    <div className={styles.rowSub}>
                      <span>{remainingText(it)}</span>
                    </div>
                    {itemTotalsText(it) && (
                      <div className={styles.itemTotals}>{itemTotalsText(it)}</div>
                    )}
                    {it.history.length > 0 && (
                      <details className={styles.history}>
                        <summary>履歴（{it.history.length}）</summary>
                        <ul>
                          {it.history
                            .map((h, idx) => ({ h, idx }))
                            .slice()
                            .reverse()
                            .map(({ h, idx }) => (
                              <li key={idx} className={styles.historyItem}>
                                <span>{historyText(h)}</span>
                                <button
                                  type="button"
                                  className={styles.historyDel}
                                  onClick={() =>
                                    removeHistoryAt(it.id, idx)
                                  }
                                  aria-label="この履歴を取り消す"
                                  title="この履歴を取り消す（残量を巻き戻す）"
                                >
                                  ✕
                                </button>
                              </li>
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
                            setToast({
                              message: ok
                                ? "リンクをコピーしました"
                                : "コピーに失敗しました",
                            });
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          コピー
                        </button>
                      </div>
                    )}
                  </td>
                  <td>{it.company}</td>
                  <td>
                    {it.isUsed ? "使用済み" : "未使用"}
                    {isArchived(it) && (
                      <span className={styles.rowSub}>アーカイブ済</span>
                    )}
                  </td>
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
                          onClick={() => openUsage(it, "use")}
                        >
                          使う…
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => openUsage(it, "add")}
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
                        className={styles.smallBtn}
                        onClick={() => toggleArchived(it.id)}
                      >
                        {isArchived(it) ? "アーカイブ解除" : "アーカイブ"}
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

      {/* Use / +Add dialog */}
      <UsageDialog
        dialogRef={usageDialogRef}
        item={
          usageTarget
            ? items.find((p) => p.id === usageTarget.itemId) ?? null
            : null
        }
        kind={usageTarget?.kind ?? "use"}
        amount={usageAmount}
        setAmount={setUsageAmount}
        amountYen={usageAmountYen}
        setAmountYen={setUsageAmountYen}
        note={usageNote}
        setNote={setUsageNote}
        error={usageError}
        onSubmit={submitUsage}
      />

      {/* Scan duplicate dialog */}
      <dialog ref={scanDupDialogRef} className={styles.dialog}>
        <form
          method="dialog"
          className={styles.dialogInner}
          onSubmit={(e) => {
            e.preventDefault();
            dismissScanDup(false);
          }}
        >
          <div className={styles.dialogHeader}>
            <h2 className={styles.dialogTitle}>同じ優待が登録済み</h2>
          </div>
          <div className={styles.formGrid}>
            {scanDup && (
              <>
                <p className={styles.dupLead}>
                  <b>{scanDup.scan.company ?? ""}</b> /{" "}
                  <b>{scanDup.scan.title ?? ""}</b> と一致する優待が既にあります。
                  どうしますか？
                </p>
                <p className={styles.dupScan}>
                  スキャン結果:
                  {scanDup.scan.quantity != null
                    ? ` ${scanDup.scan.quantity} 枚`
                    : ""}
                  {scanDup.scan.amountYen != null
                    ? ` / ${fmtYen(scanDup.scan.amountYen)}`
                    : ""}
                  {scanDup.scan.expiresOn
                    ? ` / 期限 ${fmtJPDate(scanDup.scan.expiresOn)}`
                    : ""}
                </p>
                <ul className={styles.dupList}>
                  {scanDup.matches.map((m) => {
                    const canRestock =
                      (m.restockQty != null && m.restockQty > 0) ||
                      (m.restockYen != null && m.restockYen > 0);
                    return (
                      <li key={m.item.id} className={styles.dupItem}>
                        <div className={styles.dupItemTitle}>{m.item.title}</div>
                        <div className={styles.dupItemMeta}>
                          {remainingText(m.item)}
                          {m.item.expiresOn
                            ? ` ・ 期限 ${fmtJPDate(m.item.expiresOn)}`
                            : ""}
                        </div>
                        <div className={styles.dupItemHint}>{m.hint}</div>
                        {canRestock && (
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={() => mergeIntoExisting(m)}
                          >
                            これに統合する
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          <div className={styles.dialogFooter}>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => dismissScanDup(false)}
            >
              キャンセル
            </button>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => dismissScanDup(true)}
            >
              別アイテムとして追加
            </button>
          </div>
        </form>
      </dialog>

      {/* toast */}
      {toast && (
        <div className={styles.toast} role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.toastAction}
              onClick={toast.action.onClick}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </>
  );

  const showMobile = hydrated && isMobile;

  return showMobile ? (
    <MobileLayout header={header} list={list} footer={footer} />
  ) : (
    <DesktopLayout header={header} list={list} footer={footer} />
  );
}
