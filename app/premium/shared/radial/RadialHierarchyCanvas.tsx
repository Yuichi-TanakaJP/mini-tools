"use client";

import { useMemo, useRef } from "react";
import { MAX_SCALE, MIN_SCALE, usePanZoom } from "../../industry-map/use-pan-zoom";
import styles from "./RadialHierarchyCanvas.module.css";
import {
  layoutRadialHierarchy,
  type RadialHierarchyNode,
  type RadialLayoutOptions,
} from "./radial-layout";

type Props = {
  roots: RadialHierarchyNode[];
  activeIds?: Set<string>;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  resetKey: unknown;
  ariaLabel: string;
  viewBoxHalf?: number;
  labelPadding?: number;
  layoutOptions?: RadialLayoutOptions;
};

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function RadialHierarchyCanvas({
  roots,
  activeIds,
  selectedId,
  onSelect,
  resetKey,
  ariaLabel,
  viewBoxHalf = 500,
  labelPadding = 118,
  layoutOptions,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panZoom = usePanZoom(svgRef, resetKey);
  const layout = useMemo(
    () => layoutRadialHierarchy(roots, layoutOptions),
    [layoutOptions, roots],
  );
  const safeExtent = Math.max(layout.extent, 1);
  const fit = (viewBoxHalf - labelPadding) / safeExtent;
  const size = viewBoxHalf * 2;

  const selectedAncestors = useMemo(() => {
    const ancestors = new Set<string>();
    let current = selectedId ? layout.parentOf.get(selectedId) : undefined;
    while (current && !ancestors.has(current)) {
      ancestors.add(current);
      current = layout.parentOf.get(current);
    }
    return ancestors;
  }, [layout.parentOf, selectedId]);

  return (
    <div className={styles.wrap}>
      <div className={styles.zoomControls} role="group" aria-label="図の拡大縮小">
        <button
          type="button"
          className={styles.zoomButton}
          onClick={panZoom.zoomIn}
          disabled={panZoom.viewport.scale >= MAX_SCALE}
          aria-label="拡大"
          title="拡大"
        >
          ＋
        </button>
        <span className={styles.zoomLevel}>{Math.round(panZoom.viewport.scale * 100)}%</span>
        <button
          type="button"
          className={styles.zoomButton}
          onClick={panZoom.zoomOut}
          disabled={panZoom.viewport.scale <= MIN_SCALE}
          aria-label="縮小"
          title="縮小"
        >
          −
        </button>
        <button
          type="button"
          className={styles.zoomButton}
          onClick={panZoom.reset}
          disabled={!panZoom.canReset}
          aria-label="表示を元に戻す"
          title="表示を元に戻す"
        >
          ⟲
        </button>
      </div>

      <svg
        ref={svgRef}
        className={`${styles.svg} ${panZoom.panning ? styles.grabbing : styles.grab}`}
        style={{ touchAction: panZoom.viewport.scale === 1 ? "pan-y" : "none" }}
        viewBox={`${-viewBoxHalf} ${-viewBoxHalf} ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={panZoom.onPointerDown}
        onDoubleClick={panZoom.onDoubleClick}
      >
        <g transform={panZoom.transform}>
          {layout.links.map((link) => {
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
                className={`${styles.link} ${highlighted ? styles.linkActive : styles.linkMuted}`}
                d={`M ${link.from.x * fit} ${link.from.y * fit} Q ${control.x} ${control.y} ${link.to.x * fit} ${link.to.y * fit}`}
                stroke={link.color}
                strokeWidth={highlighted ? Math.max(2, link.width + 0.7) : link.width}
              />
            );
          })}

          {layout.points.map((point) => {
            const active = activeIds ? activeIds.has(point.id) : true;
            const selected = selectedId === point.id;
            const node = point.node;
            const onLeft = Math.cos(point.angle) < 0;
            const labelOffset = node.radius + 7;
            const labelMax = point.depth >= 2 ? 16 : 18;

            return (
              <g
                key={point.id}
                transform={`translate(${point.x * fit} ${point.y * fit})`}
                className={`${styles.node} ${active ? "" : styles.nodeDim}`}
                onClick={() => {
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
                <title>{node.title ?? node.label}</title>
                {selected ? (
                  <circle
                    className={styles.pulse}
                    r={node.radius + 7}
                    fill="none"
                    stroke={node.stroke}
                    strokeWidth={2}
                  />
                ) : null}
                <circle
                  r={node.radius}
                  fill={node.fill}
                  stroke={node.stroke}
                  strokeWidth={selected ? Math.max(3, node.strokeWidth ?? 1.5) : node.strokeWidth ?? 1.5}
                />
                {node.markerColor ? (
                  <circle r={2} cy={-node.radius - 4} fill={node.markerColor} />
                ) : null}
                <text
                  className={styles.label}
                  transform={`rotate(${(point.angle * 180) / Math.PI + (onLeft ? 180 : 0)})`}
                  x={onLeft ? -labelOffset : labelOffset}
                  textAnchor={onLeft ? "end" : "start"}
                  dominantBaseline="middle"
                  fill={node.labelColor ?? "var(--color-text)"}
                  fontSize={node.labelSize ?? 11}
                  fontWeight={node.labelWeight ?? 750}
                >
                  {truncate(node.label, labelMax)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
