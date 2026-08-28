"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./CompanyNetwork.module.css";
import { CATEGORY_LABEL, VIEWS, type CompanyNetworkViewMode } from "./presentation";
import type { CompanyNetworkLoadResult, RelationCategory } from "./types";
import DetailPanel from "./views/DetailPanel";
import HierarchyView from "./views/HierarchyView";
import NetworkView from "./views/NetworkView";
import RadialView from "./views/RadialView";
import TableView from "./views/TableView";

const ALL_CATEGORIES: readonly RelationCategory[] = ["capital", "control", "historical"];

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

export default function CompanyNetworkClient({ result }: { result: CompanyNetworkLoadResult }) {
  const data = result.data;
  const connectedCompanyIds = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set([
      ...data.relationships.flatMap((relationship) => [relationship.sourceCompanyId, relationship.targetCompanyId]),
      ...data.memberships.map((membership) => membership.companyId),
    ]);
  }, [data]);
  const selectableCompanies = useMemo(() => {
    if (!data) return [];
    const connected = data.companies.filter((company) => connectedCompanyIds.has(company.id));
    return connected.length > 0 ? connected : data.companies;
  }, [connectedCompanyIds, data]);
  const defaultCompanyId =
    selectableCompanies.find((company) => company.name === "トヨタ自動車")?.id ??
    selectableCompanies[0]?.id ??
    "";

  const [view, setView] = useState<CompanyNetworkViewMode>("network");
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [hops, setHops] = useState<1 | 2>(2);
  const [categories, setCategories] = useState<Set<RelationCategory>>(() => new Set(ALL_CATEGORIES));
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [query, setQuery] = useState("");

  const relationships = useMemo(() => {
    if (!data) return [];
    return data.relationships.filter(
      (relationship) =>
        categories.has(relationship.relationCategory) &&
        (!verifiedOnly || relationship.verificationStatus === "verified"),
    );
  }, [categories, data, verifiedOnly]);

  const memberships = useMemo(() => {
    if (!data || !showGroups) return [];
    return data.memberships.filter(
      (membership) => !verifiedOnly || membership.verificationStatus === "verified",
    );
  }, [data, showGroups, verifiedOnly]);

  const selectedCompany = data?.companies.find((company) => company.id === selectedCompanyId) ?? null;
  const selectedRelation = relationships.find((relationship) => relationship.relationId === selectedRelationId) ?? null;
  const viewIndex = VIEWS.findIndex((item) => item.mode === view);
  const showHopControl = view === "radial" || view === "hierarchy";
  const showGroupControl = view === "network" || view === "radial";

  const selectCompany = (companyId: string) => {
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
  if (!data || data.companies.length === 0) return <StateScreen title="企業関係データがまだありません" body={result.message ?? "企業関係を登録するとここに表示されます。"} />;

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
            <p className={styles.heroLead}>資本・支配・歴史的関係と企業グループ所属を、4つの表現で切り替えて確認します。閲覧専用です。</p>
          </div>
          <span className={styles.versionBadge}>company-network v2</span>
        </div>
        <div className={styles.statRow}>
          <div className={styles.stat}><span>企業</span><strong>{data.companies.length}</strong><small>社</small></div>
          <div className={styles.stat}><span>企業間関係</span><strong>{data.relationships.length}</strong><small>件</small></div>
          <div className={styles.stat}><span>グループ所属</span><strong>{data.memberships.length}</strong><small>件</small></div>
          <div className={styles.stat}><span>表示中</span><strong>{relationships.length}</strong><small>関係</small></div>
        </div>
      </header>

      <section className={styles.toolbar} aria-label="企業関係マップの表示条件">
        <div className={styles.controlRow}>
          <label className={styles.companySelect}>
            <span>中心企業</span>
            <select value={selectedCompanyId} onChange={(event) => selectCompany(event.target.value)}>
              {selectableCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
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
        <section className={styles.canvas}>
          {relationships.length === 0 && memberships.length === 0 ? <p className={styles.empty}>現在のフィルタ条件では表示できる関係がありません。</p> : null}
          {view === "network" ? <NetworkView companies={data.companies} relationships={relationships} memberships={memberships} selectedCompanyId={selectedCompanyId} selectedRelationId={selectedRelationId} query={query} onSelectCompany={selectCompany} onSelectRelation={setSelectedRelationId} /> : null}
          {view === "radial" ? <RadialView companies={data.companies} relationships={relationships} memberships={memberships} selectedCompanyId={selectedCompanyId} selectedRelationId={selectedRelationId} hops={hops} query={query} onSelectCompany={selectCompany} onSelectRelation={setSelectedRelationId} /> : null}
          {view === "hierarchy" ? <HierarchyView companies={data.companies} relationships={relationships} selectedCompanyId={selectedCompanyId} selectedRelationId={selectedRelationId} hops={hops} query={query} onSelectCompany={selectCompany} onSelectRelation={setSelectedRelationId} /> : null}
          {view === "table" ? <TableView relationships={relationships} selectedRelationId={selectedRelationId} query={query} onSelectRelation={setSelectedRelationId} onSelectCompany={selectCompany} /> : null}
        </section>

        <DetailPanel company={selectedCompany} relationships={relationships} memberships={memberships} selectedRelation={selectedRelation} onSelectCompany={selectCompany} onSelectRelation={setSelectedRelationId} />
      </div>

      <p className={styles.note}>企業グループ所属は親子・支配関係とは別エッジです。系列ビューには混ぜません。関係の表示は保存済み事実の閲覧であり、業績連動や投資判断を自動推論しません。</p>
    </main>
  );
}
