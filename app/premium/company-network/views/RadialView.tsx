"use client";

import { useMemo, useRef } from "react";
import { usePanZoom } from "../../industry-map/use-pan-zoom";
import { buildReachableNetwork } from "../graph";
import styles from "../CompanyNetwork.module.css";
import { CATEGORY_COLOR, groupTypeLabel, relationLabel } from "../presentation";
import type { CompanyGroupMembership, CompanyNetworkCompany, CompanyRelationship } from "../types";

type Point = { x: number; y: number };

function truncate(value: string, max = 15) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function companyPositions(depthByCompany: Map<string, number>): Map<string, Point> {
  const result = new Map<string, Point>();
  const byDepth = new Map<number, string[]>();
  for (const [companyId, depth] of depthByCompany) {
    const bucket = byDepth.get(depth) ?? [];
    bucket.push(companyId);
    byDepth.set(depth, bucket);
  }
  for (const [depth, ids] of byDepth) {
    if (depth === 0) {
      result.set(ids[0], { x: 0, y: 0 });
      continue;
    }
    const radius = depth === 1 ? 180 : 315;
    ids.forEach((companyId, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(ids.length, 1);
      result.set(companyId, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
  }
  return result;
}

function groupPositions(memberships: CompanyGroupMembership[]): Map<string, Point> {
  const groups = [...new Map(memberships.map((membership) => [membership.groupId, membership])).values()];
  const result = new Map<string, Point>();
  groups.forEach((group, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(groups.length, 1);
    result.set(group.groupId, { x: Math.cos(angle) * 425, y: Math.sin(angle) * 425 });
  });
  return result;
}

function shortenEdge(source: Point, target: Point, sourceRadius: number, targetRadius: number) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  return {
    x1: source.x + ux * sourceRadius,
    y1: source.y + uy * sourceRadius,
    x2: target.x - ux * targetRadius,
    y2: target.y - uy * targetRadius,
    midX: (source.x + target.x) / 2,
    midY: (source.y + target.y) / 2,
  };
}

type Props = {
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  memberships: CompanyGroupMembership[];
  centerCompanyId: string;
  selectedCompanyId: string;
  selectedRelationId: string | null;
  hops: 1 | 2;
  query: string;
  onSelectCompany: (companyId: string) => void;
  onSelectRelation: (relationId: string) => void;
};

export default function RadialView({
  companies,
  relationships,
  memberships,
  centerCompanyId,
  selectedCompanyId,
  selectedRelationId,
  hops,
  query,
  onSelectCompany,
  onSelectRelation,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panZoom = usePanZoom(svgRef, `${centerCompanyId}:${hops}`);
  const network = useMemo(
    () => buildReachableNetwork({
      selectedCompanyId: centerCompanyId,
      relationships,
      hops,
      categories: ["capital", "control", "historical"],
      verifiedOnly: false,
    }),
    [centerCompanyId, hops, relationships],
  );
  const visibleCompanyIds = useMemo(() => new Set(network.depthByCompany.keys()), [network.depthByCompany]);
  const visibleMemberships = useMemo(
    () => memberships.filter((membership) => visibleCompanyIds.has(membership.companyId)),
    [memberships, visibleCompanyIds],
  );
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const positions = useMemo(() => companyPositions(network.depthByCompany), [network.depthByCompany]);
  const groups = useMemo(() => groupPositions(visibleMemberships), [visibleMemberships]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");

  return (
    <div className={styles.viewFade}>
      <div className={styles.viewTools}>
        <span>中心企業から {hops}-hop</span>
        <span>{network.depthByCompany.size}企業 / {network.relationships.length}関係</span>
      </div>
      <div className={styles.svgWrap}>
        <div className={styles.zoomControls}>
          <button type="button" onClick={panZoom.zoomIn} aria-label="拡大">＋</button>
          <button type="button" onClick={panZoom.zoomOut} aria-label="縮小">−</button>
          <button type="button" onClick={panZoom.reset} disabled={!panZoom.canReset}>戻す</button>
        </div>
        <svg ref={svgRef} className={`${styles.svg} ${panZoom.panning ? styles.svgGrabbing : styles.svgGrab}`} style={{ touchAction: panZoom.viewport.scale === 1 ? "pan-y" : "none" }} viewBox="-520 -520 1040 1040" role="img" aria-label="中心企業を基準にした企業関係の放射マップ" onPointerDown={panZoom.onPointerDown} onDoubleClick={panZoom.onDoubleClick}>
          <defs><marker id="company-radial-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" /></marker></defs>
          <g transform={panZoom.transform}>
            <circle r="180" className={styles.radialRing} />
            {hops === 2 ? <circle r="315" className={styles.radialRing} /> : null}
            {visibleMemberships.length > 0 ? <circle r="425" className={styles.radialGroupRing} /> : null}
            {network.relationships.map((relationship) => {
              const source = positions.get(relationship.sourceCompanyId);
              const target = positions.get(relationship.targetCompanyId);
              if (!source || !target) return null;
              const edge = shortenEdge(source, target, relationship.sourceCompanyId === centerCompanyId ? 34 : 26, relationship.targetCompanyId === centerCompanyId ? 34 : 26);
              const selected = selectedRelationId === relationship.relationId;
              return <g key={relationship.relationId} onClick={() => onSelectRelation(relationship.relationId)} className={styles.edgeHitTarget}>
                <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke={CATEGORY_COLOR[relationship.relationCategory]} strokeWidth={selected ? 3.2 : 1.8} strokeOpacity={selected ? 1 : 0.78} strokeDasharray={relationship.verificationStatus === "verified" ? undefined : "7 6"} markerEnd="url(#company-radial-arrow)" color={CATEGORY_COLOR[relationship.relationCategory]} />
                <text x={edge.midX} y={edge.midY - 7} textAnchor="middle" className={styles.svgEdgeLabel}>{relationLabel(relationship.relationType, relationship.ownershipPct)}</text>
              </g>;
            })}
            {visibleMemberships.map((membership) => {
              const source = positions.get(membership.companyId);
              const target = groups.get(membership.groupId);
              if (!source || !target) return null;
              return <line key={membership.membershipId} x1={source.x} y1={source.y} x2={target.x} y2={target.y} className={styles.membershipLine} />;
            })}
            {[...network.depthByCompany.entries()].map(([companyId, depth]) => {
              const company = companyById.get(companyId);
              const point = positions.get(companyId);
              if (!company || !point) return null;
              const isCenter = companyId === centerCompanyId;
              const selected = companyId === selectedCompanyId;
              const queryDim = normalizedQuery.length > 0 && !company.name.toLocaleLowerCase("ja").includes(normalizedQuery);
              const radius = isCenter ? 34 : selected ? 30 : 26;
              return <g key={companyId} transform={`translate(${point.x} ${point.y})`} className={queryDim ? styles.svgNodeDim : undefined} role="button" tabIndex={0} onClick={() => { if (!panZoom.didPan()) onSelectCompany(companyId); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectCompany(companyId); } }} style={{ cursor: "pointer" }}>
                {selected ? <circle className={styles.pulse} r={radius + 9} fill="none" stroke="#2554ff" strokeWidth={2} /> : null}
                <circle r={radius} fill={isCenter ? "#2554ff" : "var(--color-bg-card)"} stroke="#2554ff" strokeWidth={selected || isCenter ? 3 : 2} />
                <text textAnchor="middle" y="-2" className={isCenter ? styles.radialCenterLabel : styles.radialNodeLabel}>{truncate(company.name, 11)}</text>
                <text textAnchor="middle" y="13" className={isCenter ? styles.radialCenterMeta : styles.radialNodeMeta}>{depth === 0 ? "center" : `${depth}-hop`}</text>
              </g>;
            })}
            {[...new Map(visibleMemberships.map((membership) => [membership.groupId, membership])).values()].map((membership) => {
              const point = groups.get(membership.groupId);
              if (!point) return null;
              return <g key={membership.groupId} transform={`translate(${point.x} ${point.y})`}><rect x="-60" y="-25" width="120" height="50" rx="14" className={styles.radialGroupNode} /><text textAnchor="middle" y="-2" className={styles.radialGroupLabel}>{truncate(membership.groupName, 13)}</text><text textAnchor="middle" y="13" className={styles.radialGroupMeta}>{groupTypeLabel(membership.groupType)}</text></g>;
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
