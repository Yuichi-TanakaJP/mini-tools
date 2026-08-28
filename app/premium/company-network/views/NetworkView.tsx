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
  selectedCompanyId,
  selectedRelationId,
  query,
  onSelectCompany,
  onSelectRelation,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState<{ source: SimNode[]; nodes: SimNode[] } | null>(null);
  const [runId, setRunId] = useState(0);

  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);

  const selectedComponent = useMemo(() => {
    const companyIds = new Set<string>(selectedCompanyId ? [selectedCompanyId] : []);
    const groupIds = new Set<string>();
    let changed = true;

    while (changed) {
      changed = false;

      for (const relationship of relationships) {
        if (!companyIds.has(relationship.sourceCompanyId) && !companyIds.has(relationship.targetCompanyId)) continue;
        if (!companyIds.has(relationship.sourceCompanyId)) {
          companyIds.add(relationship.sourceCompanyId);
          changed = true;
        }
        if (!companyIds.has(relationship.targetCompanyId)) {
          companyIds.add(relationship.targetCompanyId);
          changed = true;
        }
      }

      for (const membership of memberships) {
        if (!companyIds.has(membership.companyId) && !groupIds.has(membership.groupId)) continue;
        if (!companyIds.has(membership.companyId)) {
          companyIds.add(membership.companyId);
          changed = true;
        }
        if (!groupIds.has(membership.groupId)) {
          groupIds.add(membership.groupId);
          changed = true;
        }
      }
    }

    const visibleRelationships = relationships.filter(
      (relationship) => companyIds.has(relationship.sourceCompanyId) && companyIds.has(relationship.targetCompanyId),
    );
    const visibleMemberships = memberships.filter(
      (membership) => companyIds.has(membership.companyId) && groupIds.has(membership.groupId),
    );

    return { companyIds, groupIds, relationships: visibleRelationships, memberships: visibleMemberships };
  }, [memberships, relationships, selectedCompanyId]);

  const resetKey = `${selectedCompanyId}|${selectedComponent.relationships.map((item) => item.relationId).join(":")}|${selectedComponent.memberships.map((item) => item.membershipId).join(":")}`;
  const panZoom = usePanZoom(svgRef, resetKey);

  const graph = useMemo(() => {
    const nodes: VisualNode[] = [...selectedComponent.companyIds]
      .map((companyId) => companyById.get(companyId))
      .filter((company): company is CompanyNetworkCompany => Boolean(company))
      .map((company) => ({ id: company.id, label: company.name, kind: "company" as const, company }));

    const groupById = new Map(selectedComponent.memberships.map((membership) => [membership.groupId, membership]));
    for (const membership of groupById.values()) {
      nodes.push({
        id: `group:${membership.groupId}`,
        label: membership.groupName,
        kind: "group",
        groupId: membership.groupId,
        groupType: membership.groupType,
      });
    }

    const links: SimLink[] = [
      ...selectedComponent.relationships.map((relationship) => ({
        id: relationship.relationId,
        sourceId: relationship.sourceCompanyId,
        targetId: relationship.targetCompanyId,
        kind: "relationship" as const,
      })),
      ...selectedComponent.memberships.map((membership) => ({
        id: membership.membershipId,
        sourceId: membership.companyId,
        targetId: `group:${membership.groupId}`,
        kind: "membership" as const,
      })),
    ];

    return { nodes, links };
  }, [companyById, selectedComponent]);

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
  const queryMatch = (node: SimNode) =>
    normalizedQuery.length === 0 || node.label.toLocaleLowerCase("ja").includes(normalizedQuery);

  return (
    <div className={styles.viewFade}>
      <div className={styles.viewTools}>
        <span>選択企業の関係ネットワーク</span>
        <button type="button" className={styles.smallButton} onClick={() => setRunId((value) => value + 1)}>
          再配置
        </button>
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
          viewBox={`${-VIEWBOX_HALF} ${-VIEWBOX_HALF} ${size} ${size}`}
          role="img"
          aria-label="選択企業につながる企業関係ネットワーク"
          onPointerDown={panZoom.onPointerDown}
          onDoubleClick={panZoom.onDoubleClick}
        >
          <defs>
            <marker id="company-relation-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
            </marker>
          </defs>
          <g transform={panZoom.transform}>
            {selectedComponent.relationships.map((relationship) => {
              const source = positions.get(relationship.sourceCompanyId);
              const target = positions.get(relationship.targetCompanyId);
              if (!source || !target) return null;
              const selected = relationship.relationId === selectedRelationId;
              return (
                <g key={relationship.relationId}>
                  <line
                    x1={source.x * fit}
                    y1={source.y * fit}
                    x2={target.x * fit}
                    y2={target.y * fit}
                    stroke={CATEGORY_COLOR[relationship.relationCategory]}
                    strokeWidth={selected ? 3.2 : 1.7}
                    strokeOpacity={selected ? 1 : 0.85}
                    strokeDasharray={relationship.verificationStatus === "verified" ? undefined : "7 6"}
                    markerEnd="url(#company-relation-arrow)"
                    color={CATEGORY_COLOR[relationship.relationCategory]}
                    onClick={() => onSelectRelation(relationship.relationId)}
                    className={styles.edgeHitTarget}
                  />
                  <text
                    x={((source.x + target.x) / 2) * fit}
                    y={((source.y + target.y) / 2) * fit - 7}
                    textAnchor="middle"
                    className={styles.svgEdgeLabel}
                  >
                    {relationLabel(relationship.relationType, relationship.ownershipPct)}
                  </text>
                </g>
              );
            })}

            {selectedComponent.memberships.map((membership) => {
              const source = positions.get(membership.companyId);
              const target = positions.get(`group:${membership.groupId}`);
              if (!source || !target) return null;
              return (
                <line
                  key={membership.membershipId}
                  x1={source.x * fit}
                  y1={source.y * fit}
                  x2={target.x * fit}
                  y2={target.y * fit}
                  className={styles.membershipLine}
                  strokeOpacity={membership.companyId === selectedCompanyId ? 0.95 : 0.65}
                />
              );
            })}

            {nodes.map((node) => {
              const selected = node.id === selectedCompanyId;
              const dimmed = normalizedQuery.length > 0 && !queryMatch(node);
              const radius = node.kind === "group" ? 9 : selected ? 11 : 8;
              const fill = node.kind === "group" ? "#fff7ed" : selected ? "#2554ff" : "var(--color-bg-card)";
              const stroke = node.kind === "group" ? "#d97706" : "#2554ff";
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x * fit} ${node.y * fit})`}
                  className={dimmed ? styles.svgNodeDim : undefined}
                  style={{ cursor: node.kind === "company" ? "pointer" : "default" }}
                  onClick={() => {
                    if (node.kind === "company" && !panZoom.didPan()) onSelectCompany(node.id);
                  }}
                  role={node.kind === "company" ? "button" : undefined}
                  tabIndex={node.kind === "company" ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (node.kind === "company" && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onSelectCompany(node.id);
                    }
                  }}
                >
                  <title>{node.kind === "group" ? `${node.label}（${groupTypeLabel(node.groupType ?? "")}）` : node.label}</title>
                  {selected ? <circle className={styles.pulse} r={radius + 8} fill="none" stroke="#2554ff" strokeWidth={2} /> : null}
                  <circle r={radius} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
                  <text className={styles.svgLabel} x={radius + 6} dominantBaseline="middle">
                    {truncate(node.label)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
