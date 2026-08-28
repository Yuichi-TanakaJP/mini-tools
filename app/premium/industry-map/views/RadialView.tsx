"use client";

import { useMemo, useRef } from "react";
import styles from "../IndustryMap.module.css";
import type { MapContext } from "../context";
import { layoutRadial } from "../graph-layout";
import { KIND_COLOR, KIND_LABEL } from "../presentation";
import { usePanZoom } from "../use-pan-zoom";
import ZoomControls from "./ZoomControls";

type Props = {
  context: MapContext;
  activeIds: Set<string>;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
};

const RADIUS_STEP = 100;
/**
 * viewBox は常にこの大きさに正規化する。
 * 環の数が domain ごとに違っても、画面上の文字と点の大きさを一定に保つため。
 */
const VIEWBOX_HALF = 500;
/** ラベルが viewBox からはみ出さないための余白。 */
const LABEL_PADDING = 118;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function RadialView({
  context,
  activeIds,
  selectedId,
  onSelect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panZoom = usePanZoom(svgRef, context.domain.domain);
  const layout = useMemo(
    () => layoutRadial(context.roots, RADIUS_STEP),
    [context.roots],
  );

  // 図の広がりを一定の viewBox へ収める。以降の座標はすべて正規化後の値を使う。
  const fit = (VIEWBOX_HALF - LABEL_PADDING) / layout.extent;
  const size = VIEWBOX_HALF * 2;
  const selectedAncestors = useMemo(() => {
    const ancestors = new Set<string>();
    let current = selectedId ? context.parentOf.get(selectedId) : undefined;
    while (current && !ancestors.has(current)) {
      ancestors.add(current);
      current = context.parentOf.get(current);
    }
    return ancestors;
  }, [context.parentOf, selectedId]);

  return (
    <div className={`${styles.svgWrap} ${styles.viewFade}`}>
      <ZoomControls panZoom={panZoom} />
      <svg
        ref={svgRef}
        className={`${styles.svg} ${panZoom.panning ? styles.svgGrabbing : styles.svgGrab}`}
        /* 等倍のうちは1本指で画面を縦スクロールでき、拡大後は図の操作に切り替わる。 */
        style={{ touchAction: panZoom.viewport.scale === 1 ? "pan-y" : "none" }}
        viewBox={`${-VIEWBOX_HALF} ${-VIEWBOX_HALF} ${size} ${size}`}
        role="img"
        aria-label={`${context.domain.label}の放射マップ`}
        onPointerDown={panZoom.onPointerDown}
        onDoubleClick={panZoom.onDoubleClick}
      >
        <g transform={panZoom.transform}>
        <g>
          {layout.links.map((link, index) => {
            // 親の半径を通る曲線にすると、放射状の枝らしい形になる。
            const control = {
              x: Math.cos(link.to.angle) * link.from.radius * fit,
              y: Math.sin(link.to.angle) * link.from.radius * fit,
            };
            const highlighted =
              selectedId === link.to.id ||
              selectedId === link.from.id ||
              selectedAncestors.has(link.to.id);
            return (
              <path
                key={link.id}
                className={`${styles.svgLink} ${highlighted ? styles.svgLinkActive : ""}`}
                style={{ animationDelay: `${Math.min(index, 60) * 8}ms` }}
                d={`M ${link.from.x * fit} ${link.from.y * fit} Q ${control.x} ${control.y} ${
                  link.to.x * fit
                } ${link.to.y * fit}`}
              />
            );
          })}
        </g>
        <g>
          {layout.points.map((point, index) => {
            const active = activeIds.has(point.id);
            const selected = selectedId === point.id;
            const radius =
              point.depth === 0 ? 13 : Math.max(4, 10 - point.depth * 2);
            const onLeft = Math.cos(point.angle) < 0;
            const labelOffset = radius + 7;
            const stockCount = (context.stockLinksByNode.get(point.id) ?? [])
              .length;

            return (
              /*
               * 位置は transform 属性、登場アニメーションは内側の g に分ける。
               * 同じ要素に両方を書くと CSS の transform が属性を上書きし、
               * すべてのノードが原点へ寄ってしまう。
               */
              <g
                key={point.id}
                transform={`translate(${point.x * fit} ${point.y * fit})`}
                className={active ? undefined : styles.svgNodeDim}
                onClick={() => {
                  // ドラッグで図を動かしたときは選択しない。
                  if (!panZoom.didPan()) onSelect(point.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(point.id);
                  }
                }}
              >
                <g
                  className={styles.svgNode}
                  style={{ animationDelay: `${Math.min(index, 70) * 10}ms` }}
                >
                  <title>{`${point.node.displayName}（${KIND_LABEL[point.node.kind]}）`}</title>
                  {selected ? (
                    <circle
                      className={styles.pulse}
                      r={radius + 8}
                      fill="none"
                      stroke={KIND_COLOR[point.node.kind]}
                      strokeWidth={2}
                    />
                  ) : null}
                  <circle
                    className={styles.svgNodeShape}
                    r={radius}
                    fill={
                      stockCount > 0
                        ? KIND_COLOR[point.node.kind]
                        : "var(--color-bg-card)"
                    }
                    stroke={KIND_COLOR[point.node.kind]}
                    strokeWidth={selected ? 3 : 2}
                  />
                  {point.hasCrossEdges ? (
                    <circle r={2} cy={-radius - 4} fill="var(--rel-depends)" />
                  ) : null}
                  <text
                    className={`${styles.svgLabel} ${point.depth === 0 ? styles.svgLabelStrong : ""}`}
                    transform={`rotate(${(point.angle * 180) / Math.PI + (onLeft ? 180 : 0)})`}
                    x={onLeft ? -labelOffset : labelOffset}
                    textAnchor={onLeft ? "end" : "start"}
                    dominantBaseline="middle"
                  >
                    {truncate(point.node.displayName, 18)}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
        </g>
      </svg>
    </div>
  );
}
