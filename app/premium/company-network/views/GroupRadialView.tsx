"use client";

import { useMemo, useRef } from "react";
import { usePanZoom } from "../../industry-map/use-pan-zoom";
import { groupGraphNodeId, selectedGraphNodeId } from "../node-selection";
import styles from "../CompanyNetwork.module.css";
import { groupTypeLabel } from "../presentation";
import type {
  CompanyGroupMembership,
  CompanyNetworkCompany,
  CompanyNetworkGroup,
  CompanyNetworkNodeSelection,
} from "../types";

type Point = { x: number; y: number };

function truncate(value: string, max = 12) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function listingLabel(value: string) {
  if (value === "domestic_listed") return "上場";
  if (value === "foreign_listed") return "海外上場";
  if (value === "private") return "非上場";
  return "未確認";
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
  memberships: CompanyGroupMembership[];
  selection: CompanyNetworkNodeSelection | null;
  focusCompanyId: string;
  query: string;
  onSelectCompany: (companyId: string) => void;
  onSelectGroup: (groupId: string) => void;
};

export default function GroupRadialView({
  group,
  companies,
  memberships,
  selection,
  focusCompanyId,
  query,
  onSelectCompany,
  onSelectGroup,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panZoom = usePanZoom(svgRef, `group:${group.id}`);
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const groupMemberships = useMemo(
    () => memberships.filter((membership) => membership.groupId === group.id),
    [group.id, memberships],
  );
  const positions = useMemo(() => placeMembers(groupMemberships), [groupMemberships]);
  const selectedNodeId = selectedGraphNodeId(selection);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const groupNodeId = groupGraphNodeId(group.id);

  return (
    <div className={styles.viewFade}>
      <div className={styles.viewTools}>
        <span>{group.name}の所属企業</span>
        <span>{groupMemberships.length}社</span>
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
          aria-label={`${group.name}の所属企業を示す放射マップ`}
          onPointerDown={panZoom.onPointerDown}
          onDoubleClick={panZoom.onDoubleClick}
        >
          <g transform={panZoom.transform}>
            {groupMemberships.length > 12 ? <circle r="405" className={styles.radialGroupRing} /> : null}
            <circle r={groupMemberships.length > 12 ? 245 : 300} className={styles.radialGroupRing} />

            {groupMemberships.map((membership) => {
              const point = positions.get(membership.companyId);
              if (!point) return null;
              const focused = !focusCompanyId || focusCompanyId === membership.companyId;
              return (
                <line
                  key={membership.membershipId}
                  x1={0}
                  y1={0}
                  x2={point.x}
                  y2={point.y}
                  className={styles.membershipLine}
                  strokeOpacity={focused ? 0.72 : 0.22}
                />
              );
            })}

            {groupMemberships.map((membership) => {
              const company = companyById.get(membership.companyId);
              const point = positions.get(membership.companyId);
              if (!company || !point) return null;
              const selected = selectedNodeId === company.id;
              const focused = !focusCompanyId || focusCompanyId === company.id;
              const queryDimmed = normalizedQuery.length > 0 && !company.name.toLocaleLowerCase("ja").includes(normalizedQuery);
              return (
                <g
                  key={company.id}
                  transform={`translate(${point.x} ${point.y})`}
                  className={queryDimmed || !focused ? styles.svgNodeDim : undefined}
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
                  <circle r="25" fill="var(--color-bg-card)" stroke="#2554ff" strokeWidth={selected || focusCompanyId === company.id ? 3 : 2} />
                  <text textAnchor="middle" y="-2" className={styles.radialNodeLabel}>{truncate(company.name)}</text>
                  <text textAnchor="middle" y="13" className={styles.radialNodeMeta}>{listingLabel(company.listingStatus)}</text>
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