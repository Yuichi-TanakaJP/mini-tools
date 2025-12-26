"use client";

import React, { useEffect, useMemo, useState } from "react";

type YutaiItem = {
  id: string;
  title: string; // 必須
  company?: string;
  expiry?: string; // 任意: YYYY-MM-DD
  note?: string;
  used: boolean;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "mini-tools:yutai-expiry:v1";
const DEFAULT_NEAR_DAYS = 14;
const NO_EXPIRY_KEY = "__NO_EXPIRY__";

function uid(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toDate(ymd?: string): Date | null {
  if (!ymd || !isYmd(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function daysUntil(ymd?: string): number | null {
  const dt = toDate(ymd);
  if (!dt) return null;
  const today = new Date();
  const a = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  const b = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function ymKey(ymd?: string): string {
  if (!ymd || !isYmd(ymd)) return NO_EXPIRY_KEY;
  return ymd.slice(0, 7); // YYYY-MM
}
function ymLabel(ym: string): string {
  if (ym === NO_EXPIRY_KEY) return "期限未設定";
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

function safeParse(raw: string | null): YutaiItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(Boolean)
      .map((x: any) => ({
        id: String(x.id ?? ""),
        title: String(x.title ?? ""),
        company: x.company ? String(x.company) : undefined,
        expiry: x.expiry ? String(x.expiry) : undefined,
        note: x.note ? String(x.note) : undefined,
        used: Boolean(x.used),
        createdAt: String(x.createdAt ?? new Date().toISOString()),
        updatedAt: String(x.updatedAt ?? new Date().toISOString()),
      }))
      .filter((x) => x.id && x.title); // titleだけ必須
  } catch {
    return [];
  }
}

type FilterMode = "all" | "unused" | "used";
type SortMode = "expiry_asc" | "expiry_desc" | "created_desc";

export default function ToolClient() {
  const [items, setItems] = useState<YutaiItem[]>([]);
  // 入力行は「IDだけ」親が持つ（入力値は子が保持）→フォーカス飛び根治
  const [draftIds, setDraftIds] = useState<string[]>([uid()]);

  const [filter, setFilter] = useState<FilterMode>("unused");
  const [sort, setSort] = useState<SortMode>("expiry_asc");
  const [groupByMonth, setGroupByMonth] = useState<boolean>(true);

  // load once
  useEffect(() => {
    setItems(safeParse(localStorage.getItem(STORAGE_KEY)));
  }, []);

  // save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const unused = items.filter((x) => !x.used).length;
    return { total, unused, used: total - unused };
  }, [items]);

  const normalized = useMemo(() => {
    const filtered = items.filter((x) => {
      if (filter === "all") return true;
      if (filter === "unused") return !x.used;
      return x.used;
    });

    const sorted = [...filtered].sort((a, b) => {
      // 未使用優先
      if (a.used !== b.used) return a.used ? 1 : -1;

      if (sort === "created_desc") {
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      }

      const da = toDate(a.expiry)?.getTime();
      const db = toDate(b.expiry)?.getTime();

      // 期限未設定は下へ
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;

      if (sort === "expiry_desc") return db - da;
      return da - db;
    });

    return sorted;
  }, [items, filter, sort]);

  const grouped = useMemo(() => {
    if (!groupByMonth) return null;
    const map = new Map<string, YutaiItem[]>();
    for (const it of normalized) {
      const key = ymKey(it.expiry);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === NO_EXPIRY_KEY) return 1;
      if (b === NO_EXPIRY_KEY) return -1;
      return a.localeCompare(b);
    });
    return keys.map((k) => ({ ym: k, items: map.get(k)! }));
  }, [normalized, groupByMonth]);

  function addDraftRow() {
    setDraftIds((prev) => [...prev, uid()]);
  }
  function removeDraftRow(id: string) {
    setDraftIds((prev) => prev.filter((x) => x !== id));
  }

  function commitDraftRow(data: {
    title: string;
    company?: string;
    expiry?: string;
    note?: string;
  }) {
    const title = data.title.trim();
    const expiry = (data.expiry ?? "").trim();

    if (!title) {
      alert("優待名だけ必須です（入力してください）");
      return;
    }
    if (expiry && !isYmd(expiry)) {
      alert("期限は入力する場合のみ YYYY-MM-DD の日付形式で入力してください");
      return;
    }

    const now = new Date().toISOString();
    const item: YutaiItem = {
      id: uid(),
      title,
      company: data.company?.trim() || undefined,
      expiry: expiry || undefined,
      note: data.note?.trim() || undefined,
      used: false,
      createdAt: now,
      updatedAt: now,
    };
    setItems((prev) => [item, ...prev]);
  }

  function updateItem(id: string, patch: Partial<YutaiItem>) {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now } : x))
    );
  }

  function toggleUsed(id: string) {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, used: !x.used, updatedAt: now } : x
      )
    );
  }

  function removeItem(id: string) {
    if (!confirm("この優待を削除しますか？")) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  function clearAll() {
    if (!confirm("すべて削除しますか？（元に戻せません）")) return;
    setItems([]);
  }

  // styles
  const cardStyle: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.6)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    outline: "none",
    background: "white",
  };

  const btnStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
  };

  const primaryBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: "black",
    color: "white",
    border: "1px solid black",
  };

  const gridHeader: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "34px 1.2fr 1fr 220px 1.6fr 170px",
    gap: 10,
    padding: "8px 10px",
    fontSize: 12,
    opacity: 0.75,
  };

  const gridRowBase: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "34px 1.2fr 1fr 220px 1.6fr 170px",
    gap: 10,
    alignItems: "center",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "white",
  };

  function ExpiryBadge({ expiry, used }: { expiry?: string; used: boolean }) {
    const d = daysUntil(expiry);
    const isExpired = d !== null && d < 0;
    const isNear = d !== null && d <= DEFAULT_NEAR_DAYS && d >= 0;

    const badge = used
      ? "使用済み"
      : isExpired
      ? "期限切れ"
      : isNear
      ? `あと${d}日`
      : null;
    if (!badge) return null;

    return (
      <span
        style={{
          fontSize: 12,
          padding: "4px 8px",
          borderRadius: 999,
          border: "1px solid rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
          opacity: used ? 0.8 : 1,
          borderColor: isExpired
            ? "rgba(220,0,0,0.35)"
            : isNear
            ? "rgba(255,140,0,0.45)"
            : "rgba(0,0,0,0.15)",
        }}
      >
        {badge}
      </span>
    );
  }

  function ItemRow({ item }: { item: YutaiItem }) {
    const [title, setTitle] = useState(item.title);
    const [company, setCompany] = useState(item.company ?? "");
    const [expiry, setExpiry] = useState(item.expiry ?? "");
    const [note, setNote] = useState(item.note ?? "");

    // itemが外部更新された時に同期
    useEffect(() => {
      setTitle(item.title);
      setCompany(item.company ?? "");
      setExpiry(item.expiry ?? "");
      setNote(item.note ?? "");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item.id, item.updatedAt]);

    function commit(patch: Partial<YutaiItem>) {
      updateItem(item.id, patch); // 既存の updateItem を使う
    }

    function commitTitle() {
      const t = title.trim();
      if (!t) {
        // titleは必須：空にされたら戻す
        setTitle(item.title);
        alert("優待名は必須です");
        return;
      }
      if (t !== item.title) commit({ title: t });
    }

    function commitCompany() {
      const v = company.trim();
      const next = v ? v : undefined;
      if ((item.company ?? undefined) !== next) commit({ company: next });
    }

    function commitExpiry() {
      const v = expiry.trim();
      const next = v ? v : undefined; // date input なので v は '' or 'YYYY-MM-DD' の想定
      if ((item.expiry ?? undefined) !== next) commit({ expiry: next });
    }

    function commitNote() {
      const v = note.trim();
      const next = v ? v : undefined;
      if ((item.note ?? undefined) !== next) commit({ note: next });
    }

    return (
      <div
        style={{
          ...gridRowBase,
          background: item.used ? "rgba(0,0,0,0.03)" : "white",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <input
            type="checkbox"
            checked={item.used}
            onChange={() => toggleUsed(item.id)}
            style={{ width: 18, height: 18 }}
          />
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          style={inputStyle}
        />

        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onBlur={commitCompany}
          style={inputStyle}
          placeholder="（任意）"
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            onBlur={commitExpiry}
            style={inputStyle}
          />
          <ExpiryBadge expiry={item.expiry} used={item.used} />
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          style={inputStyle}
          placeholder="（任意）"
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => removeItem(item.id)} style={btnStyle}>
            削除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.85 }}>
            合計 {stats.total} / 未使用 {stats.unused} / 使用済み {stats.used}
          </div>
          {items.length > 0 && (
            <button onClick={clearAll} style={btnStyle}>
              全削除
            </button>
          )}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          期限が近い（{DEFAULT_NEAR_DAYS}
          日以内）ものは強調表示します（期限未設定は対象外）。
        </div>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>表示：</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterMode)}
              style={{ ...inputStyle, width: 160, padding: "8px 10px" }}
            >
              <option value="unused">未使用</option>
              <option value="used">使用済み</option>
              <option value="all">すべて</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>ソート：</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              style={{ ...inputStyle, width: 200, padding: "8px 10px" }}
            >
              <option value="expiry_asc">期限が近い順（未設定は下）</option>
              <option value="expiry_desc">期限が遠い順（未設定は下）</option>
              <option value="created_desc">追加が新しい順</option>
            </select>
          </div>

          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={groupByMonth}
              onChange={(e) => setGroupByMonth(e.target.checked)}
            />
            月別表示
          </label>

          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75 }}>
            ※ 未使用が上に来るように自動で並べます
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>
            一覧（上の空欄に入力して追加）
          </h2>
          <button onClick={addDraftRow} style={btnStyle}>
            ＋入力行を追加
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={gridHeader}>
            <div style={{ textAlign: "center" }}>✓</div>
            <div>優待名（必須）</div>
            <div>企業名（任意）</div>
            <div>期限（任意）</div>
            <div>メモ（任意）</div>
            <div style={{ textAlign: "right" }}>操作</div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {draftIds.length === 0 ? (
              <div style={{ opacity: 0.75, padding: "10px 0" }}>
                入力行がありません。「＋入力行を追加」から作れます。
              </div>
            ) : (
              draftIds.map((id) => (
                <DraftRowEditor
                  key={id}
                  id={id}
                  gridRowStyle={{
                    ...gridRowBase,
                    background: "rgba(0,0,0,0.015)",
                  }}
                  inputStyle={inputStyle}
                  btnStyle={btnStyle}
                  primaryBtnStyle={primaryBtnStyle}
                  onCommit={(payload) => commitDraftRow(payload)}
                  onRemove={() => removeDraftRow(id)}
                />
              ))
            )}

            {normalized.length === 0 ? (
              <div style={{ opacity: 0.75, padding: "10px 0" }}>
                表示する優待がありません。
              </div>
            ) : groupByMonth && grouped ? (
              <div style={{ display: "grid", gap: 14 }}>
                {grouped.map((g) => (
                  <div key={g.ym} style={{ display: "grid", gap: 8 }}>
                    <div
                      style={{ fontWeight: 650, opacity: 0.9, marginTop: 4 }}
                    >
                      {ymLabel(g.ym)}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {g.items.map((it) => (
                        <ItemRow key={it.id} item={it} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              normalized.map((it) => <ItemRow key={it.id} item={it} />)
            )}
          </div>
        </div>
      </section>

      <section style={{ fontSize: 12, opacity: 0.7 }}>
        <div>保存場所：このブラウザの localStorage（端末内）</div>
        <div>
          ※
          ブラウザのデータ削除をすると消えます（将来、JSONエクスポートも追加できます）
        </div>
      </section>
    </div>
  );
}

function DraftRowEditor(props: {
  id: string;
  gridRowStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  btnStyle: React.CSSProperties;
  primaryBtnStyle: React.CSSProperties;
  onCommit: (payload: {
    title: string;
    company?: string;
    expiry?: string;
    note?: string;
  }) => void;
  onRemove: () => void;
}) {
  // 親stateに依存しない＝フォーカスが飛ばない
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");

  const okTitle = title.trim().length > 0;
  const okExpiry = !expiry.trim() || /^\d{4}-\d{2}-\d{2}$/.test(expiry.trim());
  const canAdd = okTitle && okExpiry;

  function commit() {
    props.onCommit({
      title,
      company,
      expiry,
      note,
    });
    // 連続入力
    setTitle("");
    setCompany("");
    setExpiry("");
    setNote("");
  }

  return (
    <div style={props.gridRowStyle}>
      <div />

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={props.inputStyle}
        placeholder="優待名（必須）"
      />

      <input
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        style={props.inputStyle}
        placeholder="企業名（任意）"
      />

      <input
        type="date"
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        style={props.inputStyle}
        aria-label="期限（任意）"
      />

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={props.inputStyle}
        placeholder="メモ（任意）"
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={commit}
          style={
            canAdd
              ? props.primaryBtnStyle
              : {
                  ...props.primaryBtnStyle,
                  opacity: 0.4,
                  cursor: "not-allowed",
                }
          }
          disabled={!canAdd}
        >
          追加
        </button>
        <button onClick={props.onRemove} style={props.btnStyle}>
          ×
        </button>
      </div>
    </div>
  );
}
