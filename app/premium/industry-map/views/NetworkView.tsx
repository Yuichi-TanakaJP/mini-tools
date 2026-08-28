"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../IndustryMap.module.css";
import type { MapContext } from "../context";
import { seedSimNodes, simExtent, stepForce, type SimLink, type SimNode } from "../graph-layout";
import { KIND_COLOR, KIND_LABEL, RELATION_COLOR, RELATION_LABEL } from "../presentation";
import type { RelationType } from "../types";
import { usePanZoom } from "../use-pan-zoom";
import ZoomControls from "./ZoomControls";

type Props = {
  context: MapContext;
  activeIds: Set<string>;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  enabledRelations: Set<RelationType>;
  onToggleRelation: (relation: RelationType) => void;
};

/** 収束するまでの総ステップ数と、1フレームあたりのステップ数。 */
const TOTAL_STEPS = 360;
const STEPS_PER_FRAME = 3;
const SEED_SPREAD = 260;
/** 放射マップと同じく viewBox を固定し、画面上の文字と点の大きさを一定に保つ。 */
const VIEWBOX_HALF = 500;
const LABEL_PADDING = 118;

const ORDERED_RELATIONS: readonly RelationType[] = [
  "contains",
  "part_of",
  "depends_on",
  "enables",
  "used_for",
  "related_to",
];

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function NetworkView({
  context,
  activeIds,
  selectedId,
  onSelect,
  enabledRelations,
  onToggleRelation,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panZoom = usePanZoom(svgRef, context.domain.domain);
  const [frame, setFrame] = useState<{ source: SimNode[]; nodes: SimNode[] } | null>(null);
  const [runId, setRunId] = useState(0);

  const links = useMemo<SimLink[]>(
    () =>
      context.domain.edges
        .filter((edge) => enabledRelations.has(edge.relationType))
        .map((edge) => ({
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          relationType: edge.relationType,
        })),
    [context.domain.edges, enabledRelations],
  );

  /*
   * 初期配置は render 時に決定的に求める。domain か「再配置」で作り直す。
   * 収束の途中経過は effect のローカル配列で進め、フレームごとに複製を state へ渡す。
   * seed が作り直されたフレームは state を捨てるので、古い配置は残らない。
   */
  const seeded = useMemo(
    () => seedSimNodes(context.domain.nodes, SEED_SPREAD),
    // runId は「再配置」ボタンで増える。seed をやり直すためだけに参照する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.domain.nodes, runId],
  );

  useEffect(() => {
    const working = seeded.map((item) => ({ ...item }));
    let steps = 0;
    let handle = 0;
    const advance = () => {
      for (let i = 0; i < STEPS_PER_FRAME; i += 1) stepForce(working, links);
      steps += STEPS_PER_FRAME;
      setFrame({ source: seeded, nodes: working.map((item) => ({ ...item })) });
      if (steps < TOTAL_STEPS) handle = requestAnimationFrame(advance);
    };
    handle = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(handle);
  }, [seeded, links]);

  const restart = useCallback(() => {
    setRunId((current) => current + 1);
  }, []);

  const simNodes = frame?.source === seeded ? frame.nodes : seeded;
  const positions = useMemo(() => new Map(simNodes.map((item) => [item.id, item])), [simNodes]);
  const fit = (VIEWBOX_HALF - LABEL_PADDING) / simExtent(simNodes, 240);
  const size = VIEWBOX_HALF * 2;

  const neighbourIds = useMemo(() => {
    if (!selectedId) return null;
    const neighbours = new Set<string>([selectedId]);
    for (const link of links) {
      if (link.sourceId === selectedId) neighbours.add(link.targetId);
      if (link.targetId === selectedId) neighbours.add(link.sourceId);
    }
    return neighbours;
  }, [links, selectedId]);

  return (
    <div className={styles.viewFade}>
      <div className={styles.filterRow}>
        {ORDERED_RELATIONS.map((relation) => {
          const count = context.relationCounts[relation];
          const on = enabledRelations.has(relation);
          return (
            <button
              key={relation}
              type="button"
              className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
              style={on ? { color: RELATION_COLOR[relation] } : undefined}
              disabled={count === 0}
              aria-pressed={on}
              onClick={() => onToggleRelation(relation)}
            >
              <span className={styles.toggleDot} />
              {RELATION_LABEL[relation]} {count}
            </button>
          );
        })}
        <button type="button" className={styles.toggle} onClick={restart}>
          再配置
        </button>
      </div>

      <div className={styles.svgWrap}>
        <ZoomControls panZoom={panZoom} />
        <svg
          ref={svgRef}
          className={`${styles.svg} ${panZoom.panning ? styles.svgGrabbing : styles.svgGrab}`}
          /* 等倍のうちは1本指で画面を縦スクロールでき、拡大後は図の操作に切り替わる。 */
          style={{ touchAction: panZoom.viewport.scale === 1 ? "pan-y" : "none" }}
          viewBox={`${-VIEWBOX_HALF} ${-VIEWBOX_HALF} ${size} ${size}`}
          role="img"
          aria-label={`${context.domain.label}の関係ネットワーク`}
          onPointerDown={panZoom.onPointerDown}
          onDoubleClick={panZoom.onDoubleClick}
        >
          <defs>
            <marker
              id="industry-map-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
            </marker>
          </defs>
          <g transform={panZoom.transform}>
          <g>
            {links.map((link) => {
              const source = positions.get(link.sourceId);
              const target = positions.get(link.targetId);
              if (!source || !target) return null;
              const dimmed =
                neighbourIds !== null &&
                !(neighbourIds.has(link.sourceId) && neighbourIds.has(link.targetId));
              return (
                <line
                  key={link.id}
                  x1={source.x * fit}
                  y1={source.y * fit}
                  x2={target.x * fit}
                  y2={target.y * fit}
                  stroke={RELATION_COLOR[link.relationType]}
                  strokeWidth={dimmed ? 0.8 : 1.6}
                  strokeOpacity={dimmed ? 0.14 : 0.75}
                  markerEnd="url(#industry-map-arrow)"
                  color={RELATION_COLOR[link.relationType]}
                />
              );
            })}
          </g>
          <g>
            {simNodes.map((simNode) => {
              const node = simNode.node;
              const selected = selectedId === simNode.id;
              const dimmed =
                !activeIds.has(simNode.id) ||
                (neighbourIds !== null && !neighbourIds.has(simNode.id));
              const stockCount = (context.stockLinksByNode.get(simNode.id) ?? []).length;
              const radius = stockCount > 0 ? 9 : 6;

              return (
                <g
                  key={simNode.id}
                  transform={`translate(${simNode.x * fit} ${simNode.y * fit})`}
                  className={dimmed ? styles.svgNodeDim : undefined}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    // ドラッグで図を動かしたときは選択しない。
                    if (!panZoom.didPan()) onSelect(simNode.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(simNode.id);
                    }
                  }}
                >
                  <title>{`${node.displayName}（${KIND_LABEL[node.kind]}）`}</title>
                  {selected ? (
                    <circle
                      className={styles.pulse}
                      r={radius + 7}
                      fill="none"
                      stroke={KIND_COLOR[node.kind]}
                      strokeWidth={2}
                    />
                  ) : null}
                  <circle
                    r={radius}
                    fill={stockCount > 0 ? KIND_COLOR[node.kind] : "var(--color-bg-card)"}
                    stroke={KIND_COLOR[node.kind]}
                    strokeWidth={selected ? 3 : 2}
                  />
                  <text className={styles.svgLabel} x={radius + 5} dominantBaseline="middle">
                    {truncate(node.displayName, 14)}
                  </text>
                </g>
              );
            })}
          </g>
          </g>
        </svg>
      </div>

      <div className={styles.legend}>
        {ORDERED_RELATIONS.filter((relation) => context.relationCounts[relation] > 0).map(
          (relation) => (
            <span key={relation} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ background: RELATION_COLOR[relation] }}
              />
              {RELATION_LABEL[relation]}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
