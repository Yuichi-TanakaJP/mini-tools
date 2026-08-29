"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePanZoom } from "../../industry-map/use-pan-zoom";
import styles from "../CompanyNetwork.module.css";
import relationStyles from "../RelationshipViews.module.css";
import { seedSimNodes, simExtent, stepForce, type SimLink, type SimNode, type VisualNode } from "../graph-layout";
import { buildSelectedNeighbourIds, groupGraphNodeId, selectedGraphNodeId } from "../node-selection";
import { CATEGORY_COLOR, groupTypeLabel, relationLabel } from "../presentation";
import type {
  CompanyGroupMembership,
  CompanyNetworkCompany,
  CompanyNetworkNodeSelection,
  CompanyRelationship,
} from "../types";

const TOTAL_STEPS = 300;
const STEPS_PER_FRAME = 3;
const VIEWBOX_HALF = 500;
const LABEL_PADDING = 120;
const SEED_SPREAD = 270;
const COMPACT_SEED_SPREAD = 170;

function truncate(value: string, max = 16) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

type Props = {
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  memberships: CompanyGroupMembership[];
  centerCompanyId: string;
  selection: CompanyNetworkNodeSelection | null;
  selectedRelationId: string | null;
  query: string;
  title?: string;
  compactRelationsOnly?: boolean;
  onSelectCompany: (companyId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectRelation: (relationId: string) => void;
};

export default function NetworkView({
  companies,
  relationships,
  memberships,
  centerCompanyId,
  selection,
  selectedRelationId,
  query,
  title = "中心企業の関係ネットワーク",
  compactRelationsOnly = false,
  onSelectCompany,
  onSelectGroup,
  onSelectRelation,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState<{ source: SimNode[]; nodes: SimNode[] } | null>(null);
  const [runId, setRunId] = useState(0);
  const relationsOnly = compactRelationsOnly || (centerCompanyId.length === 0 && memberships.length === 0);

  const participatingCompanyIds = useMemo(() => {
    const ids = new Set<string>();
    relationships.forEach((relationship) => {
      ids.add(relationship.sourceCompanyId);
      ids.add(relationship.targetCompanyId);
    });
    return ids;
  }, [relationships]);

  const visibleCompanies = useMemo(
    () => relationsOnly ? companies.filter((company) => participatingCompanyIds.has(company.id)) : companies,
    [companies, participatingCompanyIds, relationsOnly],
  );
  const isolatedCompanies = useMemo(
    () => relationsOnly ? companies.filter((company) => !participatingCompanyIds.has(company.id)) : [],
    [companies, participatingCompanyIds, relationsOnly],
  );

  const graphKey = `${relationsOnly ? "compact" : "full"}|${centerCompanyId}|${relationships.map((item) => item.relationId).join(":")}|${memberships.map((item) => item.membershipId).join(":")}`;
  const panZoom = usePanZoom(svgRef, graphKey);

  const graph = useMemo(() => {
    const nodes: VisualNode[] = visibleCompanies.map((company) => ({ id: company.id, label: company.name, kind: "company" as const, company }));
    const groupById = new Map(memberships.map((membership) => [membership.groupId, membership]));
    for (const membership of groupById.values()) {
      nodes.push({ id: groupGraphNodeId(membership.groupId), label: membership.groupName, kind: "group" as const, groupId: membership.groupId, groupType: membership.groupType });
    }
    const links: SimLink[] = [
      ...relationships.map((relationship) => ({ id: relationship.relationId, sourceId: relationship.sourceCompanyId, targetId: relationship.targetCompanyId, kind: "relationship" as const })),
      ...memberships.map((membership) => ({ id: membership.membershipId, sourceId: membership.companyId, targetId: groupGraphNodeId(membership.groupId), kind: "membership" as const })),
    ];
    return { nodes, links };
  }, [memberships, relationships, visibleCompanies]);

  const seeded = useMemo(() => {
    void runId;
    return seedSimNodes(graph.nodes, relationsOnly ? COMPACT_SEED_SPREAD : SEED_SPREAD);
  }, [graph.nodes, relationsOnly, runId]);

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
  const fit = (VIEWBOX_HALF - LABEL_PADDING) / simExtent(nodes, relationsOnly ? 135 : 240);
  const size = VIEWBOX_HALF * 2;
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const selectedNodeId = selectedGraphNodeId(selection);
  const selectedNeighbours = useMemo(
    () => buildSelectedNeighbourIds(selection, relationships, memberships),
    [memberships, relationships, selection],
  );

  return (
    <div className={styles.viewFade}>
      <div className={styles.viewTools}>
        <span>{title}</span>
        <span className={relationStyles.relationMeta}>{visibleCompanies.length}社 · {relationships.length}関係</span>
        <button type="button" className={styles.smallButton} onClick={() => setRunId((value) => value + 1)}>再配置</button>
      </div>
      {relationsOnly ? (
        <p className={relationStyles.relationIntro}>企業間relationが確認できている会社だけをグラフ本体に表示しています。所属しているだけの会社は下の「関係未登録」に分け、線の意味を読みやすくしています。</p>
      ) : null}
      <div className={`${styles.svgWrap} ${relationsOnly ? relationStyles.compactGraph : ""}`}>
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
              const focused = selectedNeighbours === null || (selectedNeighbours.has(relationship.sourceCompanyId) && selectedNeighbours.has(relationship.targetCompanyId));
              return <g key={relationship.relationId}>
                <line x1={source.x * fit} y1={source.y * fit} x2={target.x * fit} y2={target.y * fit} stroke={CATEGORY_COLOR[relationship.relationCategory]} strokeWidth={selected ? 3.6 : focused ? 2.2 : 1.2} strokeOpacity={selected ? 1 : focused ? 0.9 : 0.22} strokeDasharray={relationship.verificationStatus === "verified" ? undefined : "7 6"} markerEnd="url(#company-relation-arrow)" color={CATEGORY_COLOR[relationship.relationCategory]} onClick={() => onSelectRelation(relationship.relationId)} className={styles.edgeHitTarget} />
                {(focused || selected) ? <text x={((source.x + target.x) / 2) * fit} y={((source.y + target.y) / 2) * fit - 9} textAnchor="middle" className={styles.svgEdgeLabel}>{relationLabel(relationship.relationType, relationship.ownershipPct)}</text> : null}
              </g>;
            })}
            {memberships.map((membership) => {
              const source = positions.get(membership.companyId);
              const target = positions.get(groupGraphNodeId(membership.groupId));
              if (!source || !target) return null;
              const focused = selection?.kind === "group"
                ? selection.id === membership.groupId
                : selection?.kind === "company"
                  ? selection.id === membership.companyId
                  : true;
              return <line key={membership.membershipId} x1={source.x * fit} y1={source.y * fit} x2={target.x * fit} y2={target.y * fit} className={styles.membershipLine} strokeOpacity={focused ? 0.9 : 0.2} />;
            })}
            {nodes.map((node) => {
              const selected = node.id === selectedNodeId;
              const center = node.kind === "company" && node.id === centerCompanyId;
              const queryDimmed = normalizedQuery.length > 0 && !node.label.toLocaleLowerCase("ja").includes(normalizedQuery);
              const neighbourDimmed = selectedNeighbours !== null && !selectedNeighbours.has(node.id);
              const dimmed = queryDimmed || neighbourDimmed;
              const baseRadius = relationsOnly ? 10 : 8;
              const radius = node.kind === "group" ? (selected ? 11 : 9) : center ? 11 : selected ? baseRadius + 2 : baseRadius;
              const fill = node.kind === "group" ? "#fff7ed" : center ? "#2554ff" : "var(--color-bg-card)";
              const stroke = node.kind === "group" ? "#d97706" : "#2554ff";
              return <g
                key={node.id}
                transform={`translate(${node.x * fit} ${node.y * fit})`}
                className={dimmed ? styles.svgNodeDim : undefined}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  if (panZoom.didPan()) return;
                  if (node.kind === "company") onSelectCompany(node.id);
                  else if (node.groupId) onSelectGroup(node.groupId);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  if (node.kind === "company") onSelectCompany(node.id);
                  else if (node.groupId) onSelectGroup(node.groupId);
                }}
              >
                <title>{node.kind === "group" ? `${node.label}（${groupTypeLabel(node.groupType ?? "")}）` : node.label}</title>
                {selected ? <circle className={styles.pulse} r={radius + 8} fill="none" stroke={stroke} strokeWidth={2} /> : null}
                <circle r={radius} fill={fill} stroke={stroke} strokeWidth={selected || center ? 3 : 2} />
                <text className={styles.svgLabel} x={radius + 7} dominantBaseline="middle">{truncate(node.label)}</text>
              </g>;
            })}
          </g>
        </svg>
      </div>

      {isolatedCompanies.length > 0 ? (
        <section className={relationStyles.isolatedSection}>
          <div className={relationStyles.isolatedHead}>
            <div><span>RELATION NOT REGISTERED</span><strong>関係未登録のグループ企業</strong></div>
            <b>{isolatedCompanies.length}社</b>
          </div>
          <p>グループ所属は確認済みですが、現在の企業間relationデータには参加していません。関係がないことを意味するのではなく、未登録として分離しています。</p>
          <div className={relationStyles.isolatedCompanies}>
            {isolatedCompanies.map((company) => (
              <button key={company.id} type="button" onClick={() => onSelectCompany(company.id)}>{company.name}</button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}