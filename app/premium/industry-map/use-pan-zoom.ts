"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

/**
 * SVG 図の拡大縮小・移動。
 *
 * 座標は viewBox のユーザー座標で扱う。ポインタ位置の変換は `getScreenCTM()` に任せ、
 * preserveAspectRatio によるレターボックスを自前で計算しない。
 *
 * 計算部分（clampScale / zoomAt / panBy）は純関数として切り出し、vitest で検証する。
 */

export type Viewport = {
  scale: number;
  /** 拡大後の平行移動量。viewBox のユーザー座標。 */
  x: number;
  y: number;
};

export const IDENTITY_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 8;

/** ボタン1回あたりの倍率。 */
export const STEP_FACTOR = 1.4;

/** ドラッグとクリックを分ける移動量のしきい値（ユーザー座標）。 */
export const DRAG_THRESHOLD = 6;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * 指定した点を固定したまま拡大縮小する。
 * 画面上の位置 s = scale * p + offset を保つように offset を求め直す。
 */
export function zoomAt(viewport: Viewport, factor: number, px: number, py: number): Viewport {
  const scale = clampScale(viewport.scale * factor);
  // clamp で頭打ちになった場合は、実際に適用された倍率で位置を合わせる。
  const applied = scale / viewport.scale;
  return {
    scale,
    x: px - applied * (px - viewport.x),
    y: py - applied * (py - viewport.y),
  };
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { scale: viewport.scale, x: viewport.x + dx, y: viewport.y + dy };
}

export function isIdentity(viewport: Viewport): boolean {
  return viewport.scale === 1 && viewport.x === 0 && viewport.y === 0;
}

export function toTransform(viewport: Viewport): string {
  return `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`;
}

type Point = { x: number; y: number };

function toUserPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: point.x, y: point.y };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export type PanZoom = {
  viewport: Viewport;
  transform: string;
  canReset: boolean;
  panning: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** ドラッグ直後かどうか。ノードのクリック処理で誤選択を防ぐために見る。 */
  didPan: () => boolean;
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onDoubleClick: (event: PointerEvent<SVGSVGElement>) => void;
};

/**
 * @param svgRef 対象の `<svg>`
 * @param resetKey 変わったら初期状態へ戻す値。domain の切り替えなどに使う
 */
export function usePanZoom(
  svgRef: RefObject<SVGSVGElement | null>,
  resetKey: unknown,
): PanZoom {
  // resetKey が変わったら effect ではなく描画時に初期値へ戻す。
  const [state, setState] = useState<{ key: unknown; viewport: Viewport }>({
    key: resetKey,
    viewport: IDENTITY_VIEWPORT,
  });
  const [panning, setPanning] = useState(false);

  const viewport = state.key === resetKey ? state.viewport : IDENTITY_VIEWPORT;

  const update = useCallback(
    (next: (current: Viewport) => Viewport) => {
      setState((previous) => ({
        key: resetKey,
        viewport: next(previous.key === resetKey ? previous.viewport : IDENTITY_VIEWPORT),
      }));
    },
    [resetKey],
  );

  const pointers = useRef(new Map<number, Point>());
  const pinchDistance = useRef(0);
  /** ポインタを下ろしてからの移動量の合計。しきい値を超えたらクリックとみなさない。 */
  const movedDistance = useRef(0);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  // ホイールは Ctrl / ⌘ を押している間だけ拡大縮小する。
  // 素のホイールを奪うと、縦に長いこの画面をスクロールできなくなるため。
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const point = toUserPoint(svg, event.clientX, event.clientY);
      if (!point) return;
      update((current) => zoomAt(current, Math.exp(-event.deltaY * 0.002), point.x, point.y));
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef, update]);

  const onPointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const start = toUserPoint(svg, event.clientX, event.clientY);
      if (!start) return;

      pointers.current.set(event.pointerId, start);
      movedDistance.current = 0;
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinchDistance.current = distance(a, b);
      }
      if (cleanup.current) return;
      setPanning(true);

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        if (!pointers.current.has(moveEvent.pointerId)) return;
        const point = toUserPoint(svg, moveEvent.clientX, moveEvent.clientY);
        if (!point) return;
        const previous = pointers.current.get(moveEvent.pointerId);
        pointers.current.set(moveEvent.pointerId, point);
        if (!previous) return;

        if (pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          const spread = distance(a, b);
          if (pinchDistance.current > 0 && spread > 0) {
            const center = midpoint(a, b);
            const factor = spread / pinchDistance.current;
            update((current) => zoomAt(current, factor, center.x, center.y));
          }
          pinchDistance.current = spread;
          movedDistance.current += DRAG_THRESHOLD + 1;
          return;
        }

        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        movedDistance.current += Math.hypot(dx, dy);
        update((current) => panBy(current, dx, dy));
      };

      const onUp = (upEvent: globalThis.PointerEvent) => {
        pointers.current.delete(upEvent.pointerId);
        if (pointers.current.size < 2) pinchDistance.current = 0;
        if (pointers.current.size > 0) return;
        cleanup.current?.();
      };

      const detach = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        cleanup.current = null;
        setPanning(false);
      };

      cleanup.current = detach;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [svgRef, update],
  );

  const onDoubleClick = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const point = toUserPoint(svg, event.clientX, event.clientY);
      if (!point) return;
      update((current) => zoomAt(current, STEP_FACTOR, point.x, point.y));
    },
    [svgRef, update],
  );

  // ボタンは図の中心を固定して拡大縮小する。
  const zoomFromCenter = useCallback(
    (factor: number) => update((current) => zoomAt(current, factor, 0, 0)),
    [update],
  );

  return {
    viewport,
    transform: toTransform(viewport),
    canReset: !isIdentity(viewport),
    panning,
    zoomIn: () => zoomFromCenter(STEP_FACTOR),
    zoomOut: () => zoomFromCenter(1 / STEP_FACTOR),
    reset: () => update(() => IDENTITY_VIEWPORT),
    didPan: () => movedDistance.current > DRAG_THRESHOLD,
    onPointerDown,
    onDoubleClick,
  };
}
