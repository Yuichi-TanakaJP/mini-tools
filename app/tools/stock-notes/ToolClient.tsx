"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import TabBar from "@/app/tools/_shared/TabBar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSyncConfigured } from "@/lib/supabase/config";
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import { fetchAnalysisBody, fetchAnalyses, fetchHoldings, fetchOpenActions, fetchStocks, fetchTheses } from "./data";
import { loadDashboardData } from "./load";
import {
  analysesForStock,
  analysisCountForStock,
  buildAnalysisPrompt,
  computeUnanalyzedHoldings,
  countHoldingTabItems,
  createLoadGuard,
  freshnessLevel,
  isOverdue,
  latestAnalyzedAt,
  openActionCountForStock,
  selectLatestThesis,
  sortOpenActions,
  type FreshnessLevel,
} from "./logic";
import type {
  StockNoteAction,
  StockNoteAnalysis,
  StockNoteCategory,
  StockNoteStock,
  StockNoteThesis,
} from "./types";

type LoadState = "idle" | "loading" | "loaded" | "unauthorized" | "error";

const CATEGORY_LABELS: Record<StockNoteCategory, string> = {
  holding: "保有",
  watch: "ウォッチ",
  research: "新規調査",
  archived: "アーカイブ",
};
const CATEGORY_OPTIONS = [
  CATEGORY_LABELS.holding,
  CATEGORY_LABELS.watch,
  CATEGORY_LABELS.research,
  CATEGORY_LABELS.archived,
] as const;

const VIEW_LABELS: Record<StockNoteThesis["view"], string> = {
  bullish: "強気",
  neutral: "中立",
  bearish: "弱気",
};
const VIEW_COLORS: Record<StockNoteThesis["view"], { bg: string; fg: string }> = {
  bullish: { bg: "rgba(22,163,74,0.14)", fg: "#16a34a" },
  neutral: { bg: "var(--color-bg-input)", fg: "var(--color-text-sub)" },
  bearish: { bg: "rgba(220,38,38,0.14)", fg: "#dc2626" },
};
const CONFIDENCE_LABELS: Record<StockNoteThesis["confidence"], string> = {
  high: "確信度高",
  medium: "確信度中",
  low: "確信度低",
};
const ANALYSIS_TYPE_LABELS: Record<StockNoteAnalysis["analysisType"], string> = {
  earnings: "決算",
  financial: "財務",
  initial: "初回",
  news: "ニュース",
  other: "その他",
};
const FRESHNESS_COLORS: Record<FreshnessLevel, { bg: string; fg: string; label: string } | null> = {
  fresh: null,
  unknown: null,
  warn: { bg: "rgba(217,119,6,0.14)", fg: "#d97706", label: "そろそろ確認" },
  danger: { bg: "rgba(220,38,38,0.14)", fg: "#dc2626", label: "要更新" },
};

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  borderRadius: 14,
  border: "1px solid var(--color-border)",
  padding: "14px 14px 12px",
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 10,
  background: "var(--color-accent)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
const subBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 10,
  background: "var(--color-bg-input)",
  color: "var(--color-text-sub)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const badgeStyle = (bg: string, fg: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: bg,
  color: fg,
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: "nowrap",
});
const emptyText: React.CSSProperties = {
  fontSize: 13,
  color: "var(--color-text-muted)",
  padding: "14px 4px",
  margin: 0,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "var(--color-text)",
  margin: 0,
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function ToolClient() {
  const configured = isSyncConfigured();
  const [supabase] = useState<SupabaseClient | null>(() =>
    configured ? createSupabaseBrowserClient() : null,
  );

  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [stocks, setStocks] = useState<StockNoteStock[]>([]);
  const [analyses, setAnalyses] = useState<StockNoteAnalysis[]>([]);
  const [theses, setTheses] = useState<StockNoteThesis[]>([]);
  const [actions, setActions] = useState<StockNoteAction[]>([]);
  const [holdings, setHoldings] = useState<MyStockItem[]>([]);

  const [categoryTab, setCategoryTab] = useState<StockNoteCategory>("holding");
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string | "loading" | "error">>({});

  // 取得の「世代」を管理するガード。ユーザー切替・ログアウトが連続したときに、
  // 古いリクエストの結果が新しい画面を上書きしないようにする（詳細: logic.ts の createLoadGuard）。
  const loadGuardRef = useRef(createLoadGuard());

  const resetData = useCallback(() => {
    setStocks([]);
    setAnalyses([]);
    setTheses([]);
    setActions([]);
    setHoldings([]);
    setBodies({});
    setExpandedStockId(null);
    setLoadErrorMessage(null);
    setLoadState("idle");
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    const token = loadGuardRef.current.next();
    setLoadState("loading");
    setLoadErrorMessage(null);
    const result = await loadDashboardData({
      fetchStocks: () => fetchStocks(supabase),
      fetchAnalyses: () => fetchAnalyses(supabase),
      fetchTheses: () => fetchTheses(supabase),
      fetchOpenActions: () => fetchOpenActions(supabase),
      fetchHoldings,
    });
    // 完了までの間により新しい取得が始まっていたら、この結果は古いので画面に反映しない。
    if (!loadGuardRef.current.isCurrent(token)) return;

    if (result.status === "ok") {
      setStocks(result.stocks);
      setAnalyses(result.analyses);
      setTheses(result.theses);
      setActions(result.actions);
      setHoldings(result.holdings);
      setLoadState("loaded");
    } else if (result.status === "unauthorized") {
      setLoadErrorMessage(result.message);
      setLoadState("unauthorized");
    } else {
      setLoadErrorMessage(result.message);
      setLoadState("error");
    }
  }, [supabase]);

  // 認証確認とログイン中のデータ読み込みを1つのeffectにまとめる。
  // 「effectがstateを更新→その値に依存する別のeffectが発火してさらにstateを更新」という
  // cascading effectを避けるため、ログイン確認直後に同じeffect内でloadDataを呼ぶ。
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- AccountClient と同じ認証確認パターン。
       ここでのstate更新は外部システム（Supabase auth）からの状態同期であり、
       別effectへの連鎖ではなく同一effect内で完結させている。 */
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const nextEmail = data.user?.email ?? null;
      setEmail(nextEmail);
      setAuthReady(true);
      if (nextEmail) {
        loadData();
      } else {
        loadGuardRef.current.invalidate();
        resetData();
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextEmail = session?.user?.email ?? null;
      setEmail(nextEmail);
      if (nextEmail) {
        // ユーザー切替（別アカウントでの再ログイン含む）でも loadData 内で新しい世代を発行するため、
        // 直前のユーザーの取得結果は自動的に無効化される。
        loadData();
      } else {
        // ログアウト: 進行中の取得結果を無効化し、表示中のデータを即座にクリアする。
        loadGuardRef.current.invalidate();
        resetData();
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [supabase, loadData, resetData]);

  const unanalyzedHoldings = useMemo(
    () => computeUnanalyzedHoldings(holdings, stocks, analyses),
    [holdings, stocks, analyses],
  );
  // holdings.length ではなく tab='holding' の件数で判定する。
  // ウォッチのみ登録されている場合に「保有銘柄はすべて分析済みです」と誤表示しないため。
  const holdingTabCount = useMemo(() => countHoldingTabItems(holdings), [holdings]);
  const openActions = useMemo(() => sortOpenActions(actions), [actions]);
  const stockById = useMemo(() => new Map(stocks.map((s) => [s.id, s])), [stocks]);
  const filteredStocks = useMemo(
    () => stocks.filter((s) => s.category === categoryTab),
    [stocks, categoryTab],
  );

  async function copyPrompt(code: string, name: string) {
    const text = buildAnalysisPrompt(code, name);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((cur) => (cur === code ? null : cur)), 2000);
    } catch {
      // クリップボード権限が無い環境ではコピーだけ諦める（UIはクラッシュさせない）
    }
  }

  async function loadBody(analysisId: string) {
    if (!supabase) return;
    setBodies((prev) => ({ ...prev, [analysisId]: "loading" }));
    try {
      const res = await fetchAnalysisBody(supabase, analysisId);
      setBodies((prev) => ({ ...prev, [analysisId]: res.body ?? "(原文なし)" }));
    } catch {
      setBodies((prev) => ({ ...prev, [analysisId]: "error" }));
    }
  }

  return (
    <main style={{ padding: "24px 16px 96px" }}>
      <section style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 16, minWidth: 0 }}>
        <header style={{ display: "grid", gap: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>
            銘柄分析ダッシュボード
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-sub)", margin: 0, lineHeight: 1.6 }}>
            stock-notes（カスタムGPT）に記録した銘柄分析と、マイ銘柄リストの保有銘柄を突き合わせて表示します。読み取り専用で、分類変更や分析の追加はこの画面からはできません。
          </p>
        </header>

        {!configured ? (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-sub)" }}>
              このツールは現在この環境では利用できません（サーバー未設定）。
            </p>
          </div>
        ) : !authReady ? (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>読み込み中…</p>
          </div>
        ) : !email ? (
          <div style={card}>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-text-sub)", lineHeight: 1.6 }}>
              このツールはログインユーザー本人の分析データだけを表示します。ログインしてください。
            </p>
            <Link href="/account" style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}>
              ログインする
            </Link>
          </div>
        ) : loadState === "unauthorized" ? (
          <div style={card}>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-danger, #dc2626)", lineHeight: 1.6 }}>
              {loadErrorMessage ?? "セッションが切れています。ログインし直してください。"}
            </p>
            <Link href="/account" style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}>
              ログインし直す
            </Link>
          </div>
        ) : loadState === "error" ? (
          <div style={card}>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-danger, #dc2626)" }}>
              データの取得に失敗しました{loadErrorMessage ? `（${loadErrorMessage}）` : ""}。
            </p>
            <button type="button" onClick={loadData} style={subBtn}>
              再読み込み
            </button>
          </div>
        ) : loadState === "loading" || loadState === "idle" ? (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>データを取得中…</p>
          </div>
        ) : (
          <>
            {/* 1. 未分析の保有銘柄 */}
            <section style={{ display: "grid", gap: 10 }}>
              <h2 style={sectionTitle}>保有だが未分析（{unanalyzedHoldings.length}件）</h2>
              {holdingTabCount === 0 ? (
                <p style={emptyText}>
                  保有銘柄が登録されていません。マイ銘柄リストで保有銘柄を登録すると、ここに未分析の銘柄が表示されます。
                </p>
              ) : unanalyzedHoldings.length === 0 ? (
                <p style={emptyText}>保有銘柄はすべて分析済みです。</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {unanalyzedHoldings.map((h) => (
                    <li
                      key={h.code}
                      style={{
                        ...card,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 900, color: "var(--color-text)", fontSize: 14 }}>
                            {h.code}
                          </span>
                          <span style={{ color: "var(--color-text)", fontSize: 13 }}>{h.name}</span>
                        </div>
                        {h.quantity != null && (
                          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                            {h.quantity.toLocaleString("ja-JP")}株
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => copyPrompt(h.code, h.name)} style={subBtn}>
                        {copiedCode === h.code ? "コピーしました" : "分析用プロンプトをコピー"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 2. 分析済み銘柄の一覧 */}
            <section style={{ display: "grid", gap: 10 }}>
              <h2 style={sectionTitle}>分析済み銘柄</h2>
              <TabBar
                options={CATEGORY_OPTIONS}
                value={CATEGORY_LABELS[categoryTab]}
                onChange={(label) => {
                  const entry = (Object.entries(CATEGORY_LABELS) as [StockNoteCategory, string][]).find(
                    ([, v]) => v === label,
                  );
                  if (entry) setCategoryTab(entry[0]);
                }}
              />
              {filteredStocks.length === 0 ? (
                <p style={emptyText}>この分類の銘柄はまだありません。</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {filteredStocks.map((stock) => (
                    <StockRow
                      key={stock.id}
                      stock={stock}
                      analyses={analyses}
                      theses={theses}
                      actions={actions}
                      expanded={expandedStockId === stock.id}
                      onToggle={() =>
                        setExpandedStockId((cur) => (cur === stock.id ? null : stock.id))
                      }
                      bodies={bodies}
                      onLoadBody={loadBody}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* 3. アクション受信箱 */}
            <section style={{ display: "grid", gap: 10 }}>
              <h2 style={sectionTitle}>アクション受信箱（{openActions.length}件）</h2>
              {openActions.length === 0 ? (
                <p style={emptyText}>未消化のアクションはありません。</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {openActions.map((action) => {
                    const stock = stockById.get(action.stockId);
                    const overdue = isOverdue(action.dueDate);
                    return (
                      <li key={action.id} style={card}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          {stock && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text-muted)" }}>
                              {stock.code} {stock.name}
                            </span>
                          )}
                          {action.dueDate && (
                            <span style={badgeStyle(overdue ? "rgba(220,38,38,0.14)" : "var(--color-bg-input)", overdue ? "#dc2626" : "var(--color-text-sub)")}>
                              期限 {formatDate(action.dueDate)}{overdue ? "（期限切れ）" : ""}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, color: "var(--color-text)", fontSize: 14, marginTop: 4 }}>
                          {action.title}
                        </div>
                        {action.detail && (
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-text-sub)", lineHeight: 1.6 }}>
                            {action.detail}
                          </p>
                        )}
                        {action.triggerCondition && (
                          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--color-text-muted)" }}>
                            トリガー: {action.triggerCondition}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function FreshnessBadge({ level }: { level: FreshnessLevel }) {
  const info = FRESHNESS_COLORS[level];
  if (!info) return null;
  return <span style={badgeStyle(info.bg, info.fg)}>{info.label}</span>;
}

function StockRow({
  stock,
  analyses,
  theses,
  actions,
  expanded,
  onToggle,
  bodies,
  onLoadBody,
}: {
  stock: StockNoteStock;
  analyses: StockNoteAnalysis[];
  theses: StockNoteThesis[];
  actions: StockNoteAction[];
  expanded: boolean;
  onToggle: () => void;
  bodies: Record<string, string | "loading" | "error">;
  onLoadBody: (analysisId: string) => void;
}) {
  const thesis = selectLatestThesis(theses, stock.id);
  const lastAnalyzed = latestAnalyzedAt(analyses, stock.id);
  const level = freshnessLevel(lastAnalyzed);
  const analysisCount = analysisCountForStock(analyses, stock.id);
  const openActions = openActionCountForStock(actions, stock.id);
  const timeline = expanded ? analysesForStock(analyses, stock.id) : [];

  return (
    <li style={card}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 900, color: "var(--color-text)", fontSize: 14 }}>{stock.code}</span>
          <span style={{ color: "var(--color-text)", fontSize: 13 }}>{stock.name}</span>
          {thesis && (
            <span style={badgeStyle(VIEW_COLORS[thesis.view].bg, VIEW_COLORS[thesis.view].fg)}>
              {VIEW_LABELS[thesis.view]}
            </span>
          )}
          {thesis && (
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {CONFIDENCE_LABELS[thesis.confidence]}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            最終分析 {formatDate(lastAnalyzed)}
          </span>
          <FreshnessBadge level={level} />
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>分析{analysisCount}件</span>
          {openActions > 0 && (
            <span style={badgeStyle("var(--color-accent-sub)", "var(--color-accent)")}>
              未消化アクション{openActions}件
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)", display: "grid", gap: 12 }}>
          {thesis ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 800 }}>
                現在の見立て（{formatDate(thesis.asOf)}時点）
              </div>
              <ThesisList label="仮説" items={thesis.thesis} />
              <ThesisList label="リスク" items={thesis.risks} />
              <ThesisList label="次回確認点" items={thesis.nextCheck} />
              {thesis.buyMoreCondition && (
                <div style={{ fontSize: 12, color: "var(--color-text-sub)" }}>
                  買い増し条件: {thesis.buyMoreCondition}
                </div>
              )}
              {thesis.exitCondition && (
                <div style={{ fontSize: 12, color: "var(--color-text-sub)" }}>
                  撤退条件: {thesis.exitCondition}
                </div>
              )}
            </div>
          ) : (
            <p style={emptyText}>見立ての記録がまだありません。</p>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 800 }}>
              分析タイムライン（新しい順）
            </div>
            {timeline.length === 0 ? (
              <p style={emptyText}>分析の記録がまだありません。</p>
            ) : (
              timeline.map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text-muted)" }}>
                      {formatDate(a.analyzedAt)}
                    </span>
                    <span style={badgeStyle("var(--color-bg-input)", "var(--color-text-sub)")}>
                      {ANALYSIS_TYPE_LABELS[a.analysisType]}
                    </span>
                  </div>
                  {a.conclusion && (
                    <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 700 }}>{a.conclusion}</div>
                  )}
                  {a.evidence && (
                    <div style={{ fontSize: 12, color: "var(--color-text-sub)" }}>根拠: {a.evidence}</div>
                  )}
                  {a.concerns && (
                    <div style={{ fontSize: 12, color: "var(--color-text-sub)" }}>懸念: {a.concerns}</div>
                  )}
                  {a.sourceUrl && (
                    <a
                      href={a.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{ fontSize: 11, color: "var(--color-accent)" }}
                    >
                      出典を開く
                    </a>
                  )}
                  <div>
                    {bodies[a.id] === undefined ? (
                      <button type="button" onClick={() => onLoadBody(a.id)} style={subBtn}>
                        原文を表示
                      </button>
                    ) : bodies[a.id] === "loading" ? (
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>読み込み中…</span>
                    ) : bodies[a.id] === "error" ? (
                      <span style={{ fontSize: 12, color: "var(--color-danger, #dc2626)" }}>
                        原文の取得に失敗しました
                      </span>
                    ) : (
                      <div
                        style={{
                          marginTop: 4,
                          maxHeight: 320,
                          overflowY: "auto",
                          overflowX: "hidden",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 12,
                          color: "var(--color-text-sub)",
                          background: "var(--color-bg-input)",
                          borderRadius: 8,
                          padding: "8px 10px",
                        }}
                      >
                        {bodies[a.id]}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function ThesisList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-text-sub)", fontWeight: 700 }}>{label}</div>
      <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 12, color: "var(--color-text-sub)", lineHeight: 1.6 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
