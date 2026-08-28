"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./CompanyNetwork.module.css";
import { CATEGORY_LABEL, VIEWS, type CompanyNetworkViewMode } from "./presentation";
import type {
  CompanyNetworkBootstrapResult,
  CompanyNetworkData,
  CompanyNetworkScopeResult,
  RelationCategory,
} from "./types";
import DetailPanel from "./views/DetailPanel";
import HierarchyView from "./views/HierarchyView";
import NetworkView from "./views/NetworkView";
import RadialView from "./views/RadialView";
import TableView from "./views/TableView";

const ALL_CATEGORIES: readonly RelationCategory[] = ["capital", "control", "historical"];

type ScopedState = { key: string; data: CompanyNetworkData };
type ScopedError = { key: string; message: string };

function StateScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className={styles.page}>
      <nav className={styles.topNav}>
        <Link href="/premium" className={styles.topNavLink}>← Premium ホーム</Link>
      </nav>
      <section className={styles.state}>
        <h1>{title}</h1>
        <p>{body}</p>
      </section>
    </main>
  );
}

export default function CompanyNetworkClient({ result }: { result: CompanyNetworkBootstrapResult }) {
  const bootstrap = result.data;
  const defaultCompanyId = bootstrap?.defaultCompanyId ?? "";

  const [view, setView] = useState<CompanyNetworkViewMode>("network");
  const [centerCompanyId, setCenterCompanyId] = useState(defaultCompanyId);
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [hops, setHops] = useState<1 | 2>(2);
  const [categories, setCategories] = useState<Set<RelationCategory>>(() => new Set(ALL_CATEGORIES));
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [query, setQuery] = useState("");
  const [scopedState, setScopedState] = useState<ScopedState | null>(null);
  const [scopedError, setScopedError] = useState<ScopedError | null>(null);

  const categoryKey = useMemo(() => [...categories].sort().join(","), [categories]);
  const requestKey = `${centerCompanyId}|${hops}|${verifiedOnly ? "v" : "all"}|${showGroups ? "g" : "nog"}|${categoryKey}`;
  const scope = scopedState?.key === requestKey ? scopedState.data : null;
  const loadError = scopedError?.key === requestKey ? scopedError.message : null;
  const loading = Boolean(centerCompanyId) && scope === null && loadError === null;

  useEffect(() => {
    if (!centerCompanyId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      companyId: centerCompanyId,
      hops: String(hops),
      verifiedOnly: String(verifiedOnly),
      includeGroups: String(showGroups),
      categories: categoryKey,
    });
    const key = requestKey;

    fetch(`/api/premium/company-network?${params.toString()}`, {
      credentials: "same-origin",
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json() as CompanyNetworkScopeResult;
        if (!response.ok || payload.status === "error" || payload.status === "unauthenticated" || payload.status === "unconfigured") {
          throw new Error(payload.message);
        }
        return payload.data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setScopedState({ key, data });
        setScopedError(null);
        setSelectedRelationId(null);
        setSelectedCompanyId((current) => data.companies.some((company) => company.id === current) ? current : centerCompanyId);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setScopedError({ key, message: error instanceof Error ? error.message : "企業関係の取得に失敗しました。" });
      });

    return () => controller.abort();
  }, [categoryKey, centerCompanyId, hops, requestKey, showGroups, verifiedOnly]);

  const relationships = scope?.relationships ?? [];
  const memberships = scope?.memberships ?? [];
  const selectedCompany = scope?.companies.find((company) => company.id === selectedCompanyId) ?? null;
  const selectedRelation = relationships.find((relationship) => relationship.relationId === selectedRelationId) ?? null;
  const viewIndex = VIEWS.findIndex((item) => item.mode === view);
  const showHopControl = view === "radial" || view === "hierarchy";
  const showGroupControl = view === "network" || view === "radial";

  const selectNode = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedRelationId(null);
  };

  const changeCenter = (companyId: string) => {
    setCenterCompanyId(companyId);
    setSelectedCompanyId(companyId);
    setSelectedRelationId(null);
  };

  const toggleCategory = (category: RelationCategory) => {
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setSelectedRelationId(null);
  };

  if (result.status === "unconfigured") return <StateScreen title="Supabase 連携が未設定です" body={result.message} />;
  if (result.status === "unauthenticated") return <StateScreen title="Supabase にログインしてください" body={result.message} />;
  if (result.status === "error") return <StateScreen title="企業関係マップを取得できませんでした" body={`${result.message} 0件ではなく取得失敗です。`} />;
  if (!bootstrap || bootstrap.entryCompanies.length === 0) return <StateScreen title="企業関係データがまだありません" body={result.message ?? "中心企業候補を登録するとここに表示されます。"} />;

  return (
    <main className={styles.page}>
      <nav className={styles.topNav}>
        <Link href="/premium" className={styles.topNavLink}>← Premium ホーム</Link>
        <Link href="/premium/industry-map" className={styles.topNavLink}>業界マップ →</Link>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroHead}>
          <div>
            <h1 className={styles.heroTitle}>企業関係マップ</h1>
            <p className={styles.heroLead}>企業グループと入口企業だけを先に読み込み、選択した企業の周辺データを必要な時だけ取得します。閲覧専用です。</p>
          </div>
          <span className={styles.versionBadge}>company-network v3</span>
        </div>
        <div className={styles.statRow}>
          <div className={styles.stat}><span>入口企業</span><strong>{bootstrap.entryCompanies.length}</strong><small>社</small></div>
          <div className={styles.stat}><span>企業グループ</span><strong>{bootstrap.groups.length}</strong><small>件</small></div>
          <div className={styles.stat}><span>表示企業</span><strong>{scope?.companies.length ?? 0}</strong><small>社</small></div>
          <div className={styles.stat}><span>表示関係</span><strong>{relationships.length}</strong><small>件</small></div>
        </div>
      </header>

      <section className={styles.toolbar} aria-label="企業関係マップの表示条件">
        <div className={styles.controlRow}>
          <label className={styles.companySelect}>
            <span>中心企業（入口）</span>
            <select value={centerCompanyId} onChange={(event) => changeCenter(event.target.value)}>
              {bootstrap.entryCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <input className={styles.search} type="search" value={query} placeholder="企業名・関係を検索" aria-label="企業関係を検索" onChange={(event) => setQuery(event.target.value)} />
        </div>

        <details style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "0 10px", background: "var(--color-bg-input)" }}>
          <summary style={{ minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", fontSize: 11, fontWeight: 800, color: "var(--color-text-sub)" }}>
            <span>絞り込み・表示設定</span>
            <span style={{ color: "var(--color-text-muted)", fontWeight: 700 }}>{verifiedOnly ? "verified" : "全状態"} · {categories.size}種別</span>
          </summary>
          <div style={{ display: "grid", gap: 10, padding: "4px 0 10px" }}>
            {showHopControl ? (
              <div className={styles.controlRow}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "var(--color-text-muted)" }}>探索範囲</span>
                <div className={styles.hopControl} aria-label="探索の深さ">
                  {[1, 2].map((value) => (
                    <button key={value} type="button" className={hops === value ? styles.toggleOn : styles.toggle} onClick={() => setHops(value as 1 | 2)}>{value}-hop</button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={styles.filterRow}>
              {ALL_CATEGORIES.map((category) => (
                <button key={category} type="button" className={`${styles.toggle} ${categories.has(category) ? styles.toggleOn : ""}`} aria-pressed={categories.has(category)} onClick={() => toggleCategory(category)}>
                  <span className={styles.toggleDot} />{CATEGORY_LABEL[category]}
                </button>
              ))}
              <button type="button" className={`${styles.toggle} ${verifiedOnly ? styles.toggleOn : ""}`} aria-pressed={verifiedOnly} onClick={() => { setVerifiedOnly((value) => !value); setSelectedRelationId(null); }}>verifiedのみ</button>
              {showGroupControl ? (
                <button type="button" className={`${styles.toggle} ${showGroups ? styles.toggleOn : ""}`} aria-pressed={showGroups} onClick={() => setShowGroups((value) => !value)}>グループ表示</button>
              ) : null}
            </div>
          </div>
        </details>

        <div className={styles.segmented} role="tablist" aria-label="表現の切り替え">
          <span className={styles.segmentedIndicator} style={{ left: `calc(3px + (100% - 6px) * ${Math.max(viewIndex, 0)} / ${VIEWS.length})`, width: `calc((100% - 6px) / ${VIEWS.length})` }} aria-hidden />
          {VIEWS.map((item) => (
            <button key={item.mode} type="button" role="tab" aria-selected={item.mode === view} className={`${styles.segmentButton} ${item.mode === view ? styles.segmentButtonActive : ""}`} onClick={() => setView(item.mode)} title={item.question}>
              <span aria-hidden>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.canvas} aria-busy={loading}>
          {loading ? <p className={styles.empty}>選択企業の関係を読み込んでいます…</p> : null}
          {loadError ? <p className={styles.empty}>{loadError}</p> : null}
          {!loading && scope && relationships.length === 0 && memberships.length === 0 ? <p className={styles.empty}>現在の条件では表示できる関係がありません。</p> : null}
          {scope && view === "network" ? <NetworkView companies={scope.companies} relationships={relationships} memberships={memberships} centerCompanyId={centerCompanyId} selectedCompanyId={selectedCompanyId} selectedRelationId={selectedRelationId} query={query} onSelectCompany={selectNode} onSelectRelation={setSelectedRelationId} /> : null}
          {scope && view === "radial" ? <RadialView companies={scope.companies} relationships={relationships} memberships={memberships} centerCompanyId={centerCompanyId} selectedCompanyId={selectedCompanyId} selectedRelationId={selectedRelationId} hops={hops} query={query} onSelectCompany={selectNode} onSelectRelation={setSelectedRelationId} /> : null}
          {scope && view === "hierarchy" ? <HierarchyView companies={scope.companies} relationships={relationships} centerCompanyId={centerCompanyId} selectedCompanyId={selectedCompanyId} selectedRelationId={selectedRelationId} hops={hops} query={query} onSelectCompany={selectNode} onSelectRelation={setSelectedRelationId} /> : null}
          {scope && view === "table" ? <TableView relationships={relationships} selectedRelationId={selectedRelationId} query={query} onSelectRelation={setSelectedRelationId} onSelectCompany={selectNode} /> : null}
        </section>

        <DetailPanel company={selectedCompany} centerCompanyId={centerCompanyId} relationships={relationships} memberships={memberships} selectedRelation={selectedRelation} onSelectCompany={selectNode} onSelectRelation={setSelectedRelationId} onMakeCenter={changeCenter} />
      </div>

      <p className={styles.note}>ノード選択は詳細と強調だけを変え、配置は動かしません。中心企業を変える場合だけ周辺データを再取得し、「再配置」は同じノード集合の位置だけを計算し直します。</p>
    </main>
  );
}
