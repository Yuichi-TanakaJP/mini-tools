export type RadialHierarchyNode = {
  id: string;
  label: string;
  children: RadialHierarchyNode[];
  title?: string;
  tone: string;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  radius: number;
  labelSize?: number;
  labelWeight?: number;
  labelColor?: string;
  linkColor?: string;
  linkWidth?: number;
  markerColor?: string | null;
};

export type RadialHierarchyPoint = {
  id: string;
  node: RadialHierarchyNode;
  depth: number;
  angle: number;
  radius: number;
  x: number;
  y: number;
};

export type RadialHierarchyLink = {
  id: string;
  from: RadialHierarchyPoint;
  to: RadialHierarchyPoint;
  color: string;
  width: number;
};

export type RadialHierarchyLayout = {
  points: RadialHierarchyPoint[];
  links: RadialHierarchyLink[];
  extent: number;
  parentOf: Map<string, string>;
};

function countLeaves(node: RadialHierarchyNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((total, child) => total + countLeaves(child), 0);
}

function maxDepth(node: RadialHierarchyNode, depth = 0): number {
  if (node.children.length === 0) return depth;
  return node.children.reduce((deepest, child) => Math.max(deepest, maxDepth(child, depth + 1)), depth);
}

export type RadialLayoutOptions = {
  radiusStep?: number;
  /** Claude Code版は0。企業グループの少数クラスターでは-1で衛星rootを少し内側へ寄せる。 */
  satelliteOffsetDelta?: number;
  /** 1.0で従来どおり。1未満では各親配下のfanを中心へ寄せる。 */
  childFanRatio?: number;
  /** fan圧縮時に各leafへ最低限確保する円周上の距離。layout座標px相当。 */
  minLeafArc?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Claude Code版の radial tree と同じ思想の汎用レイアウト。
 * 葉数で角度を配分し、最大の木を中心、残りのrootを衛星クラスターとして外側へ配置する。
 * childFanRatioを指定した利用側だけ、子fanを中心寄せできる。既定値1.0は従来表示と同一。
 */
export function layoutRadialHierarchy(
  roots: RadialHierarchyNode[],
  options: RadialLayoutOptions = {},
): RadialHierarchyLayout {
  const radiusStep = options.radiusStep ?? 100;
  const satelliteOffsetDelta = options.satelliteOffsetDelta ?? 0;
  const childFanRatio = clamp(options.childFanRatio ?? 1, 0.5, 1);
  const minLeafArc = Math.max(0, options.minLeafArc ?? 0);
  const points: RadialHierarchyPoint[] = [];
  const links: RadialHierarchyLink[] = [];
  const parentOf = new Map<string, string>();

  const totalLeaves = roots.reduce((total, root) => total + countLeaves(root), 0);
  if (totalLeaves === 0) return { points, links, extent: radiusStep, parentOf };

  const anyHierarchy = roots.some((root) => root.children.length > 0);
  const mainRoot = anyHierarchy
    ? roots.reduce((widest, root) => (countLeaves(root) > countLeaves(widest) ? root : widest))
    : null;
  const mainOuterRing = mainRoot ? maxDepth(mainRoot) + 1 : 1;

  const place = (
    item: RadialHierarchyNode,
    startAngle: number,
    endAngle: number,
    treeDepth: number,
    depthOffset: number,
    leafRing: number,
  ): RadialHierarchyPoint => {
    const angle = (startAngle + endAngle) / 2;
    const ring = item.children.length === 0 ? leafRing : treeDepth + depthOffset;
    const radius = ring * radiusStep;
    const point: RadialHierarchyPoint = {
      id: item.id,
      node: item,
      depth: treeDepth,
      angle,
      radius,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
    points.push(point);

    const leaves = countLeaves(item);
    const rawSpan = endAngle - startAngle;
    const leafRadius = Math.max(radiusStep, leafRing * radiusStep);
    const requestedSpan = rawSpan * childFanRatio;
    const minimumSpan = Math.min(rawSpan, leaves * (minLeafArc / leafRadius));
    const childSpan = item.children.length <= 1
      ? rawSpan
      : Math.min(rawSpan, Math.max(requestedSpan, minimumSpan));
    const childStart = angle - childSpan / 2;
    let cursor = childStart;

    for (const child of item.children) {
      const span = (childSpan * countLeaves(child)) / leaves;
      const childPoint = place(child, cursor, cursor + span, treeDepth + 1, depthOffset, leafRing);
      parentOf.set(child.id, item.id);
      links.push({
        id: `${point.id}->${childPoint.id}`,
        from: point,
        to: childPoint,
        color: child.linkColor ?? item.linkColor ?? item.tone,
        width: child.linkWidth ?? item.linkWidth ?? 1.2,
      });
      cursor += span;
    }
    return point;
  };

  const fullTurn = Math.PI * 2;
  let cursor = -Math.PI / 2;
  for (const root of roots) {
    const span = (fullTurn * countLeaves(root)) / totalLeaves;
    const rootDepth = maxDepth(root);
    const depthOffset = !anyHierarchy
      ? 1
      : root === mainRoot
        ? 0
        : Math.max(1, mainOuterRing + satelliteOffsetDelta);
    place(root, cursor, cursor + span, 0, depthOffset, rootDepth + depthOffset);
    cursor += span;
  }

  const extent = points.reduce((widest, point) => Math.max(widest, point.radius), radiusStep);
  return { points, links, extent, parentOf };
}
