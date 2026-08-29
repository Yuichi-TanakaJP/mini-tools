"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./CompanyNetwork.module.css";
import { CATEGORY_LABEL, VIEWS, type CompanyNetworkViewMode } from "./presentation";
import type {
  CompanyNetworkBootstrapResult,
  CompanyNetworkData,
  CompanyNetworkNodeSelection,
  CompanyNetworkScopeMode,
  CompanyNetworkScopeResult,
  RelationCategory,
} from "./types";
import DetailPanel from "./views/DetailPanel";
import FunctionClusterView from "./views/FunctionClusterView";
import FunctionCoverageMatrixView from "./views/FunctionCoverageMatrixView";
import GroupHierarchyView from "./views/GroupHierarchyView";
import GroupTableView from "./views/GroupTableView";
import HierarchyView from "./views/HierarchyView";
import NetworkView from "./views/NetworkView";
import RadialView from "./views/RadialView";
import RelationshipModesView from "./views/RelationshipModesView";
import TableView from "./views/TableView";

const ALL_CATEGORIES: readonly RelationCategory[] = ["capital", "control", "historical"];

type ScopedState = { key: string; data: CompanyNetworkData };
type ScopedError = { key: string; message: string };
type ScopedSelection = CompanyNetworkNodeSelection & { key: string };

function StateScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className={styles.page}>
      <nav className={styles.topNav}><Link href="/premium" className={styles.topNavLink}>← Premium ホーム</Link></nav>
      <section className={styles.state}><h1>{title}</h1><p>{body}</p></section>
    </main>
  );
}

export default function CompanyNetworkClient({ result }: { result: CompanyNetworkBootstrapResult }) {
  const bootstrap = result.data;
  const groups = bootstrap?.groups ?? [];
  const defaultGroupId = bootstrap?.defaultGroupId ?? groups[0]?.id ?? "";

  const [view, setView] = useState<CompanyNetworkViewMode>("composition");
  const [scopeMode, setScopeMode] = useState<CompanyNetworkScopeMode>("group");
  const [selectedGroupId, setSelectedGroupId] = useState(defaultGroupId);
  const [displayBaseCompanyId, setDisplayBaseCompanyId] = useState("");
  const [centerCompanyId, setCenterCompanyId] = useState("");
  const [selection, setSelection] = useState<ScopedSelection | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [hops, setHops] = useState<1 | 2>(2);
  const [categories, setCategories] = useState<Set<RelationCategory>>(() => new Set(ALL_CATEGORIES));
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [query, setQuery] = useState("");
  const [scopedState, setScopedState] = useState<ScopedState | null>(null);
  const [scopedError, setScopedError] = useState<ScopedError | null>(null);

  const categoryKey = useMemo(() => [...categories].sort().join(","), [categories]);
  const targetId = scopeMode === "group" ? selectedGroupId : centerCompanyId;
  const requestKey = scopeMode === "group"
    ? `group|${selectedGroupId}|${verifiedOnly ? "v" : "all"}|${categoryKey}`
    : `company|${centerCompanyId}|${hops}|${verifiedOnly ? "v" : "all"}|${showGroups ? "g" : "nog"}|${categoryKey}`;
  const scope = scopedState?.key === requestKey ? scopedState.data : null;
  const loadError = scopedError?.key === requestKey ? scopedError.message : null;
  const loading = Boolean(targetId) && scope === null && loadError === null;
  const activeSelection: CompanyNetworkNodeSelection | null = selection?.key === requestKey
    ? { kind: selection.kind, id: selection.id }
    : null;
  const selectedCompanyId = activeSelection?.kind === "company" ? activeSelection.id : "";
  const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const centerCompany = scope?.companies.find((company) => company.id === centerCompanyId) ?? null;
  const displayBaseCompany = scope?.companies.find((company) => company.id === displayBaseCompanyId) ?? null;
  const groupNetworkSelection = scopeMode === "group" && activeSelection?.kind === "group" ? null : activeSelection;

  useEffect(() => {
    if (!targetId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ verifiedOnly: String(verifiedOnly), categories: categoryKey });
    if (scopeMode === "group") params.set("groupId", selectedGroupId);
    else {
      params.set("companyId", centerCompanyId);
      params.set("hops", String(hops));
      params.set("includeGroups", String(showGroups));
    }
    const key = requestKey;

    fetch(`/api/premium/company-network?${params.toString()}`, { credentials: "same-origin", signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as CompanyNetworkScopeResult;
        if (!response.ok || payload.status === "error" || payload.status === "unauthenticated" || payload.status === "unconfigured") throw new Error(payload.message);
        return payload.data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setScopedState({ key, data });
        setScopedError(null);
        setSelectedRelationId(null);
        setSelection((current) => {
          if (current?.kind === "company" && data.companies.some((company) => company.id === current.id)) return { key, kind: "company", id: current.id };
          if (current?.kind === "group" && data.memberships.some((membership) => membership.groupId === current.id)) return { key, kind: "group", id: current.id };
          return scopeMode === "group" ? { key, kind: "group", id: selectedGroupId } : { key, kind: "company", id: centerCompanyId };
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setScopedError({ key, message: error instanceof Error ? error.message : "企業関係の取得に失敗しました。" });
      });

    return () => controller.abort();
  }, [categoryKey, centerCompanyId, hops, requestKey, scopeMode, selectedGroupId, showGroups, targetId, verifiedOnly]);

  const relationships = scope?.relationships ?? [];
  const memberships = scope?.memberships ?? [];
  const functions = scope?.functions ?? [];
  const functionAreaCount = new Set(functions.map((link) => link.functionName)).size;
  const selectedRelation = relationships.find((relationship) => relationship.relationId === selectedRelationId) ?? null;
  const viewIndex = VIEWS.findIndex((item) => item.mode === view);
  const showHopControl = scopeMode === "company" && (view === "composition" || view === "hierarchy");
  const showGroupControl = scopeMode === "company" && (view === "network" || view === "composition");
  const showRelationFilters = scopeMode === "company" || view === "network" || view === "hierarchy" || view === "table";

  const selectCompany = (companyId: string) => {
    setSelection({ key: requestKey, kind: "company", id: companyId });
    setSelectedRelationId(null);
  };
  const selectGroup = (groupId: string) => {
    setSelection({ key: requestKey, kind: "group", id: groupId });
    setSelectedRelationId(null);
  };
  const changeGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setScopeMode("group");
    setDisplayBaseCompanyId("");
    setCenterCompanyId("");
    setSelection(null);
    setSelectedRelationId(null);
  };
  const changeDisplayBase = (companyId: string) => {
    setDisplayBaseCompanyId(companyId);
    setSelectedRelationId(null);
    setSelection(companyId ? { key: requestKey, kind: "company", id: companyId } : { key: requestKey, kind: "group", id: selectedGroupId });
  };
  const changeCenter = (companyId: string) => {
    setScopeMode("company");
    setCenterCompanyId(companyId);
    setSelection(null);
    setSelectedRelationId(null);
  };
  const returnToGroup = () => {
    setScopeMode("group");
    setCenterCompanyId("");
    setSelection(null);
    setSelectedRelationId(null);
  };
  const toggleCategory = (category: RelationCategory) => {
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
    setSelectedRelationId(null);
  };

  if (result.status === "unconfigured") return <StateScreen title="Supabase 連携が未設定です" body={result.message} />;
  if (result.status === "unauthenticated") return <StateScreen title="Supabase にログインしてください" body={result.message} />;
  if (result.status === "error") return <StateScreen title="企業関係マップを取得できませんでした" body={`${result.message} 0件ではなく取得失敗です。`} />;
  if (!bootstrap || groups.length === 0) return <StateScreen title="企業関係データがまだありません" body={result.message ?? "企業グループを登録するとここに表示されます。"} />;

  return (
    <main className={styles.page}>
      <nav className={styles.topNav}>
        <Link href="/premium" className={styles.topNavLink}>← Premium ホーム</Link>
        <Link href="/premium/industry-map" className={styles.topNavLink}>業界マップ →</Link>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroHead}>
          <div>
            <h1 className={styles.heroTitle}>企業グループマップ</h1>
            <p className={styles.heroLead}>所属企業を並べるだけでなく、「何を担う会社か」「誰が誰を保有するか」「どこに機能の厚みがあるか」を同じ事実レイヤーから読みます。</p>
          </div>
          <span className={styles.versionBadge}>company-network v7</span>
        </div>
        <div className={styles.statRow}>
          <div className={styles.stat}><span>企業グループ</span><strong>{groups.length}</strong><small>件</small></div>
          <div className={styles.stat}><span>{scopeMode === "group" ? "所属企業" : "表示企業"}</span><strong>{scope?.companies.length ?? 0}</strong><small>社</small></div>
          <div className={styles.stat}><span>機能領域</span><strong>{functionAreaCount}</strong><small>領域</small></div>
          <div className={styles.stat}><span>企業間関係</span><strong>{relationships.length}</strong><small>件</small></div>
        </div>
      </header>

      <section className={styles.toolbar} aria-label="企業関係マップの表示条件">
        <div className={styles.controlRow}>
          <label className={styles.companySelect}>
            <span>企業グループ</span>
            <select value={selectedGroupId} onChange={(event) => changeGroup(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          </label>
          {scopeMode === "group" ? (
            <label className={styles.companySelect}>
              <span>表示基点</span>
              <select value={displayBaseCompanyId} onChange={(event) => changeDisplayBase(event.target.value)}>
                <option value="">グループ全体</option>
                {(scope?.companies ?? []).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
          ) : null}
          <input className={styles.search} type="search" value={query} placeholder="企業名・機能・関係を検索" aria-label="企業関係を検索" onChange={(event) => setQuery(event.target.value)} />
        </div>

        {scopeMode === "company" ? (
          <div className={styles.controlRow} style={{ justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-bg-input)" }}>
            <span style={{ fontSize: 11, color: "var(--color-text-sub)" }}>企業深掘り中: <strong>{centerCompany?.name ?? "読み込み中"}</strong></span>
            <button type="button" className={styles.smallButton} onClick={returnToGroup}>← {activeGroup?.name ?? "企業グループ"}に戻る</button>
          </div>
        ) : scope && displayBaseCompany ? (
          <p className={styles.hint}>表示基点: <strong>{displayBaseCompany.name}</strong>。グループ全体のデータは保持したまま、この企業に関係する表示を強調しています。</p>
        ) : null}

        <details style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "0 10px", background: "var(--color-bg-input)" }}>
          <summary style={{ minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", fontSize: 11, fontWeight: 800, color: "var(--color-text-sub)" }}>
            <span>絞り込み・表示設定</span><span style={{ color: "var(--color-text-muted)", fontWeight: 700 }}>{verifiedOnly ? "確認済み" : "全状態"}{showRelationFilters ? ` · ${categories.size}種別` : ""}</span>
          </summary>
          <div style={{ display: "grid", gap: 10, padding: "4px 0 10px" }}>
            {showHopControl ? <div className={styles.controlRow}><span style={{ fontSize: 10, fontWeight: 800, color: "var(--color-text-muted)" }}>探索範囲</span><div className={styles.hopControl} aria-label="探索の深さ">{[1, 2].map((value) => <button key={value} type="button" className={hops === value ? styles.toggleOn : styles.toggle} onClick={() => setHops(value as 1 | 2)}>{value}-hop</button>)}</div></div> : null}
            <div className={styles.filterRow}>
              {showRelationFilters ? ALL_CATEGORIES.map((category) => <button key={category} type="button" className={`${styles.toggle} ${categories.has(category) ? styles.toggleOn : ""}`} aria-pressed={categories.has(category)} onClick={() => toggleCategory(category)}><span className={styles.toggleDot} />{CATEGORY_LABEL[category]}</button>) : null}
              <button type="button" className={`${styles.toggle} ${verifiedOnly ? styles.toggleOn : ""}`} aria-pressed={verifiedOnly} onClick={() => { setVerifiedOnly((value) => !value); setSelectedRelationId(null); }}>確認済みのみ</button>
              {showGroupControl ? <button type="button" className={`${styles.toggle} ${showGroups ? styles.toggleOn : ""}`} aria-pressed={showGroups} onClick={() => setShowGroups((value) => !value)}>グループ表示</button> : null}
            </div>
          </div>
        </details>

        <div className={styles.segmented} role="tablist" aria-label="表現の切り替え">
          <span className={styles.segmentedIndicator} style={{ left: `calc(3px + (100% - 6px) * ${Math.max(viewIndex, 0)} / ${VIEWS.length})`, width: `calc((100% - 6px) / ${VIEWS.length})` }} aria-hidden />
          {VIEWS.map((item) => <button key={item.mode} type="button" role="tab" aria-selected={item.mode === view} className={`${styles.segmentButton} ${item.mode === view ? styles.segmentButtonActive : ""}`} onClick={() => setView(item.mode)} title={item.question}><span aria-hidden>{item.icon}</span><span>{item.label}</span></button>)}
        </div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.canvas} aria-busy={loading}>
          {loading ? <p className={styles.empty}>{scopeMode === "group" ? "企業グループと機能情報を読み込んでいます…" : "選択企業の関係を読み込んでいます…"}</p> : null}
          {loadError ? <p className={styles.empty}>{loadError}</p> : null}

          {scope && view === "composition" && scopeMode === "group" && activeGroup ? (
            <FunctionClusterView groupName={activeGroup.name} companies={scope.companies} functions={functions} relationships={relationships} selection={activeSelection} focusCompanyId={displayBaseCompanyId} query={query} onSelectCompany={selectCompany} />
          ) : null}
          {scope && view === "composition" && scopeMode === "company" ? (
            <RadialView companies={scope.companies} relationships={relationships} memberships={memberships} centerCompanyId={centerCompanyId} selection={activeSelection} selectedRelationId={selectedRelationId} hops={hops} query={query} onSelectCompany={selectCompany} onSelectGroup={selectGroup} onSelectRelation={setSelectedRelationId} />
          ) : null}

          {scope && view === "network" && scopeMode === "group" && activeGroup ? (
            <RelationshipModesView
              groupName={activeGroup.name}
              companies={scope.companies}
              relationships={relationships}
              functions={functions}
              selection={groupNetworkSelection}
              selectedRelationId={selectedRelationId}
              focusCompanyId={displayBaseCompanyId}
              query={query}
              onSelectCompany={selectCompany}
              onSelectGroup={selectGroup}
              onSelectRelation={setSelectedRelationId}
            />
          ) : null}
          {scope && view === "network" && scopeMode === "company" ? <NetworkView companies={scope.companies} relationships={relationships} memberships={memberships} centerCompanyId={centerCompanyId} selection={activeSelection} selectedRelationId={selectedRelationId} query={query} onSelectCompany={selectCompany} onSelectGroup={selectGroup} onSelectRelation={setSelectedRelationId} /> : null}

          {scope && view === "hierarchy" && scopeMode === "group" && activeGroup && !displayBaseCompanyId ? <GroupHierarchyView groupName={activeGroup.name} companies={scope.companies} relationships={relationships} query={query} selectedCompanyId={selectedCompanyId} selectedRelationId={selectedRelationId} onSelectCompany={selectCompany} onSelectRelation={setSelectedRelationId} /> : null}
          {scope && view === "hierarchy" && scopeMode === "group" && displayBaseCompanyId ? <HierarchyView companies={scope.companies} relationships={relationships} centerCompanyId={displayBaseCompanyId} selectedCompanyId={selectedCompanyId || displayBaseCompanyId} selectedRelationId={selectedRelationId} hops={2} query={query} onSelectCompany={selectCompany} onSelectRelation={setSelectedRelationId} /> : null}
          {scope && view === "hierarchy" && scopeMode === "company" ? <HierarchyView companies={scope.companies} relationships={relationships} centerCompanyId={centerCompanyId} selectedCompanyId={selectedCompanyId} selectedRelationId={selectedRelationId} hops={hops} query={query} onSelectCompany={selectCompany} onSelectRelation={setSelectedRelationId} /> : null}

          {scope && view === "matrix" && scopeMode === "group" && activeGroup ? (
            <FunctionCoverageMatrixView groupName={activeGroup.name} companies={scope.companies} functions={functions} focusCompanyId={displayBaseCompanyId} query={query} onSelectCompany={selectCompany} />
          ) : null}
          {scope && view === "matrix" && scopeMode === "company" ? <p className={styles.empty}>機能カバレッジは企業グループ単位の比較です。上の「企業グループに戻る」からグループ表示へ戻してください。</p> : null}

          {scope && view === "table" && scopeMode === "group" && activeGroup ? <GroupTableView group={activeGroup} companies={scope.companies} memberships={memberships} relationships={relationships} functions={functions} selection={activeSelection} selectedRelationId={selectedRelationId} focusCompanyId={displayBaseCompanyId} query={query} onSelectCompany={selectCompany} onSelectRelation={setSelectedRelationId} /> : null}
          {scope && view === "table" && scopeMode === "company" ? <TableView relationships={relationships} selectedRelationId={selectedRelationId} query={query} onSelectRelation={setSelectedRelationId} onSelectCompany={selectCompany} /> : null}
        </section>

        <DetailPanel groups={groups} companies={scope?.companies ?? []} selection={activeSelection} centerCompanyId={scopeMode === "company" ? centerCompanyId : ""} relationships={relationships} memberships={memberships} functions={functions} selectedRelation={selectedRelation} onSelectCompany={selectCompany} onSelectGroup={selectGroup} onSelectRelation={setSelectedRelationId} onMakeCenter={changeCenter} />
      </div>

      <p className={styles.note}>構成＝事業・機能の階層、関係＝資本relationと事業・機能の放射マップ、系列＝資本・支配構造、機能表＝企業×機能の厚み、表＝根拠付き一覧です。</p>
    </main>
  );
}
