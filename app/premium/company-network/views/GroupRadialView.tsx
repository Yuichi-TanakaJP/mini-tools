"use client";

import { useMemo, useRef } from "react";
import { usePanZoom } from "../../industry-map/use-pan-zoom";
import { buildSelectedNeighbourIds, groupGraphNodeId, selectedGraphNodeId } from "../node-selection";
import styles from "../CompanyNetwork.module.css";
import { CATEGORY_COLOR, groupTypeLabel, relationLabel } from "../presentation";
import type {
  CompanyGroupMembership,
  CompanyNetworkCompany,
  CompanyNetworkGroup,
  CompanyNetworkNodeSelection,
  CompanyRelationship,
} from "../types";

type Point = { x: number; y: number };

function truncate(value: string, max = 12) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function placeMembers(memberships: CompanyGroupMembership[]): Map<string, Point> {
  const result = new Map<string, Point>();
  const sorted = [...memberships].sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"));
  const innerCount = sorted.length <= 12 ? sorted.length : Math.ceil(sorted.length / 2);
  sorted.forEach((membership, index) => {
    const inner = index < innerCount;
    const ringIndex = inner ? index : index - innerCount;
    const ringSize = inner ? innerCount : sorted.length - innerCount;
    const radius = sorted.length <= 12 ? 300 : inner ? 245 : 405;
    const angle = -Math.PI / 2 + (Math.PI * 2 * ringIndex) / Math.max(ringSize, 1);
    result.set(membership.companyId, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  return result;
}

type Props = {
  group: CompanyNetworkGroup;
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  memberships: CompanyGroupMembership[];
  selection: CompanyNetworkNodeSelection | null;
  selectedRelationId: string | null;
  query: string;
  onSelectCompany: (companyId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectRelation: (relationId: string) => void;
};

export default function GroupRadialView({
  group,
  companies,
  relationships,
  memberships,
  selection,
  selectedRelationId,
  query,
  onSelectCompany,
  onSelectGroup,
  onSelectRelation,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panZoom = usePanZoom(svgRef, `group:${group.id}`);
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const groupMemberships = useMemo(
    () => memberships.filter((membership) => membership.groupId === group.id),
    [group.id, memberships],
  );
  const positions = useMemo(() => placeMembers(groupMemberships), [groupMemberships]);
  const neighbourIds = useMemo(
    () => buildSelectedNeighbourIds(selection, relationships, groupMemberships),
    [groupMemberships, relationships, selection],
  );
  const selectedNodeId = selectedGraphNodeId(selection);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const groupNodeId = groupGraphNodeId(group.id);

  return (
    <div className={styles.viewFade}>
      <div className={styles.viewTools}>
        <span>{group.name}の所属企業</span>
        <span>{groupMemberships.length}社 / {relationships.length}企業間関係</span>
      </div>
      <div className={styles.svgWrap}>
        <div className={styles.zoomControls}>
          <button type="button" onClick={panZoom.zoomIn} aria-label="拡大">＋</button>
          <button type="button" onClick={panZoom.zoomOut} aria-label="縮小">−</button>
          <button type="button" onClick={panZoom.reset} disabled={!panZoom.canReset}>戻す</button>
        </div>
        <svg
          ref={svgRef}
          className={`${styles.svg} ${panZoom.panning ? styles.svgGrabbing : styles.svgGrab}`}
          style={{ touchAction: panZoom.viewport.scale === 1 ? "pan-y" : "none" }}
          viewBox="-520 -520 1040 1040"
          role="img"
          aria-label={`${group.name}を中心にした企業グループ放射マップ`}
          onPointerDown={panZoom.onPointerDown}
          onDoubleClick={panZoom.onDoubleClick}
        >
          <defs>
            <marker id="group-radial-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
            </marker>
          </defs>
          <g transform={panZoom.transform}>
            {groupMemberships.length > 12 ? <circle r="405" className={styles.radialGroupRing} /> : null}
            <circle r={groupMemberships.length > 12 ? 245 : 300} className={styles.radialGroupRing} />

            {groupMemberships.map((membership) => {
              const point = positions.get(membership.companyId);
              if (!point) return null;
              const focused = neighbourIds === null || (neighbourIds.has(groupNodeId) && neighbourIds.has(membership.companyId));
              return (
                <line
                  key={membership.membershipId}
                  x1={0}
                  y1={0}
                  x2={point.x}
                  y2={point.y}
                  className={styles.membershipLine}
                  strokeOpacity={focused ? 0.72 : 0.12}
                />
              );
            })}

            {relationships.map((relationship) => {
              const source = positions.get(relationship.sourceCompanyId);
              const target = positions.get(relationship.targetCompanyId);
              if (!source || !target) return null;
              const selected = relationship.relationId === selectedRelationId;
              const focused = neighbourIds === null || (neighbourIds.has(relationship.sourceCompanyId) && neighbourIds.has(relationship.targetCompanyId));
              return (
                <g key={relationship.relationId} onClick={() => onSelectRelation(relationship.relationId)} className={styles.edgeHitTarget}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={CATEGORY_COLOR[relationship.relationCategory]}
                    strokeWidth={selected ? 3.2 : focused ? 1.8 : 1}
                    strokeOpacity={selected ? 1 : focused ? 0.8 : 0.14}
                    strokeDasharray={relationship.verificationStatus === "verified" ? undefined : "7 6"}
                    markerEnd="url(#group-radial-arrow)"
                    color={CATEGORY_COLOR[relationship.relationCategory]}
                  />
                  {(selected || focused) ? (
                    <text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 7} textAnchor="middle" className={styles.svgEdgeLabel}>
                      {relationLabel(relationship.relationType, relationship.ownershipPct)}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {groupMemberships.map((membership) => {
              const company = companyById.get(membership.companyId);
              const point = positions.get(membership.companyId);
              if (!company || !point) return null;
              const selected = selectedNodeId === company.id;
              const queryDimmed = normalizedQuery.length > 0 && !company.name.toLocaleLowerCase("ja").includes(normalizedQuery);
              const neighbourDimmed = neighbourIds !== null && !neighbourIds.has(company.id);
              return (
                <g
                  key={company.id}
                  transform={`translate(${point.x} ${point.y})`}
                  className={queryDimmed || neighbourDimmed ? styles.svgNodeDim : undefined}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => { if (!panZoom.didPan()) onSelectCompany(company.id); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectCompany(company.id);
                    }
                  }}
                >
                  {selected ? <circle className={styles.pulse} r="35" fill="none" stroke="#2554ff" strokeWidth={2} /> : null}
                  <circle r="25" fill="var(--color-bg-card)" stroke="#2554ff" strokeWidth={selected ? 3 : 2} />
                  <text textAnchor="middle" y="-2" className={styles.radialNodeLabel}>{truncate(company.name)}</text>
                  <text textAnchor="middle" y="13" className={styles.radialNodeMeta}>{company.listingStatus || membership.membershipRole}</text>
                </g>
              );
            })}

            <g
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => { if (!panZoom.didPan()) onSelectGroup(group.id); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectGroup(group.id);
                }
              }}
            >
              {selectedNodeId === groupNodeId ? <circle className={styles.pulse} r="78" fill="none" stroke="#d97706" strokeWidth={2} /> : null}
              <circle r="64" fill="#fff7ed" stroke="#d97706" strokeWidth={selectedNodeId === groupNodeId ? 4 : 3} />
              <text textAnchor="middle" y="-4" className={styles.radialGroupLabel}>{truncate(group.name, 14)}</text>
              <text textAnchor="middle" y="14" className={styles.radialGroupMeta}>{groupTypeLabel(group.groupType)}</text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
