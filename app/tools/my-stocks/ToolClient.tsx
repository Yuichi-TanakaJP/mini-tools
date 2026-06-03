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

const TAB_LABELS: Record<StockListTab, string> = {
  holding: "保有メモ",
  watch: "ウォッチ",
};
const TAB_OPTIONS = [TAB_LABELS.holding, TAB_LABELS.watch] as const;
const ACCOUNT_OPTIONS: Array<{ type: StockAccountType | ""; label: string }> = [
  { type: "", label: "口座未設定" },
  { type: "specific", label: "特定預り" },
  { type: "nisa-growth", label: "NISA成長" },
  { type: "nisa-tsumitate", label: "NISAつみたて" },
  { type: "old-nisa", label: "旧NISA" },
  { type: "general", label: "一般預り" },
  { type: "other", label: "その他" },
];

const UNDO_MS = 5000;

function formatEarnings(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[1])}/${Number(m[2])}`;
}

function accountMergeKey(item: MyStockItem): string {
  if (item.tab !== "holding") return `${item.tab}:${item.code}`;
  return `${item.tab}:${item.code}:${item.accountType ?? item.accountLabel ?? ""}`;
}

function accountLabel(item: MyStockItem): string | null {
  if (item.accountLabel) return item.accountLabel;
  return ACCOUNT_OPTIONS.find((option) => option.type === item.accountType)?.label ?? null;
}

export default function ToolClient({ reference }: Props) {
  const [items, setItems] = useState<MyStockItem[]>(() => loadItems());
  const [tab, setTab] = useState<StockListTab>("holding");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<MyStockItem | null>(null);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pasteImportText, setPasteImportText] = useState("");
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const master = useStockMaster();

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
    () => items.filter((it) => it.tab === tab).sort((a, b) => b.addedAt - a.addedAt),
    [items, tab],
  );

  const candidates = useMemo(() => master.search(query, 20), [master, query]);

  function addStock(stock: StockMaster) {
    const nextKey =
      tab === "holding" ? `holding:${stock.code}:` : `watch:${stock.code}`;
    const exists = items.some((it) => accountMergeKey(it) === nextKey);
    if (exists) {
      flashNotice(`${stock.name} はすでに「${TAB_LABELS[tab]}」にあります`);
      return;
    }
    const now = Date.now();
    const item: MyStockItem = {
      id: newId(),
      code: stock.code,
      name: stock.name,
      market: stock.market,
      sector: stock.sector,
      tab,
      accountType: tab === "holding" ? null : undefined,
      accountLabel: tab === "holding" ? null : undefined,
      quantity: tab === "holding" ? null : undefined,
      acquisitionPrice: tab === "holding" ? null : undefined,
      memo: "",
      addedAt: now,
      updatedAt: now,
    };
    persist([item, ...items]);
    setQuery("");
    flashNotice(`${stock.name} を「${TAB_LABELS[tab]}」に追加しました`);
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
          options={TAB_OPTIONS}
          value={TAB_LABELS[tab]}
          onChange={(label) => setTab(label === TAB_LABELS.holding ? "holding" : "watch")}
        />

        <AddPanel
          query={query}
          onQueryChange={setQuery}
          candidates={candidates}
          masterReady={master.ready}
          masterError={master.error}
          onPick={addStock}
        />

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

        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>
            {TAB_LABELS[tab]}（{tabItems.length}件）
          </div>
          {tabItems.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "16px 4px" }}>
              まだ登録がありません。上の検索から銘柄を追加してください。
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {tabItems.map((item) => (
                <StockRow
                  key={item.id}
                  item={item}
                  reference={reference}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                />
              ))}
            </ul>
          )}
        </div>

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

type AddPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  candidates: StockMaster[];
  masterReady: boolean;
  masterError: boolean;
  onPick: (stock: StockMaster) => void;
};

function AddPanel({
  query,
  onQueryChange,
  candidates,
  masterReady,
  masterError,
  onPick,
}: AddPanelProps) {
  return (
    <div style={{ position: "relative", display: "grid", gap: 6 }}>
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
  reference: MyStocksReference;
  onUpdate: (id: string, patch: Partial<MyStockItem>) => void;
  onRemove: (id: string) => void;
};

function StockRow({ item, reference, onUpdate, onRemove }: StockRowProps) {
  const earnings = reference.nextEarningsByCode[item.code];
  const yutaiMonths = reference.yutaiMonthsByCode[item.code];
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

      {(earnings || (yutaiMonths && yutaiMonths.length > 0)) && (
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
