"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TabBar from "@/app/tools/_shared/TabBar";
import { loadItems, newId, saveItems } from "./storage";
import { mergeItems, parseBackupItems, serializeBackup } from "./backup";
import { useStockMaster } from "./useStockMaster";
import type {
  MyStockItem,
  MyStocksReference,
  StockAccountType,
  StockListTab,
  StockMaster,
} from "./types";

type Props = {
  reference: MyStocksReference;
};

type ViewTab = StockListTab | "master";
type HoldingViewMode = "list" | "account" | "ratio";
type AccountGroupKey = "specific" | "nisa" | "other";

const TAB_LABELS: Record<StockListTab, string> = {
  holding: "保有メモ",
  watch: "ウォッチ",
};
const VIEW_TAB_LABELS: Record<ViewTab, string> = {
  ...TAB_LABELS,
  master: "銘柄一覧",
};
const VIEW_TAB_OPTIONS = [
  VIEW_TAB_LABELS.holding,
  VIEW_TAB_LABELS.watch,
  VIEW_TAB_LABELS.master,
] as const;
const HOLDING_VIEW_OPTIONS: Array<{ mode: HoldingViewMode; label: string }> = [
  { mode: "list", label: "一覧" },
  { mode: "account", label: "口座別" },
  { mode: "ratio", label: "比率" },
];
const ACCOUNT_OPTIONS: Array<{ type: StockAccountType | ""; label: string }> = [
  { type: "", label: "口座未設定" },
  { type: "specific", label: "特定預り" },
  { type: "nisa-growth", label: "NISA成長" },
  { type: "nisa-tsumitate", label: "NISAつみたて" },
  { type: "old-nisa", label: "旧NISA" },
  { type: "general", label: "一般預り" },
  { type: "other", label: "その他" },
];

const ACCOUNT_GROUPS: Array<{ key: AccountGroupKey; label: string; color: string }> = [
  { key: "specific", label: "特定", color: "#2563eb" },
  { key: "nisa", label: "NISA", color: "#16a34a" },
  { key: "other", label: "その他・未設定", color: "#d97706" },
];

const STOCK_CHART_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2"];
const UNDO_MS = 5000;
const MASTER_PAGE_SIZE = 50;

function formatEarnings(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[1])}/${Number(m[2])}`;
}

function formatDividend(dividend: MyStocksReference["dividendByCode"][string]): string {
  const yieldText = `${dividend.yieldPct.toFixed(2)}%`;
  if (dividend.perShare === null) return yieldText;
  return `${yieldText} / ${dividend.perShare.toLocaleString("ja-JP")}円`;
}

function accountMergeKey(item: MyStockItem): string {
  if (item.tab !== "holding") return `${item.tab}:${item.code}`;
  return `${item.tab}:${item.code}:${item.accountType ?? item.accountLabel ?? ""}`;
}

function accountLabel(item: MyStockItem): string | null {
  if (item.accountLabel) return item.accountLabel;
  return ACCOUNT_OPTIONS.find((option) => option.type === item.accountType)?.label ?? null;
}

function accountGroupKey(item: MyStockItem): AccountGroupKey {
  if (item.accountType === "specific") return "specific";
  if (
    item.accountType === "nisa-growth" ||
    item.accountType === "nisa-tsumitate" ||
    item.accountType === "old-nisa"
  ) {
    return "nisa";
  }
  return "other";
}

function nextAccountForDuplicate(existing: MyStockItem[]): StockAccountType | null {
  const used = new Set(existing.map((item) => item.accountType ?? null));
  const preferred: StockAccountType[] = ["specific", "nisa-growth", "nisa-tsumitate", "old-nisa"];
  return preferred.find((type) => !used.has(type)) ?? null;
}

function addableAccountOptions(existing: MyStockItem[]): Array<{ type: StockAccountType; label: string }> {
  const used = new Set(existing.map((item) => item.accountType ?? null));
  return ACCOUNT_OPTIONS.filter(
    (option): option is { type: StockAccountType; label: string } =>
      option.type !== "" && !used.has(option.type),
  );
}

function acquisitionAmount(item: MyStockItem): number | null {
  if (item.tab !== "holding") return null;
  if (typeof item.quantity !== "number" || typeof item.acquisitionPrice !== "number") return null;
  if (!Number.isFinite(item.quantity) || !Number.isFinite(item.acquisitionPrice)) return null;
  if (item.quantity <= 0 || item.acquisitionPrice <= 0) return null;
  return item.quantity * item.acquisitionPrice;
}

function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ToolClient({ reference }: Props) {
  const [items, setItems] = useState<MyStockItem[]>(() => loadItems());
  const [tab, setTab] = useState<ViewTab>("holding");
  const [holdingViewMode, setHoldingViewMode] = useState<HoldingViewMode>("list");
  const [query, setQuery] = useState("");
  const [masterPage, setMasterPage] = useState(0);
  const [newHoldingAccountType, setNewHoldingAccountType] = useState<StockAccountType | "">("");
  const [addAccountDrafts, setAddAccountDrafts] = useState<Record<string, StockAccountType | "">>(
    {},
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<MyStockItem | null>(null);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pasteImportText, setPasteImportText] = useState("");
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const master = useStockMaster(reference.stockMaster);

  useEffect(() => {
    if (tab === "master") setMasterPage(0);
  }, [query, tab]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  function persist(next: MyStockItem[]) {
    setItems(next);
    saveItems(next);
  }

  function flashNotice(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }

  const tabItems = useMemo(
    () =>
      tab === "master"
        ? []
        : items.filter((it) => it.tab === tab).sort((a, b) => b.addedAt - a.addedAt),
    [items, tab],
  );

  const candidates = useMemo(() => master.search(query, 20), [master, query]);
  const masterRows = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return master.all;
    const lower = trimmed.toLowerCase();
    const isCodeLike = /^[0-9a-zA-Z]+$/.test(trimmed);
    return master.all.filter(
      (stock) =>
        (isCodeLike && stock.code.toLowerCase().startsWith(lower)) ||
        stock.name.toLowerCase().includes(lower),
    );
  }, [master, query]);
  const masterPageCount = Math.max(1, Math.ceil(masterRows.length / MASTER_PAGE_SIZE));
  const boundedMasterPage = Math.min(masterPage, masterPageCount - 1);
  const masterPageRows = masterRows.slice(
    boundedMasterPage * MASTER_PAGE_SIZE,
    boundedMasterPage * MASTER_PAGE_SIZE + MASTER_PAGE_SIZE,
  );

  function addStock(stock: StockMaster, targetTab: StockListTab = tab === "master" ? "watch" : tab) {
    const nextAccountOption = ACCOUNT_OPTIONS.find(
      (option) => option.type === newHoldingAccountType,
    );
    const nextKey =
      targetTab === "holding"
        ? `holding:${stock.code}:${newHoldingAccountType}`
        : `watch:${stock.code}`;
    const exists = items.some((it) => accountMergeKey(it) === nextKey);
    if (exists) {
      flashNotice(`${stock.name} はすでに「${TAB_LABELS[targetTab]}」にあります`);
      return;
    }
    const now = Date.now();
    const item: MyStockItem = {
      id: newId(),
      code: stock.code,
      name: stock.name,
      market: stock.market,
      sector: stock.sector,
      tab: targetTab,
      accountType: targetTab === "holding" ? newHoldingAccountType || null : undefined,
      accountLabel:
        targetTab === "holding" && newHoldingAccountType
          ? nextAccountOption?.label ?? null
          : undefined,
      quantity: targetTab === "holding" ? null : undefined,
      acquisitionPrice: targetTab === "holding" ? null : undefined,
      memo: "",
      addedAt: now,
      updatedAt: now,
    };
    persist([item, ...items]);
    if (tab !== "master") setQuery("");
    flashNotice(`${stock.name} を「${TAB_LABELS[targetTab]}」に追加しました`);
  }

  function updateItem(id: string, patch: Partial<MyStockItem>) {
    const target = items.find((it) => it.id === id);
    if (
      target?.tab === "holding" &&
      ("accountType" in patch || "accountLabel" in patch)
    ) {
      const nextItem = { ...target, ...patch };
      const nextKey = accountMergeKey(nextItem);
      const exists = items.some((it) => it.id !== id && accountMergeKey(it) === nextKey);
      if (exists) {
        flashNotice(`${target.name} は同じ口座区分ですでにあります`);
        return;
      }
    }
    persist(
      items.map((it) => (it.id === id ? { ...it, ...patch, updatedAt: Date.now() } : it)),
    );
  }

  function removeItem(id: string) {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    persist(items.filter((it) => it.id !== id));
    setPendingUndo(target);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setPendingUndo(null), UNDO_MS);
  }

  function selectedAddAccountType(code: string, existing: MyStockItem[]): StockAccountType | "" {
    const options = addableAccountOptions(existing);
    const selected = addAccountDrafts[code];
    if (selected && options.some((option) => option.type === selected)) return selected;
    return options[0]?.type ?? "";
  }

  function selectAddAccountType(code: string, accountType: StockAccountType | "") {
    setAddAccountDrafts((prev) => ({ ...prev, [code]: accountType }));
  }

  function addAccountCopy(source: MyStockItem, accountType: StockAccountType | "") {
    if (source.tab !== "holding") return;
    const sameStockHoldings = items.filter(
      (item) => item.tab === "holding" && item.code === source.code,
    );
    if (!accountType) {
      flashNotice("追加する口座を選んでください");
      return;
    }
    const exists = sameStockHoldings.some((item) => item.accountType === accountType);
    if (exists) {
      flashNotice(`${source.name} は同じ口座区分ですでにあります`);
      return;
    }
    const nextAccountOption = ACCOUNT_OPTIONS.find((option) => option.type === accountType);
    const now = Date.now();
    const nextItem: MyStockItem = {
      ...source,
      id: newId(),
      accountType,
      accountLabel: nextAccountOption?.label ?? null,
      quantity: null,
      acquisitionPrice: null,
      memo: "",
      addedAt: now,
      updatedAt: now,
    };
    persist([nextItem, ...items]);
    setTab("holding");
    setHoldingViewMode("account");
    const nextExisting = [nextItem, ...sameStockHoldings];
    setAddAccountDrafts((prev) => ({
      ...prev,
      [source.code]: nextAccountForDuplicate(nextExisting) ?? "",
    }));
    flashNotice(`${source.name} に「${nextAccountOption?.label ?? "別口座"}」を追加しました`);
  }

  function undoRemove() {
    if (!pendingUndo) return;
    persist([pendingUndo, ...items]);
    setPendingUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }

  function exportBackup() {
    if (items.length === 0) {
      flashNotice("書き出す銘柄がありません");
      return;
    }
    const blob = new Blob([serializeBackup(items)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date()
      .toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" })
      .replaceAll("-", "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-stocks-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flashNotice(`${items.length}件をバックアップしました`);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      importBackupText(String(reader.result ?? ""), "file");
    };
    reader.onerror = () => flashNotice("ファイルの読み込みに失敗しました");
    reader.readAsText(file);
  }

  function importBackupText(text: string, source: "file" | "paste") {
    const parsed = parseBackupItems(text);
    if (!parsed) {
      flashNotice(
        source === "file"
          ? "バックアップファイルを読み込めませんでした"
          : "貼り付けたJSONを読み込めませんでした",
      );
      return;
    }
    const { merged, added, skipped } = mergeItems(items, parsed);
    persist(merged);
    if (source === "paste") {
      setPasteImportText("");
      setPasteImportOpen(false);
    }
    flashNotice(
      skipped > 0
        ? `${added}件を取り込みました（重複${skipped}件はスキップ）`
        : `${added}件を取り込みました`,
    );
  }

  function onImportInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) importBackup(file);
    e.target.value = ""; // 同じファイルを連続選択できるようにリセット
  }

  return (
    <main style={{ padding: "24px 16px 96px" }}>
      <section style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ display: "grid", gap: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>
            マイ銘柄リスト
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-sub)", margin: 0 }}>
            保有銘柄と気になる銘柄を端末内に保存できます。データはこの端末のブラウザにだけ保存され、サーバーには送信しません。
          </p>
        </header>

        <TabBar
          options={VIEW_TAB_OPTIONS}
          value={VIEW_TAB_LABELS[tab]}
          onChange={(label) => {
            if (label === VIEW_TAB_LABELS.holding) setTab("holding");
            else if (label === VIEW_TAB_LABELS.watch) setTab("watch");
            else setTab("master");
          }}
        />

        {tab === "master" ? (
          <MasterListPanel
            query={query}
            onQueryChange={setQuery}
            rows={masterPageRows}
            totalRows={masterRows.length}
            page={boundedMasterPage}
            pageCount={masterPageCount}
            masterReady={master.ready}
            masterError={master.error}
            reference={reference}
            onPrevPage={() => setMasterPage((page) => Math.max(0, page - 1))}
            onNextPage={() => setMasterPage((page) => Math.min(masterPageCount - 1, page + 1))}
            onAddHolding={(stock) => addStock(stock, "holding")}
            onAddWatch={(stock) => addStock(stock, "watch")}
          />
        ) : (
          <AddPanel
            tab={tab}
            query={query}
            onQueryChange={setQuery}
            holdingAccountType={newHoldingAccountType}
            onHoldingAccountTypeChange={setNewHoldingAccountType}
            candidates={candidates}
            masterReady={master.ready}
            masterError={master.error}
            onPick={(stock) => addStock(stock)}
          />
        )}

        {notice && (
          <div
            role="status"
            style={{
              fontSize: 12,
              color: "var(--color-text-sub)",
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            {notice}
          </div>
        )}

        {tab !== "master" && (
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>
              {TAB_LABELS[tab]}（{tabItems.length}件）
            </div>
            {tab === "holding" && (
              <SegmentedMode
                value={holdingViewMode}
                options={HOLDING_VIEW_OPTIONS}
                onChange={setHoldingViewMode}
              />
            )}
          </div>
          {tabItems.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "16px 4px" }}>
              まだ登録がありません。上の検索から銘柄を追加してください。
            </p>
          ) : tab === "holding" && holdingViewMode === "account" ? (
            <AccountSplitView
              items={tabItems}
              reference={reference}
              onUpdate={updateItem}
              onRemove={removeItem}
              onAddAccount={addAccountCopy}
              selectedAddAccountType={selectedAddAccountType}
              onSelectAddAccountType={selectAddAccountType}
            />
          ) : tab === "holding" && holdingViewMode === "ratio" ? (
            <RatioView items={tabItems} />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {tabItems.map((item) => (
                <StockRow
                  key={item.id}
                  item={item}
                  sameStockItems={tabItems.filter(
                    (sameItem) => sameItem.tab === "holding" && sameItem.code === item.code,
                  )}
                  reference={reference}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onAddAccount={addAccountCopy}
                  selectedAddAccountType={selectedAddAccountType}
                  onSelectAddAccountType={selectAddAccountType}
                />
              ))}
            </ul>
          )}
        </div>
        )}

        <div
          style={{
            display: "grid",
            gap: 8,
            marginTop: 8,
            paddingTop: 16,
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>
            バックアップ
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-sub)", margin: 0 }}>
            端末を変えるときや誤って消したときのために、JSON で書き出し・取り込みできます。取り込みは既存に追加され、同じ銘柄は重複しません。
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={exportBackup} style={toolbarButtonStyle}>
              エクスポート（書き出し）
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              style={toolbarButtonStyle}
            >
              ファイルから取り込み
            </button>
            <button
              type="button"
              onClick={() => setPasteImportOpen((prev) => !prev)}
              style={toolbarButtonStyle}
            >
              JSONを貼り付け
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={onImportInputChange}
              style={{ display: "none" }}
            />
          </div>
          {pasteImportOpen && (
            <div style={{ display: "grid", gap: 8 }}>
              <textarea
                value={pasteImportText}
                onChange={(e) => setPasteImportText(e.target.value)}
                placeholder='{"schema":"mini-tools/my-stocks","version":1,"items":[...]}'
                aria-label="バックアップJSONを貼り付け"
                rows={8}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1.5px solid var(--color-border-strong)",
                  background: "var(--color-bg-input)",
                  color: "var(--color-text)",
                  fontSize: 13,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => importBackupText(pasteImportText, "paste")}
                  disabled={!pasteImportText.trim()}
                  style={{
                    ...toolbarButtonStyle,
                    opacity: pasteImportText.trim() ? 1 : 0.55,
                    cursor: pasteImportText.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  取り込む
                </button>
                <button
                  type="button"
                  onClick={() => setPasteImportText("")}
                  disabled={!pasteImportText}
                  style={{
                    ...toolbarButtonStyle,
                    opacity: pasteImportText ? 1 : 0.55,
                    cursor: pasteImportText ? "pointer" : "not-allowed",
                  }}
                >
                  クリア
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {pendingUndo && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "var(--color-text)",
            color: "var(--color-bg)",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 13,
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            zIndex: 50,
          }}
        >
          <span>{pendingUndo.name} を削除しました</span>
          <button
            type="button"
            onClick={undoRemove}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-accent)",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            元に戻す
          </button>
        </div>
      )}
    </main>
  );
}

type SegmentedModeProps = {
  value: HoldingViewMode;
  options: Array<{ mode: HoldingViewMode; label: string }>;
  onChange: (value: HoldingViewMode) => void;
};

function SegmentedMode({ value, options, onChange }: SegmentedModeProps) {
  return (
    <div
      role="tablist"
      aria-label="保有メモの表示モード"
      style={{
        display: "inline-flex",
        padding: 3,
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        background: "var(--color-bg-input)",
      }}
    >
      {options.map((option) => {
        const active = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.mode)}
            style={{
              minWidth: 54,
              padding: "5px 10px",
              border: "none",
              borderRadius: 6,
              background: active ? "var(--color-bg-card)" : "transparent",
              color: active ? "var(--color-text)" : "var(--color-text-sub)",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type HoldingViewProps = {
  items: MyStockItem[];
  reference: MyStocksReference;
  onUpdate: (id: string, patch: Partial<MyStockItem>) => void;
  onRemove: (id: string) => void;
  onAddAccount: (item: MyStockItem, accountType: StockAccountType | "") => void;
  selectedAddAccountType: (code: string, existing: MyStockItem[]) => StockAccountType | "";
  onSelectAddAccountType: (code: string, accountType: StockAccountType | "") => void;
};

function AccountSplitView({
  items,
  reference,
  onUpdate,
  onRemove,
  onAddAccount,
  selectedAddAccountType,
  onSelectAddAccountType,
}: HoldingViewProps) {
  const grouped = new Map<string, MyStockItem[]>();
  for (const item of items) {
    const current = grouped.get(item.code) ?? [];
    current.push(item);
    grouped.set(item.code, current);
  }
  const stockGroups = [...grouped.entries()]
    .map(([code, groupItems]) => ({
      code,
      items: groupItems.sort((a, b) => b.addedAt - a.addedAt),
      latestAddedAt: Math.max(...groupItems.map((item) => item.addedAt)),
    }))
    .sort((a, b) => b.latestAddedAt - a.latestAddedAt);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {stockGroups.map((group) => {
        const base = group.items[0];
        const earnings = reference.nextEarningsByCode[base.code];
        const yutaiMonths = reference.yutaiMonthsByCode[base.code];
        const dividend = reference.dividendByCode[base.code];

        return (
        <section
          key={group.code}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            background: "var(--color-bg-card)",
            padding: "9px 12px",
            display: "grid",
            gap: 7,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 10,
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 900, color: "var(--color-text)", fontSize: 15 }}>
                  {base.code}
                </span>
                <span style={{ color: "var(--color-text)", fontSize: 14 }}>{base.name}</span>
                {base.market && (
                  <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>
                    {base.market}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {earnings && (
                  <span style={badgeStyle("var(--color-accent-sub)", "var(--color-accent)")}>
                    次決算 {formatEarnings(earnings)}
                  </span>
                )}
                {yutaiMonths && yutaiMonths.length > 0 && (
                  <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
                    優待 {yutaiMonths.map((m) => `${m}月`).join("・")}
                  </span>
                )}
                {dividend && (
                  <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
                    配当 {formatDividend(dividend)}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 800 }}>
                  口座内訳 {group.items.length}件
                </span>
              </div>
            </div>
            <AddAccountControl
              item={base}
              existing={group.items}
              value={selectedAddAccountType(group.code, group.items)}
              onChange={(value) => onSelectAddAccountType(group.code, value)}
              onAdd={(value) => onAddAccount(base, value)}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
              {group.items.map((item) => (
                <HoldingAccountLine
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                />
              ))}
            </ul>
          </div>
        </section>
      );
      })}
    </div>
  );
}

function AddAccountControl({
  item,
  existing,
  value,
  onChange,
  onAdd,
}: {
  item: MyStockItem;
  existing: MyStockItem[];
  value: StockAccountType | "";
  onChange: (value: StockAccountType | "") => void;
  onAdd: (value: StockAccountType | "") => void;
}) {
  const options = addableAccountOptions(existing);
  if (item.tab !== "holding" || options.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--color-text-muted)",
          fontSize: 11,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        追加先
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as StockAccountType | "")}
          style={addAccountSelectStyle}
        >
          {options.map((option) => (
            <option key={option.type} value={option.type}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={() => onAdd(value)} style={addAccountButtonStyle}>
        追加
      </button>
    </div>
  );
}

function HoldingAccountLine({
  item,
  onUpdate,
  onRemove,
}: {
  item: MyStockItem;
  onUpdate: (id: string, patch: Partial<MyStockItem>) => void;
  onRemove: (id: string) => void;
}) {
  const group = ACCOUNT_GROUPS.find((accountGroup) => accountGroup.key === accountGroupKey(item));
  const holdingAccountLabel = accountLabel(item) ?? "口座未設定";
  const amount = acquisitionAmount(item);

  return (
    <li
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        background: "var(--color-bg-input)",
        padding: "8px 9px",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: group?.color ?? "var(--color-text-muted)",
            flex: "0 0 auto",
          }}
        />
        <span style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 900 }}>
          {holdingAccountLabel}
        </span>
        {amount != null && (
          <span style={{ color: "var(--color-text-muted)", fontSize: 11, fontWeight: 800 }}>
            {formatYen(amount)}
          </span>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`${item.name} ${holdingAccountLabel} を削除`}
          style={{
            marginLeft: "auto",
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 6,
            color: "var(--color-text-sub)",
            fontSize: 12,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          削除
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(112px, 1.2fr) minmax(70px, 0.75fr) minmax(82px, 0.9fr)",
          gap: 6,
          alignItems: "end",
        }}
      >
        <label style={fieldLabelStyle}>
          口座
          <select
            value={item.accountType ?? ""}
            onChange={(e) => {
              const nextType = e.target.value as StockAccountType | "";
              const nextOption = ACCOUNT_OPTIONS.find((option) => option.type === nextType);
              onUpdate(item.id, {
                accountType: nextType || null,
                accountLabel: nextType ? nextOption?.label ?? null : null,
              });
            }}
            style={compactSelectInputStyle}
          >
            {ACCOUNT_OPTIONS.map((option) => (
              <option key={option.type || "unset"} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldLabelStyle}>
          数量
          <input
            type="number"
            inputMode="numeric"
            value={item.quantity ?? ""}
            onChange={(e) =>
              onUpdate(item.id, {
                quantity: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="株数"
            style={compactNumberInputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          取得単価
          <input
            type="number"
            inputMode="decimal"
            value={item.acquisitionPrice ?? ""}
            onChange={(e) =>
              onUpdate(item.id, {
                acquisitionPrice: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="円"
            style={compactNumberInputStyle}
          />
        </label>
      </div>

      <input
        type="text"
        value={item.memo ?? ""}
        onChange={(e) => onUpdate(item.id, { memo: e.target.value })}
        placeholder="メモ"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          borderRadius: 7,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-card)",
          color: "var(--color-text)",
          fontSize: 13,
        }}
      />
    </li>
  );
}

function RatioView({ items }: { items: MyStockItem[] }) {
  const rows = items
    .map((item) => {
      const amount = acquisitionAmount(item);
      return amount == null ? null : { item, amount };
    })
    .filter((row): row is { item: MyStockItem; amount: number } => row !== null);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const missingCount = items.length - rows.length;

  if (total <= 0) {
    return (
      <div style={ratioPanelStyle}>
        <p style={{ margin: 0, color: "var(--color-text-sub)", fontSize: 13 }}>
          比率を表示するには、保有銘柄に数量と取得単価を入力してください。
        </p>
      </div>
    );
  }

  const accountRows = ACCOUNT_GROUPS.map((group) => {
    const value = rows
      .filter((row) => accountGroupKey(row.item) === group.key)
      .reduce((sum, row) => sum + row.amount, 0);
    return { ...group, value };
  }).filter((row) => row.value > 0);

  const stockMap = new Map<string, { code: string; name: string; value: number }>();
  for (const row of rows) {
    const key = row.item.code;
    const current = stockMap.get(key);
    if (current) {
      current.value += row.amount;
    } else {
      stockMap.set(key, { code: row.item.code, name: row.item.name, value: row.amount });
    }
  }
  const stockRows = [...stockMap.values()].sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={ratioPanelStyle}>
        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 800 }}>
            取得額比率
          </div>
          <div style={{ fontSize: 20, color: "var(--color-text)", fontWeight: 900 }}>
            {formatYen(total)}
          </div>
          {missingCount > 0 && (
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              数量または取得単価が未入力の {missingCount} 件は除外しています
            </div>
          )}
        </div>
        <StackedShareBar rows={accountRows} total={total} />
        <div style={{ display: "grid", gap: 8 }}>
          {accountRows.map((row) => (
            <ShareRow
              key={row.key}
              label={row.label}
              value={row.value}
              total={total}
              color={row.color}
            />
          ))}
        </div>
      </div>

      <div style={ratioPanelStyle}>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 800 }}>
          銘柄別
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {stockRows.map((row, index) => (
            <ShareRow
              key={row.code}
              label={`${row.code} ${row.name}`}
              value={row.value}
              total={total}
              color={STOCK_CHART_COLORS[index % STOCK_CHART_COLORS.length]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StackedShareBar({
  rows,
  total,
}: {
  rows: Array<{ key: AccountGroupKey; label: string; value: number; color: string }>;
  total: number;
}) {
  return (
    <div
      aria-label="口座別取得額比率"
      style={{
        height: 18,
        display: "flex",
        overflow: "hidden",
        borderRadius: 999,
        background: "var(--color-bg-input)",
        border: "1px solid var(--color-border)",
      }}
    >
      {rows.map((row) => (
        <span
          key={row.key}
          title={`${row.label} ${Math.round((row.value / total) * 100)}%`}
          style={{
            width: `${(row.value / total) * 100}%`,
            minWidth: row.value > 0 ? 4 : 0,
            background: row.color,
          }}
        />
      ))}
    </div>
  );
}

function ShareRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const ratio = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 8,
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            color: "var(--color-text)",
            fontSize: 12,
            fontWeight: 800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <span style={{ color: "var(--color-text-sub)", fontSize: 12, fontWeight: 800 }}>
          {ratio.toFixed(1)}% / {formatYen(value)}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "var(--color-bg-input)",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "block",
            width: `${ratio}%`,
            minWidth: ratio > 0 ? 3 : 0,
            height: "100%",
            borderRadius: 999,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

type AddPanelProps = {
  tab: StockListTab;
  query: string;
  onQueryChange: (value: string) => void;
  holdingAccountType: StockAccountType | "";
  onHoldingAccountTypeChange: (value: StockAccountType | "") => void;
  candidates: StockMaster[];
  masterReady: boolean;
  masterError: boolean;
  onPick: (stock: StockMaster) => void;
};

type MasterListPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  rows: StockMaster[];
  totalRows: number;
  page: number;
  pageCount: number;
  masterReady: boolean;
  masterError: boolean;
  reference: MyStocksReference;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddHolding: (stock: StockMaster) => void;
  onAddWatch: (stock: StockMaster) => void;
};

function MasterListPanel({
  query,
  onQueryChange,
  rows,
  totalRows,
  page,
  pageCount,
  masterReady,
  masterError,
  reference,
  onPrevPage,
  onNextPage,
  onAddHolding,
  onAddWatch,
}: MasterListPanelProps) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="銘柄コード または 銘柄名で検索"
        aria-label="銘柄一覧を検索"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1.5px solid var(--color-border-strong)",
          background: "var(--color-bg-input)",
          color: "var(--color-text)",
          fontSize: 14,
        }}
      />

      {masterReady && !masterError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>
            {totalRows.toLocaleString("ja-JP")}件 / {page + 1}ページ
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={onPrevPage}
              disabled={page <= 0}
              style={pagerButtonStyle(page <= 0)}
            >
              前へ
            </button>
            <button
              type="button"
              onClick={onNextPage}
              disabled={page >= pageCount - 1}
              style={pagerButtonStyle(page >= pageCount - 1)}
            >
              次へ
            </button>
          </div>
        </div>
      )}

      {masterError ? (
        <span style={{ fontSize: 12, color: "var(--color-error)" }}>
          銘柄データを読み込めませんでした。時間をおいて再度お試しください。
        </span>
      ) : !masterReady ? (
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "12px 4px" }}>
          読み込み中…
        </p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "12px 4px" }}>
          該当する銘柄がありません
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {rows.map((stock) => {
            const earnings = reference.nextEarningsByCode[stock.code];
            const yutaiMonths = reference.yutaiMonthsByCode[stock.code];
            const dividend = stock.dividend ?? reference.dividendByCode[stock.code];

            return (
              <li
                key={stock.code}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  background: "var(--color-bg-card)",
                  padding: "9px 12px",
                  display: "grid",
                  gap: 7,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "start",
                  }}
                >
                  <div style={{ minWidth: 0, display: "grid", gap: 5 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontWeight: 900, color: "var(--color-text)", fontSize: 14 }}>
                        {stock.code}
                      </span>
                      <span style={{ color: "var(--color-text)", fontSize: 14 }}>
                        {stock.name}
                      </span>
                      {stock.market && (
                        <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>
                          {stock.market}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {earnings && (
                        <span style={badgeStyle("var(--color-accent-sub)", "var(--color-accent)")}>
                          次決算 {formatEarnings(earnings)}
                        </span>
                      )}
                      {yutaiMonths && yutaiMonths.length > 0 && (
                        <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
                          優待 {yutaiMonths.map((m) => `${m}月`).join("・")}
                        </span>
                      )}
                      {dividend && (
                        <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
                          配当利回り {dividend.yieldPct.toFixed(2)}%
                        </span>
                      )}
                      {dividend?.perShare !== null && dividend?.perShare !== undefined && (
                        <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
                          配当額 {dividend.perShare.toLocaleString("ja-JP")}円
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "end" }}>
                    <button
                      type="button"
                      onClick={() => onAddHolding(stock)}
                      style={smallActionButtonStyle}
                    >
                      保有
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddWatch(stock)}
                      style={smallActionButtonStyle}
                    >
                      ウォッチ
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddPanel({
  tab,
  query,
  onQueryChange,
  holdingAccountType,
  onHoldingAccountTypeChange,
  candidates,
  masterReady,
  masterError,
  onPick,
}: AddPanelProps) {
  return (
    <div style={{ position: "relative", display: "grid", gap: 6 }}>
      {tab === "holding" && (
        <label style={fieldLabelStyle}>
          追加する口座
          <select
            value={holdingAccountType}
            onChange={(e) => onHoldingAccountTypeChange(e.target.value as StockAccountType | "")}
            style={selectInputStyle}
          >
            {ACCOUNT_OPTIONS.map((option) => (
              <option key={option.type || "unset"} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="銘柄コード または 銘柄名で検索"
        aria-label="銘柄を検索して追加"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1.5px solid var(--color-border-strong)",
          background: "var(--color-bg-input)",
          color: "var(--color-text)",
          fontSize: 14,
        }}
      />
      {masterError && (
        <span style={{ fontSize: 12, color: "var(--color-error)" }}>
          銘柄データを読み込めませんでした。時間をおいて再度お試しください。
        </span>
      )}
      {query.trim() && !masterError && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            background: "var(--color-bg-card)",
            overflow: "hidden",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {!masterReady ? (
            <li style={{ padding: "10px 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
              読み込み中…
            </li>
          ) : candidates.length === 0 ? (
            <li style={{ padding: "10px 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
              該当する銘柄がありません
            </li>
          ) : (
            candidates.map((stock) => (
              <li key={stock.code}>
                <button
                  type="button"
                  onClick={() => onPick(stock)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 12px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--color-border)",
                    cursor: "pointer",
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 13 }}>
                    {stock.code}
                  </span>
                  <span style={{ color: "var(--color-text)", fontSize: 13 }}>{stock.name}</span>
                  <span style={{ marginLeft: "auto", color: "var(--color-text-muted)", fontSize: 11 }}>
                    {stock.market}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

type StockRowProps = {
  item: MyStockItem;
  sameStockItems: MyStockItem[];
  reference: MyStocksReference;
  onUpdate: (id: string, patch: Partial<MyStockItem>) => void;
  onRemove: (id: string) => void;
  onAddAccount: (item: MyStockItem, accountType: StockAccountType | "") => void;
  selectedAddAccountType: (code: string, existing: MyStockItem[]) => StockAccountType | "";
  onSelectAddAccountType: (code: string, accountType: StockAccountType | "") => void;
};

function StockRow({
  item,
  sameStockItems,
  reference,
  onUpdate,
  onRemove,
  onAddAccount,
  selectedAddAccountType,
  onSelectAddAccountType,
}: StockRowProps) {
  const earnings = reference.nextEarningsByCode[item.code];
  const yutaiMonths = reference.yutaiMonthsByCode[item.code];
  const dividend = reference.dividendByCode[item.code];
  const holdingAccountLabel = accountLabel(item);

  return (
    <li
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        background: "var(--color-bg-card)",
        padding: "12px 14px",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, color: "var(--color-text)", fontSize: 14 }}>
          {item.code}
        </span>
        <span style={{ color: "var(--color-text)", fontSize: 14 }}>{item.name}</span>
        {item.market && (
          <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{item.market}</span>
        )}
        {item.tab === "holding" && holdingAccountLabel && (
          <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
            {holdingAccountLabel}
          </span>
        )}
        {item.tab === "holding" && (
          <AddAccountControl
            item={item}
            existing={sameStockItems}
            value={selectedAddAccountType(item.code, sameStockItems)}
            onChange={(value) => onSelectAddAccountType(item.code, value)}
            onAdd={(value) => onAddAccount(item, value)}
          />
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`${item.name} を削除`}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 6,
            color: "var(--color-text-sub)",
            fontSize: 12,
            padding: "3px 9px",
            cursor: "pointer",
          }}
        >
          削除
        </button>
      </div>

      {(earnings || (yutaiMonths && yutaiMonths.length > 0) || dividend) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {earnings && (
            <span style={badgeStyle("var(--color-accent-sub)", "var(--color-accent)")}>
              次決算 {formatEarnings(earnings)}
            </span>
          )}
          {yutaiMonths && yutaiMonths.length > 0 && (
            <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
              優待 {yutaiMonths.map((m) => `${m}月`).join("・")}
            </span>
          )}
          {dividend && (
            <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
              配当 {formatDividend(dividend)}
            </span>
          )}
        </div>
      )}

      {item.tab === "holding" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={fieldLabelStyle}>
            口座
            <select
              value={item.accountType ?? ""}
              onChange={(e) => {
                const nextType = e.target.value as StockAccountType | "";
                const nextOption = ACCOUNT_OPTIONS.find((option) => option.type === nextType);
                onUpdate(item.id, {
                  accountType: nextType || null,
                  accountLabel: nextType ? nextOption?.label ?? null : null,
                });
              }}
              style={selectInputStyle}
            >
              {ACCOUNT_OPTIONS.map((option) => (
                <option key={option.type || "unset"} value={option.type}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldLabelStyle}>
            数量
            <input
              type="number"
              inputMode="numeric"
              value={item.quantity ?? ""}
              onChange={(e) =>
                onUpdate(item.id, {
                  quantity: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="株数"
              style={numberInputStyle}
            />
          </label>
          <label style={fieldLabelStyle}>
            取得単価
            <input
              type="number"
              inputMode="decimal"
              value={item.acquisitionPrice ?? ""}
              onChange={(e) =>
                onUpdate(item.id, {
                  acquisitionPrice: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="円"
              style={numberInputStyle}
            />
          </label>
        </div>
      )}

      <input
        type="text"
        value={item.memo ?? ""}
        onChange={(e) => onUpdate(item.id, { memo: e.target.value })}
        placeholder="メモ"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "7px 10px",
          borderRadius: 7,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-input)",
          color: "var(--color-text)",
          fontSize: 13,
        }}
      />
    </li>
  );
}

function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
  };
}

function pagerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    minWidth: 58,
    padding: "6px 10px",
    borderRadius: 7,
    border: "1.5px solid var(--color-border-strong)",
    background: disabled ? "var(--color-bg-input)" : "var(--color-bg-card)",
    color: disabled ? "var(--color-text-muted)" : "var(--color-text-sub)",
    fontSize: 12,
    fontWeight: 800,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

const fieldLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  fontSize: 11,
  color: "var(--color-text-muted)",
  fontWeight: 700,
};

const numberInputStyle: React.CSSProperties = {
  width: 110,
  padding: "6px 9px",
  borderRadius: 7,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-input)",
  color: "var(--color-text)",
  fontSize: 13,
};

const selectInputStyle: React.CSSProperties = {
  minWidth: 132,
  padding: "6px 9px",
  borderRadius: 7,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-input)",
  color: "var(--color-text)",
  fontSize: 13,
};

const compactNumberInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "5px 7px",
  borderRadius: 7,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-card)",
  color: "var(--color-text)",
  fontSize: 13,
};

const compactSelectInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "5px 7px",
  borderRadius: 7,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-card)",
  color: "var(--color-text)",
  fontSize: 13,
};

const addAccountButtonStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-bg-input)",
  color: "var(--color-text-sub)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const smallActionButtonStyle: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 6,
  border: "1.5px solid var(--color-border-strong)",
  background: "var(--color-bg-card)",
  color: "var(--color-text-sub)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const addAccountSelectStyle: React.CSSProperties = {
  minWidth: 118,
  padding: "5px 7px",
  borderRadius: 7,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-card)",
  color: "var(--color-text)",
  fontSize: 12,
};

const toolbarButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1.5px solid var(--color-border-strong)",
  background: "var(--color-bg-card)",
  color: "var(--color-text-sub)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const ratioPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg-card)",
  padding: "12px 14px",
};
