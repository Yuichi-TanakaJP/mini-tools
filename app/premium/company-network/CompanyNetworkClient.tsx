"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildReachableNetwork } from "./graph";
import styles from "./CompanyNetwork.module.css";
import type {
  CompanyGroupMembership,
  CompanyNetworkLoadResult,
  CompanyRelationship,
  RelationCategory,
} from "./types";

const CATEGORY_LABELS: Record<RelationCategory, string> = {
  capital: "資本",
  control: "支配",
  historical: "歴史",
};

const RELATION_LABELS: Record<string, string> = {
  equity_ownership: "出資",
  parent_of: "親会社",
  controls: "支配",
  equity_method_investment: "持分法",
  spun_off: "分社",
  predecessor_of: "前身",
  merged_into: "統合",
};

function shortName(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function relationLabel(relationship: CompanyRelationship) {
  const base = RELATION_LABELS[relationship.relationType] ?? relationship.relationType;
  return relationship.ownershipPct === null ? base : `${base} ${relationship.ownershipPct}%`;
}

function formatAsOf(value: string | null) {
  return value ? value.slice(0, 10) : "基準日なし";
}

function toggleCategory(
  current: RelationCategory[],
  category: RelationCategory,
): RelationCategory[] {
  return current.includes(category)
    ? current.filter((item) => item !== category)
    : [...current, category];
}

type Point = { x: number; y: number };

function companyPositions(depthByCompany: Map<string, number>): Map<string, Point> {
  const positions = new Map<string, Point>();
  const center = { x: 450, y: 350 };
  const byDepth = new Map<number, string[]>();

  for (const [companyId, depth] of depthByCompany) {
    const bucket = byDepth.get(depth) ?? [];
    bucket.push(companyId);
    byDepth.set(depth, bucket);
  }

  for (const [depth, ids] of byDepth) {
    if (depth === 0) {
      positions.set(ids[0], center);
      continue;
    }
    const radius = depth === 1 ? 180 : 305;
    ids.forEach((companyId, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(ids.length, 1);
      positions.set(companyId, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    });
  }
  return positions;
}

function groupPositions(memberships: CompanyGroupMembership[]): Map<string, Point> {
  const groups = [...new Map(memberships.map((membership) => [membership.groupId, membership])).values()];
  const positions = new Map<string, Point>();
  groups.forEach((group, index) => {
    const y = groups.length === 1 ? 350 : 110 + (500 * index) / Math.max(groups.length - 1, 1);
    positions.set(group.groupId, { x: 965, y });
  });
  return positions;
}

export default function CompanyNetworkClient({ result }: { result: CompanyNetworkLoadResult }) {
  const data = result.data;
  const connectedCompanyIds = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set([
      ...data.relationships.flatMap((relationship) => [
        relationship.sourceCompanyId,
        relationship.targetCompanyId,
      ]),
      ...data.memberships.map((membership) => membership.companyId),
    ]);
  }, [data]);
  const connectedCompanies = useMemo(
    () => data?.companies.filter((company) => connectedCompanyIds.has(company.id)) ?? [],
    [connectedCompanyIds, data],
  );
  const defaultCompanyId =
    connectedCompanies.find((company) => company.name === "トヨタ自動車")?.id ??
    connectedCompanies[0]?.id ??
    data?.companies[0]?.id ??
    "";

  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId);
  const [hops, setHops] = useState<1 | 2>(2);
  const [categories, setCategories] = useState<RelationCategory[]>([
    "capital",
    "control",
    "historical",
  ]);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);

  const network = useMemo(() => {
    if (!data || !selectedCompanyId) {
      return { relationships: [], depthByCompany: new Map<string, number>() };
    }
    return buildReachableNetwork({
      selectedCompanyId,
      relationships: data.relationships,
      hops,
      categories,
      verifiedOnly,
    });
  }, [categories, data, hops, selectedCompanyId, verifiedOnly]);

  const visibleCompanyIds = useMemo(
    () => new Set(network.depthByCompany.keys()),
    [network.depthByCompany],
  );
  const visibleMemberships = useMemo(() => {
    if (!data || !showGroups) return [];
    return data.memberships.filter(
      (membership) =>
        visibleCompanyIds.has(membership.companyId) &&
        (!verifiedOnly || membership.verificationStatus === "verified"),
    );
  }, [data, showGroups, verifiedOnly, visibleCompanyIds]);

  const positions = useMemo(() => companyPositions(network.depthByCompany), [network.depthByCompany]);
  const groupNodePositions = useMemo(() => groupPositions(visibleMemberships), [visibleMemberships]);
  const companyById = useMemo(
    () => new Map(data?.companies.map((company) => [company.id, company]) ?? []),
    [data],
  );
  const selectedRelation =
    network.relationships.find((relationship) => relationship.relationId === selectedRelationId) ??
    network.relationships[0] ??
    null;

  if (!data || result.status === "error" || result.status === "unconfigured" || result.status === "unauthenticated") {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <Link href="/premium" className={styles.backLink}>← Premium</Link>
          <h1>企業関係マップ</h1>
          <p className={styles.message}>{result.message}</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link href="/premium" className={styles.backLink}>← Premium</Link>
            <div className={styles.eyebrow}>Company relationship graph</div>
            <h1>企業関係マップ</h1>
            <p>
              資本・支配・歴史的関係と企業グループ所属を、根拠付きの事実として分けて確認します。
            </p>
          </div>
          <div className={styles.stats}>
            <span>{data.companies.length} 企業</span>
            <span>{data.relationships.length} 関係</span>
            <span>{data.memberships.length} 所属</span>
          </div>
        </header>

        {result.status === "empty" ? <p className={styles.message}>{result.message}</p> : null}

        <section className={styles.controls} aria-label="企業関係マップの表示条件">
          <label className={styles.selectLabel}>
            中心企業
            <select
              value={selectedCompanyId}
              onChange={(event) => {
                setSelectedCompanyId(event.target.value);
                setSelectedRelationId(null);
              }}
            >
              {connectedCompanies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>

          <div className={styles.segment} aria-label="探索の深さ">
            {[1, 2].map((value) => (
              <button
                type="button"
                key={value}
                className={hops === value ? styles.activeButton : styles.button}
                onClick={() => setHops(value as 1 | 2)}
              >
                {value}-hop
              </button>
            ))}
          </div>

          <div className={styles.checks}>
            {(Object.keys(CATEGORY_LABELS) as RelationCategory[]).map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={categories.includes(category)}
                  onChange={() => setCategories((current) => toggleCategory(current, category))}
                />
                {CATEGORY_LABELS[category]}
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
              />
              verifiedのみ
            </label>
            <label>
              <input
                type="checkbox"
                checked={showGroups}
                onChange={(event) => setShowGroups(event.target.checked)}
              />
              グループ表示
            </label>
          </div>
        </section>

        <section className={styles.mapPanel}>
          <div className={styles.legend}>
            <span><i className={styles.legendCenter} />中心企業</span>
            <span><i className={styles.legendCompany} />関係企業</span>
            <span><i className={styles.legendGroup} />企業グループ</span>
            <span>実線: 企業間 / 破線: 所属</span>
          </div>
          <div className={styles.svgScroller}>
            <svg viewBox="0 0 1100 700" className={styles.graph} role="img" aria-label="企業関係ネットワーク">
              <defs>
                <marker id="company-network-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowHead} />
                </marker>
              </defs>

              {network.relationships.map((relationship) => {
                const source = positions.get(relationship.sourceCompanyId);
                const target = positions.get(relationship.targetCompanyId);
                if (!source || !target) return null;
                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;
                return (
                  <g key={relationship.relationId}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      className={relationship.verificationStatus === "verified" ? styles.edge : styles.proposedEdge}
                      markerEnd="url(#company-network-arrow)"
                    />
                    <text x={midX} y={midY - 8} textAnchor="middle" className={styles.edgeLabel}>
                      {relationLabel(relationship)}
                    </text>
                  </g>
                );
              })}

              {visibleMemberships.map((membership) => {
                const company = positions.get(membership.companyId);
                const group = groupNodePositions.get(membership.groupId);
                if (!company || !group) return null;
                return (
                  <line
                    key={membership.membershipId}
                    x1={company.x}
                    y1={company.y}
                    x2={group.x}
                    y2={group.y}
                    className={styles.membershipEdge}
                  />
                );
              })}

              {[...network.depthByCompany.entries()].map(([companyId, depth]) => {
                const company = companyById.get(companyId);
                const point = positions.get(companyId);
                if (!company || !point) return null;
                return (
                  <g
                    key={companyId}
                    role="button"
                    tabIndex={0}
                    aria-label={`${company.name}を中心にする`}
                    onClick={() => {
                      setSelectedCompanyId(companyId);
                      setSelectedRelationId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCompanyId(companyId);
                        setSelectedRelationId(null);
                      }
                    }}
                    className={styles.nodeButton}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={depth === 0 ? 58 : 50}
                      className={depth === 0 ? styles.centerNode : styles.companyNode}
                    />
                    <text x={point.x} y={point.y - 2} textAnchor="middle" className={styles.nodeLabel}>
                      {shortName(company.name, 14)}
                    </text>
                    <text x={point.x} y={point.y + 17} textAnchor="middle" className={styles.depthLabel}>
                      {depth === 0 ? "center" : `${depth}-hop`}
                    </text>
                  </g>
                );
              })}

              {[...new Map(visibleMemberships.map((membership) => [membership.groupId, membership])).values()].map((membership) => {
                const point = groupNodePositions.get(membership.groupId);
                if (!point) return null;
                return (
                  <g key={membership.groupId}>
                    <rect x={point.x - 80} y={point.y - 34} width="160" height="68" rx="18" className={styles.groupNode} />
                    <text x={point.x} y={point.y - 3} textAnchor="middle" className={styles.groupLabel}>
                      {shortName(membership.groupName, 15)}
                    </text>
                    <text x={point.x} y={point.y + 16} textAnchor="middle" className={styles.groupTypeLabel}>
                      {membership.groupType}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        <section className={styles.detailsGrid}>
          <div className={styles.detailCard}>
            <div className={styles.sectionHeading}>
              <h2>企業間関係</h2>
              <span>{network.relationships.length}件</span>
            </div>
            {network.relationships.length === 0 ? (
              <p className={styles.muted}>現在の条件で表示できる企業間関係はありません。</p>
            ) : (
              <div className={styles.relationList}>
                {network.relationships.map((relationship) => (
                  <button
                    type="button"
                    key={relationship.relationId}
                    className={selectedRelation?.relationId === relationship.relationId ? styles.relationActive : styles.relationItem}
                    onClick={() => setSelectedRelationId(relationship.relationId)}
                  >
                    <strong>{relationship.sourceCompanyName} → {relationship.targetCompanyName}</strong>
                    <span>{CATEGORY_LABELS[relationship.relationCategory]} / {relationLabel(relationship)}</span>
                    <span>{relationship.verificationStatus} · {relationship.confidence}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.detailCard}>
            <div className={styles.sectionHeading}><h2>根拠</h2></div>
            {selectedRelation ? (
              <div className={styles.evidence}>
                <div className={styles.badges}>
                  <span>{selectedRelation.verificationStatus}</span>
                  <span>{selectedRelation.confidence}</span>
                  <span>{formatAsOf(selectedRelation.sourceAsOf)}</span>
                </div>
                <h3>{selectedRelation.sourceCompanyName} → {selectedRelation.targetCompanyName}</h3>
                <p>{selectedRelation.note || "補足なし"}</p>
                {selectedRelation.sourceUrl ? (
                  <a href={selectedRelation.sourceUrl} target="_blank" rel="noreferrer">
                    {selectedRelation.sourceTitle ?? "根拠ソースを開く"} ↗
                  </a>
                ) : (
                  <span className={styles.muted}>URL付きの根拠は登録されていません。</span>
                )}
              </div>
            ) : (
              <p className={styles.muted}>企業間関係を選ぶと、根拠と基準日を表示します。</p>
            )}

            {visibleMemberships.length > 0 ? (
              <div className={styles.membershipList}>
                <h3>表示中のグループ所属</h3>
                {visibleMemberships.map((membership) => (
                  <div key={membership.membershipId}>
                    <strong>{membership.companyName} → {membership.groupName}</strong>
                    <span>{membership.membershipBasis} · {membership.verificationStatus} · {formatAsOf(membership.sourceAsOf)}</span>
                    {membership.sourceUrl ? (
                      <a href={membership.sourceUrl} target="_blank" rel="noreferrer">根拠 ↗</a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
