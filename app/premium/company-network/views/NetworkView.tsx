"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePanZoom } from "../../industry-map/use-pan-zoom";
import styles from "../CompanyNetwork.module.css";
import { seedSimNodes, simExtent, stepForce, type SimLink, type SimNode, type VisualNode } from "../graph-layout";
import { CATEGORY_COLOR, groupTypeLabel, relationLabel } from "../presentation";
import type { CompanyGroupMembership, CompanyNetworkCompany, CompanyRelationship } from "../types";

const TOTAL_STEPS = 300;
const STEPS_PER_FRAME = 3;
const VIEWBOX_HALF = 500;
const LABEL_PADDING = 120;
const SEED_SPREAD = 270;

function truncate(value: string, max = 16) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

type Props = {
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  memberships: CompanyGroupMembership[];
  centerCompanyId: string;
  selectedCompanyId: string;
  selectedRelationId: string | null;
  query: string;
  onSelectCompany: (companyId: string) => void;
  onSelectRelation: (relationId: string) => void;
};

export default function NetworkView({
  companies,
  relationships,
  memberships,
  centerCompanyId,
  selectedCompanyId,
  selectedRelationId,
  query,
  onSelectCompany,
  onSelectRelation,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState<{ source: SimNode[]; nodes: SimNode[] } | null>(null);
  const [runId, setRunId] = useState(0);
  const graphKey = `${centerCompanyId}|${relationships.map((item) => item.relationId).join(":")}|${memberships.map((item) => item.membershipId).join(":")}`;
  const panZoom = usePanZoom(svgRef, graphKey);

  const graph = useMemo(() => {
    const nodes: VisualNode[] = companies.map((company) => ({ id: company.id, label: company.name, kind: "company" as const, company }));
    const groupById = new Map(memberships.map((membership) => [membership.groupId, membership]));
    for (const membership of groupById.values()) {
      nodes.push({ id: `group:${membership.groupId}`, label: membership.groupName, kind: "group" as const, groupId: membership.groupId, groupType: membership.groupType });
    }
    const links: SimLink[] = [
      ...relationships.map((relationship) => ({ id: relationship.relationId, sourceId: relationship.sourceCompanyId, targetId: relationship.targetCompanyId, kind: "relationship" as const })),
      ...memberships.map((membership) => ({ id: membership.membershipId, sourceId: membership.companyId, targetId: `group:${membership.groupId}`, kind: "membership" as const })),
    ];
    return { nodes, links };
  }, [companies, memberships, relationships]);

  const seeded = useMemo(() => seedSimNodes(graph.nodes, SEED_SPREAD), [graph.nodes, runId]);

  useEffect(() => {
    const working = seeded.map((node) => ({ ...node }));
    let steps = 0;
    let handle = 0;
    const advance = () => {
      for (let index = 0; index < STEPS_PER_FRAME; index += 1) stepForce(working, graph.links);
      steps += STEPS_PER_FRAME;
      setFrame({ source: seeded, nodes: working.map((node) => ({ ...node })) });
      if (steps < TOTAL_STEPS) handle = requestAnimationFrame(advance);
    };
    handle = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(handle);
  }, [graph.links, seeded]);

  const nodes = frame?.source === seeded ? frame.nodes : seeded;
  const positions = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const fit = (VIEWBOX_HALF - LABEL_PADDING) / simExtent(nodes, 240);
  const size = VIEWBOX_HALF * 2;
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");

  const selectedNeighbours = useMemo(() => {
    const ids = new Set<string>(selectedCompanyId ? [selectedCompanyId] : []);
    relationships.forEach((relationship) => {
      if (relationship.sourceCompanyId === selectedCompanyId) ids.add(relationship.targetCompanyId);
      if (relationship.targetCompanyId === selectedCompanyId) ids.add(relationship.sourceCompanyId);
    });
    memberships.forEach((membership) => {
      if (membership.companyId === selectedCompanyId) ids.add(`group:${membership.groupId}`);
    });
    return ids;
  }, [memberships, relationships, selectedCompanyId]);

  return (
    <div className={styles.viewFade}>
      <div className={styles.viewTools}>
        <span>中心企業の関係ネットワーク</span>
        <button type="button" className={styles.smallButton} onClick={() => setRunId((value) => value + 1)}>再配置</button>
      </div>
      <div className={styles.svgWrap}>
        <div className={styles.zoomControls}>
          <button type="button" onClick={panZoom.zoomIn} aria-label="拡大">＋</button>
          <button type="button" onClick={panZoom.zoomOut} aria-label="縮小">−</button>
          <button type="button" onClick={panZoom.reset} disabled={!panZoom.canReset}>戻す</button>
        </div>
        <svg ref={svgRef} className={`${styles.svg} ${panZoom.panning ? styles.svgGrabbing : styles.svgGrab}`} style={{ touchAction: panZoom.viewport.scale === 1 ? "pan-y" : "none" }} viewBox={`${-VIEWBOX_HALF} ${-VIEWBOX_HALF} ${size} ${size}`} role="img" aria-label="企業関係ネットワーク" onPointerDown={panZoom.onPointerDown} onDoubleClick={panZoom.onDoubleClick}>
          <defs><marker id="company-relation-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" /></marker></defs>
          <g transform={panZoom.transform}>
            {relationships.map((relationship) => {
              const source = positions.get(relationship.sourceCompanyId);
              const target = positions.get(relationship.targetCompanyId);
              if (!source || !target) return null;
              const selected = relationship.relationId === selectedRelationId;
              const focused = selectedNeighbours.has(relationship.sourceCompanyId) && selectedNeighbours.has(relationship.targetCompanyId);
              return <g key={relationship.relationId}>
                <line x1={source.x * fit} y1={source.y * fit} x2={target.x * fit} y2={target.y * fit} stroke={CATEGORY_COLOR[relationship.relationCategory]} strokeWidth={selected ? 3.2 : focused ? 1.8 : 1} strokeOpacity={selected ? 1 : focused ? 0.85 : 0.2} strokeDasharray={relationship.verificationStatus === "verified" ? undefined : "7 6"} markerEnd="url(#company-relation-arrow)" color={CATEGORY_COLOR[relationship.relationCategory]} onClick={() => onSelectRelation(relationship.relationId)} className={styles.edgeHitTarget} />
                {(focused || selected) ? <text x={((source.x + target.x) / 2) * fit} y={((source.y + target.y) / 2) * fit - 7} textAnchor="middle" className={styles.svgEdgeLabel}>{relationLabel(relationship.relationType, relationship.ownershipPct)}</text> : null}
              </g>;
            })}
            {memberships.map((membership) => {
              const source = positions.get(membership.companyId);
              const target = positions.get(`group:${membership.groupId}`);
              if (!source || !target) return null;
              const focused = membership.companyId === selectedCompanyId;
              return <line key={membership.membershipId} x1={source.x * fit} y1={source.y * fit} x2={target.x * fit} y2={target.y * fit} className={styles.membershipLine} strokeOpacity={focused ? 0.9 : 0.25} />;
            })}
            {nodes.map((node) => {
              const selected = node.id === selectedCompanyId;
              const center = node.id === centerCompanyId;
              const queryDimmed = normalizedQuery.length > 0 && !node.label.toLocaleLowerCase("ja").includes(normalizedQuery);
              const neighbourDimmed = selectedCompanyId.length > 0 && !selectedNeighbours.has(node.id);
              const dimmed = queryDimmed || neighbourDimmed;
              const radius = node.kind === "group" ? 9 : center ? 11 : selected ? 10 : 8;
              const fill = node.kind === "group" ? "#fff7ed" : center ? "#2554ff" : "var(--color-bg-card)";
              const stroke = node.kind === "group" ? "#d97706" : "#2554ff";
              return <g key={node.id} transform={`translate(${node.x * fit} ${node.y * fit})`} className={dimmed ? styles.svgNodeDim : undefined} style={{ cursor: node.kind === "company" ? "pointer" : "default" }} onClick={() => { if (node.kind === "company" && !panZoom.didPan()) onSelectCompany(node.id); }} role={node.kind === "company" ? "button" : undefined} tabIndex={node.kind === "company" ? 0 : undefined} onKeyDown={(event) => { if (node.kind === "company" && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelectCompany(node.id); } }}>
                <title>{node.kind === "group" ? `${node.label}（${groupTypeLabel(node.groupType ?? "")}）` : node.label}</title>
                {selected ? <circle className={styles.pulse} r={radius + 8} fill="none" stroke="#2554ff" strokeWidth={2} /> : null}
                <circle r={radius} fill={fill} stroke={stroke} strokeWidth={selected || center ? 3 : 2} />
                <text className={styles.svgLabel} x={radius + 6} dominantBaseline="middle">{truncate(node.label)}</text>
              </g>;
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
