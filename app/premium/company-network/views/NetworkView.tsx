"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePanZoom } from "../../industry-map/use-pan-zoom";
import styles from "../CompanyNetwork.module.css";
import relationStyles from "../RelationshipViews.module.css";
import claudeStyles from "../ClaudeUi.module.css";
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
const FULL_VIEWBOX_HALF = 500;
const COMPACT_VIEWBOX_HALF = 320;
const SEED_SPREAD = 270;
const COMPACT_SEED_SPREAD = 150;
const HIGH_DEGREE_MIN_RELATIONS = 10;
const HIGH_DEGREE_RATIO = 0.6;
const STAR_LABEL_LINE_LENGTH = 9;
const STAR_LABEL_FONT_SIZE = 11;
const STAR_LABEL_RADIUS = 11;
const STAR_LABEL_GAP = 7;

function truncate(value: string, max = 16) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function wrapStarLabel(value: string) {
  const characters = Array.from(value.trim());
  if (characters.length <= STAR_LABEL_LINE_LENGTH) return [characters.join("")];

  let splitAt = STAR_LABEL_LINE_LENGTH;
  const firstWindow = characters.slice(0, STAR_LABEL_LINE_LENGTH + 1).join("");
  const lastSpace = firstWindow.lastIndexOf(" ");
  if (lastSpace >= 4) splitAt = Array.from(firstWindow.slice(0, lastSpace)).length;

  const first = characters.slice(0, splitAt).join("").trim();
  const remaining = characters.slice(splitAt).join("").trim();
  const remainingCharacters = Array.from(remaining);
  const second = remainingCharacters.length <= STAR_LABEL_LINE_LENGTH
    ? remaining
    : `${remainingCharacters.slice(0, STAR_LABEL_LINE_LENGTH - 1).join("")}…`;

  return second ? [first, second] : [first];
}

function estimateSvgTextWidth(value: string, fontSize = STAR_LABEL_FONT_SIZE) {
  return Array.from(value).reduce((width, character) => {
    if (character === " ") return width + fontSize * 0.35;
    if (/^[\u0000-\u00ff]$/.test(character)) return width + fontSize * 0.6;
    return width + fontSize;
  }, 0);
}

function fitHighDegreeLabels(
  nodes: SimNode[],
  hubId: string,
  viewBoxHalf: number,
  geometryFit: number,
) {
  let labelFit = geometryFit;
  const edgeSafeArea = 10;
  const labelOffset = STAR_LABEL_RADIUS + STAR_LABEL_GAP;

  for (const node of nodes) {
    if (node.id === hubId || Math.abs(node.x) < 1) continue;
    const lines = wrapStarLabel(node.label);
    const labelWidth = Math.max(...lines.map((line) => estimateSvgTextWidth(line)));
    const availableForNodeX = viewBoxHalf - edgeSafeArea - labelOffset - labelWidth;
    if (availableForNodeX <= 0) continue;
    labelFit = Math.min(labelFit, availableForNodeX / Math.abs(node.x));
  }

  return Math.max(0.36, labelFit);
}

function findHighDegreeHub(relationships: CompanyRelationship[]) {
  if (relationships.length < HIGH_DEGREE_MIN_RELATIONS) return null;
  const degree = new Map<string, number>();
  relationships.forEach((relationship) => {
    degree.set(relationship.sourceCompanyId, (degree.get(relationship.sourceCompanyId) ?? 0) + 1);
    degree.set(relationship.targetCompanyId, (degree.get(relationship.targetCompanyId) ?? 0) + 1);
  });

  let hubId: string | null = null;
  let hubDegree = 0;
  degree.forEach((value, companyId) => {
    if (value > hubDegree) {
      hubId = companyId;
      hubDegree = value;
    }
  });

  return hubId && hubDegree / relationships.length >= HIGH_DEGREE_RATIO ? hubId : null;
}

function positioned(node: VisualNode, x: number, y: number): SimNode {
  return { ...node, x, y, vx: 0, vy: 0 };
}

/**
 * NTTのような高次数starではforce simulationよりも、hubを中心に固定して
 * 周辺会社をリングへ整列した方が関係の全体像とラベルを同時に読みやすい。
 */
function layoutHighDegreeStar(
  nodes: VisualNode[],
  relationships: CompanyRelationship[],
  hubId: string,
): SimNode[] {
  const directIds = new Set<string>();
  relationships.forEach((relationship) => {
    if (relationship.sourceCompanyId === hubId) directIds.add(relationship.targetCompanyId);
    if (relationship.targetCompanyId === hubId) directIds.add(relationship.sourceCompanyId);
  });

  const hub = nodes.find((node) => node.id === hubId);
  if (!hub) return seedSimNodes(nodes, COMPACT_SEED_SPREAD);

  const direct = nodes
    .filter((node) => node.id !== hubId && directIds.has(node.id))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));
  const remaining = nodes
    .filter((node) => node.id !== hubId && !directIds.has(node.id))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));

  const placed = new Map<string, SimNode>([[hubId, positioned(hub, 0, 0)]]);

  const placeRing = (ringNodes: VisualNode[], radius: number, offset = 0) => {
    const count = ringNodes.length;
    ringNodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + offset + (Math.PI * 2 * index) / Math.max(count, 1);
      placed.set(node.id, positioned(node, Math.cos(angle) * radius, Math.sin(angle) * radius));
    });
  };

  if (direct.length <= 16) {
    const radius = Math.max(220, Math.min(310, (direct.length * 125) / (Math.PI * 2)));
    placeRing(direct, radius);
  } else {
    const radii = [160, 255, 350];
    let cursor = 0;
    radii.forEach((radius, ringIndex) => {
      if (cursor >= direct.length) return;
      const capacity = Math.max(1, Math.floor((Math.PI * 2 * radius) / 125));
      const end = ringIndex === radii.length - 1
        ? direct.length
        : Math.min(direct.length, cursor + capacity);
      const ringNodes = direct.slice(cursor, end);
      placeRing(ringNodes, radius, ringIndex % 2 === 1 ? Math.PI / Math.max(ringNodes.length, 1) : 0);
      cursor = end;
    });
  }

  if (remaining.length > 0) placeRing(remaining, 430, Math.PI / Math.max(remaining.length, 1));

  return nodes.map((node) => placed.get(node.id) ?? positioned(node, 0, 0));
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
  const graphSelection = relationsOnly && selection?.kind === "company" && !participatingCompanyIds.has(selection.id)
    ? null
    : selection;

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

  const highDegreeHubId = useMemo(
    () => relationsOnly ? findHighDegreeHub(relationships) : null,
    [relationsOnly, relationships],
  );

  const highDegreeNodes = useMemo(
    () => highDegreeHubId ? layoutHighDegreeStar(graph.nodes, relationships, highDegreeHubId) : null,
    [graph.nodes, highDegreeHubId, relationships],
  );

  const seeded = useMemo(() => {
    void runId;
    return seedSimNodes(graph.nodes, relationsOnly ? COMPACT_SEED_SPREAD : SEED_SPREAD);
  }, [graph.nodes, relationsOnly, runId]);

  useEffect(() => {
    if (highDegreeNodes) return;
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
  }, [graph.links, highDegreeNodes, seeded]);

  const nodes = highDegreeNodes ?? (frame?.source === seeded ? frame.nodes : seeded);
  const positions = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const viewBoxHalf = relationsOnly ? COMPACT_VIEWBOX_HALF : FULL_VIEWBOX_HALF;
  const labelPadding = highDegreeHubId ? 64 : relationsOnly ? 72 : 120;
  const minimumExtent = highDegreeHubId ? 260 : relationsOnly ? 105 : 240;
  const geometryFit = (viewBoxHalf - labelPadding) / simExtent(nodes, minimumExtent);
  const fit = highDegreeHubId
    ? fitHighDegreeLabels(nodes, highDegreeHubId, viewBoxHalf, geometryFit)
    : geometryFit;
  const size = viewBoxHalf * 2;
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const selectedNodeId = selectedGraphNodeId(graphSelection);
  const selectedNeighbours = useMemo(
    () => buildSelectedNeighbourIds(graphSelection, relationships, memberships),
    [graphSelection, memberships, relationships],
  );

  return (
    <div className={`${claudeStyles.view} ${styles.viewFade}`}>
      <div className={styles.viewTools}>
        <span>{title}</span>
        <span className={relationStyles.relationMeta}>{visibleCompanies.length}社 · {relationships.length}関係</span>
        {!highDegreeHubId ? <button type="button" className={styles.smallButton} onClick={() => setRunId((value) => value + 1)}>再配置</button> : null}
      </div>
      {relationsOnly ? (
        <p className={claudeStyles.networkIntro}>
          {highDegreeHubId
            ? "高密度の中心企業を固定して周辺企業を整列しています。持株比率などの関係ラベルは線を選択すると表示します。"
            : "確認済みの企業間relationだけを主図に表示。所属のみの企業は下へ分離しています。"}
        </p>
      ) : null}
      <div className={`${styles.svgWrap} ${relationsOnly ? relationStyles.compactGraph : ""} ${relationsOnly ? claudeStyles.networkCanvas : ""}`}>
        <div className={styles.zoomControls}>
          <button type="button" onClick={panZoom.zoomIn} aria-label="拡大">＋</button>
          <button type="button" onClick={panZoom.zoomOut} aria-label="縮小">−</button>
          <button type="button" onClick={panZoom.reset} disabled={!panZoom.canReset}>戻す</button>
        </div>
        <svg
          ref={svgRef}
          className={`${styles.svg} ${relationsOnly ? claudeStyles.networkSvg : ""} ${panZoom.panning ? styles.svgGrabbing : styles.svgGrab}`}
          style={{ touchAction: panZoom.viewport.scale === 1 ? "pan-y" : "none" }}
          viewBox={`${-viewBoxHalf} ${-viewBoxHalf} ${size} ${size}`}
          role="img"
          aria-label="企業関係ネットワーク"
          onPointerDown={panZoom.onPointerDown}
          onDoubleClick={panZoom.onDoubleClick}
        >
          <defs><marker id="company-relation-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" /></marker></defs>
          <g transform={panZoom.transform}>
            {relationships.map((relationship) => {
              const source = positions.get(relationship.sourceCompanyId);
              const target = positions.get(relationship.targetCompanyId);
              if (!source || !target) return null;
              const selected = relationship.relationId === selectedRelationId;
              const focused = selectedNeighbours === null || (selectedNeighbours.has(relationship.sourceCompanyId) && selectedNeighbours.has(relationship.targetCompanyId));
              const selectedCompanyId = graphSelection?.kind === "company" ? graphSelection.id : null;
              const selectedLeafRelation = Boolean(
                highDegreeHubId &&
                selectedCompanyId &&
                selectedCompanyId !== highDegreeHubId &&
                (relationship.sourceCompanyId === selectedCompanyId || relationship.targetCompanyId === selectedCompanyId),
              );
              const showEdgeLabel = highDegreeHubId ? selected || selectedLeafRelation : focused || selected;
              const strokeWidth = highDegreeHubId ? (selected ? 3.2 : 1.5) : selected ? 3.6 : focused ? 2.2 : 1.2;
              const strokeOpacity = highDegreeHubId ? (selected ? 1 : 0.62) : selected ? 1 : focused ? 0.9 : 0.22;
              return <g key={relationship.relationId}>
                <line x1={source.x * fit} y1={source.y * fit} x2={target.x * fit} y2={target.y * fit} stroke={CATEGORY_COLOR[relationship.relationCategory]} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} strokeDasharray={relationship.verificationStatus === "verified" ? undefined : "7 6"} markerEnd="url(#company-relation-arrow)" color={CATEGORY_COLOR[relationship.relationCategory]} onClick={() => onSelectRelation(relationship.relationId)} className={styles.edgeHitTarget} />
                {showEdgeLabel ? <text x={((source.x + target.x) / 2) * fit} y={((source.y + target.y) / 2) * fit - (relationsOnly ? 13 : 9)} textAnchor="middle" className={styles.svgEdgeLabel} style={relationsOnly ? { fontSize: highDegreeHubId ? 10 : 12 } : undefined}>{relationLabel(relationship.relationType, relationship.ownershipPct)}</text> : null}
              </g>;
            })}
            {memberships.map((membership) => {
              const source = positions.get(membership.companyId);
              const target = positions.get(groupGraphNodeId(membership.groupId));
              if (!source || !target) return null;
              const focused = graphSelection?.kind === "group"
                ? graphSelection.id === membership.groupId
                : graphSelection?.kind === "company"
                  ? graphSelection.id === membership.companyId
                  : true;
              return <line key={membership.membershipId} x1={source.x * fit} y1={source.y * fit} x2={target.x * fit} y2={target.y * fit} className={styles.membershipLine} strokeOpacity={focused ? 0.9 : 0.2} />;
            })}
            {nodes.map((node) => {
              const selected = node.id === selectedNodeId;
              const hubCenter = node.kind === "company" && node.id === highDegreeHubId;
              const center = node.kind === "company" && (node.id === centerCompanyId || hubCenter);
              const queryDimmed = normalizedQuery.length > 0 && !node.label.toLocaleLowerCase("ja").includes(normalizedQuery);
              const neighbourDimmed = selectedNeighbours !== null && !selectedNeighbours.has(node.id);
              const dimmed = queryDimmed || neighbourDimmed;
              const baseRadius = highDegreeHubId ? STAR_LABEL_RADIUS : relationsOnly ? 14 : 8;
              const radius = node.kind === "group" ? (selected ? 11 : 9) : hubCenter ? 17 : center ? 11 : selected ? baseRadius + 2 : baseRadius;
              const fill = node.kind === "group" ? "#fff7ed" : center ? "#2554ff" : "var(--color-bg-card)";
              const stroke = node.kind === "group" ? "#d97706" : "#2554ff";
              const outwardLeft = Boolean(highDegreeHubId && !hubCenter && node.x < 0);
              const labelX = hubCenter ? 0 : outwardLeft ? -(radius + STAR_LABEL_GAP) : radius + STAR_LABEL_GAP;
              const labelLines = highDegreeHubId && !hubCenter ? wrapStarLabel(node.label) : [truncate(node.label, 16)];
              const labelY = hubCenter ? radius + 14 : labelLines.length > 1 ? -6 : 0;
              const labelAnchor = hubCenter ? "middle" : outwardLeft ? "end" : "start";
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
                <text
                  className={styles.svgLabel}
                  x={labelX}
                  y={labelY}
                  textAnchor={labelAnchor}
                  dominantBaseline={hubCenter ? "hanging" : "middle"}
                  style={relationsOnly ? { fontSize: highDegreeHubId ? (hubCenter ? 13 : STAR_LABEL_FONT_SIZE) : 14 } : undefined}
                >
                  {labelLines.map((line, index) => (
                    <tspan key={`${node.id}:${index}`} x={labelX} dy={index === 0 ? 0 : 12}>{line}</tspan>
                  ))}
                </text>
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
