import {
  CROSS_RELATIONS,
  type IndustryDomain,
  type IndustryEdge,
  type IndustryNode,
  type RelationType,
} from "./types";

/**
 * 業界マップのレイアウト計算。すべて副作用のない純関数にして vitest で検証する。
 * 描画ライブラリを足さない判断は
 * docs/decision-log/2026-08-28-industry-map-view-selection.md を参照。
 */

export type TreeNode = {
  node: IndustryNode;
  depth: number;
  children: TreeNode[];
  /** 2つ目以降の親。木では1つ目の親の下にだけ置き、残りはここへ退避する。 */
  extraParentIds: string[];
  /** このノードに接続する横断エッジ。木では線を引かずバッジで示す。 */
  crossEdges: IndustryEdge[];
};

const CROSS_SET = new Set<RelationType>(CROSS_RELATIONS);

/** `contains` は 親→子、`part_of` は 子→親。どちらも「子 → 親候補」に正規化する。 */
function collectParents(edges: IndustryEdge[]): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  const push = (childId: string, parentId: string) => {
    const current = parents.get(childId);
    if (current) {
      if (!current.includes(parentId)) current.push(parentId);
    } else {
      parents.set(childId, [parentId]);
    }
  };

  for (const edge of edges) {
    if (edge.relationType === "contains") push(edge.targetId, edge.sourceId);
    if (edge.relationType === "part_of") push(edge.sourceId, edge.targetId);
  }
  return parents;
}

function collectCrossEdges(edges: IndustryEdge[]): Map<string, IndustryEdge[]> {
  const byNode = new Map<string, IndustryEdge[]>();
  const push = (nodeId: string, edge: IndustryEdge) => {
    const current = byNode.get(nodeId);
    if (current) current.push(edge);
    else byNode.set(nodeId, [edge]);
  };

  for (const edge of edges) {
    if (!CROSS_SET.has(edge.relationType)) continue;
    push(edge.sourceId, edge);
    push(edge.targetId, edge);
  }
  return byNode;
}

/**
 * domain を木の集合に組み立てる。
 * 親が複数あるノードは最初の親の下にだけ置き、残りを extraParentIds に記録する。
 * 循環があっても訪問済みノードを再訪しないので停止する。
 */
export function buildForest(domain: IndustryDomain): TreeNode[] {
  const nodeById = new Map(domain.nodes.map((node) => [node.id, node]));
  const parents = collectParents(domain.edges);
  const crossEdges = collectCrossEdges(domain.edges);

  const childrenOf = new Map<string, string[]>();
  for (const node of domain.nodes) {
    const parentIds = parents.get(node.id) ?? [];
    const primary = parentIds.find((id) => nodeById.has(id));
    if (!primary) continue;
    const list = childrenOf.get(primary);
    if (list) list.push(node.id);
    else childrenOf.set(primary, [node.id]);
  }

  const visited = new Set<string>();

  const build = (nodeId: string, depth: number): TreeNode | null => {
    const node = nodeById.get(nodeId);
    if (!node || visited.has(nodeId)) return null;
    visited.add(nodeId);

    const parentIds = (parents.get(nodeId) ?? []).filter((id) => nodeById.has(id));
    return {
      node,
      depth,
      children: (childrenOf.get(nodeId) ?? [])
        .map((childId) => build(childId, depth + 1))
        .filter((child): child is TreeNode => child !== null),
      extraParentIds: parentIds.slice(1),
      crossEdges: crossEdges.get(nodeId) ?? [],
    };
  };

  const roots = domain.rootIds
    .map((rootId) => build(rootId, 0))
    .filter((root): root is TreeNode => root !== null);

  // 循環などで木から漏れたノードも落とさず、独立した根として並べる。
  for (const node of domain.nodes) {
    if (visited.has(node.id)) continue;
    const built = build(node.id, 0);
    if (built) roots.push(built);
  }

  return roots;
}

export function flattenTree(roots: TreeNode[]): TreeNode[] {
  const flat: TreeNode[] = [];
  const walk = (item: TreeNode) => {
    flat.push(item);
    item.children.forEach(walk);
  };
  roots.forEach(walk);
  return flat;
}

export function countLeaves(item: TreeNode): number {
  if (item.children.length === 0) return 1;
  return item.children.reduce((total, child) => total + countLeaves(child), 0);
}

export function maxDepth(roots: TreeNode[]): number {
  return flattenTree(roots).reduce((deepest, item) => Math.max(deepest, item.depth), 0);
}

export type RadialPoint = {
  id: string;
  node: IndustryNode;
  depth: number;
  /** ラジアン。-π/2 を真上とする。 */
  angle: number;
  radius: number;
  x: number;
  y: number;
  /** 直接の下位領域の数。点の大きさに使う。 */
  childCount: number;
  hasCrossEdges: boolean;
};

export type RadialLink = {
  id: string;
  from: RadialPoint;
  to: RadialPoint;
};

export type RadialLayout = {
  points: RadialPoint[];
  links: RadialLink[];
  /** 中心からの最大距離。SVG の viewBox を決めるのに使う。 */
  extent: number;
};

/**
 * 放射ツリー（マインドマップ）配置。
 *
 * - 葉の数で角度を等分し、親は子の角度の中央に置く
 * - 最も葉の多い木を中心に据える
 * - 葉はすべて最も外側の環へ揃える。深さで置くと、内側の狭い円周に
 *   浅い葉が詰まってラベルが読めなくなるため
 * - 中心の木に属さない根（階層に接続していない領域を含む）は、その外側の環へ回す
 */
export function layoutRadial(roots: TreeNode[], radiusStep: number): RadialLayout {
  const points: RadialPoint[] = [];
  const links: RadialLink[] = [];

  const totalLeaves = roots.reduce((total, root) => total + countLeaves(root), 0);
  if (totalLeaves === 0) return { points, links, extent: radiusStep };

  const anyHierarchy = roots.some((root) => root.children.length > 0);
  const mainRoot = anyHierarchy
    ? roots.reduce((widest, root) => (countLeaves(root) > countLeaves(widest) ? root : widest))
    : null;
  const outerRing = mainRoot ? maxDepth([mainRoot]) + 1 : 1;

  const place = (
    item: TreeNode,
    startAngle: number,
    endAngle: number,
    depthOffset: number,
    leafRing: number,
  ): RadialPoint => {
    const angle = (startAngle + endAngle) / 2;
    const ring = item.children.length === 0 ? leafRing : item.depth + depthOffset;
    const radius = ring * radiusStep;
    const point: RadialPoint = {
      id: item.node.id,
      node: item.node,
      depth: item.depth,
      angle,
      radius,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      childCount: item.children.length,
      hasCrossEdges: item.crossEdges.length > 0,
    };
    points.push(point);

    const leaves = countLeaves(item);
    let cursor = startAngle;
    for (const child of item.children) {
      const span = ((endAngle - startAngle) * countLeaves(child)) / leaves;
      const childPoint = place(child, cursor, cursor + span, depthOffset, leafRing);
      links.push({ id: `${point.id}->${childPoint.id}`, from: point, to: childPoint });
      cursor += span;
    }
    return point;
  };

  const fullTurn = Math.PI * 2;
  let cursor = -Math.PI / 2;
  for (const root of roots) {
    const span = (fullTurn * countLeaves(root)) / totalLeaves;
    const depthOffset = !anyHierarchy ? 1 : root === mainRoot ? 0 : outerRing;
    place(root, cursor, cursor + span, depthOffset, maxDepth([root]) + depthOffset);
    cursor += span;
  }

  const extent = points.reduce((widest, point) => Math.max(widest, point.radius), radiusStep);
  return { points, links, extent };
}

export type SimNode = {
  id: string;
  node: IndustryNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type SimLink = {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
};

export type ForceOptions = {
  /** ノード同士が離れようとする強さ。 */
  repulsion: number;
  /** 辺が縮もうとする強さ。 */
  springStrength: number;
  /** 辺の自然長。 */
  springLength: number;
  /** 中心へ引き戻す強さ。ノードの飛散を防ぐ。 */
  centering: number;
  /** 速度の減衰率。 */
  damping: number;
};

export const DEFAULT_FORCE_OPTIONS: ForceOptions = {
  repulsion: 9000,
  springStrength: 0.035,
  springLength: 96,
  centering: 0.012,
  damping: 0.86,
};

/**
 * 初期配置。乱数を使わず、ノード順に基づく黄金角の螺旋に置く。
 * 同じ入力から必ず同じ図になるので、スクリーンショット比較とテストが安定する。
 */
export function seedSimNodes(nodes: IndustryNode[], spread: number): SimNode[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return nodes.map((node, index) => {
    const angle = index * goldenAngle;
    const radius = spread * Math.sqrt((index + 1) / Math.max(nodes.length, 1));
    return {
      id: node.id,
      node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    };
  });
}

/**
 * force レイアウトを1ステップ進める。渡された配列を書き換える。
 * 115ノード規模なので総当たりの反発計算で足りる。
 */
export function stepForce(
  simNodes: SimNode[],
  links: SimLink[],
  options: ForceOptions = DEFAULT_FORCE_OPTIONS,
): void {
  const byId = new Map(simNodes.map((simNode) => [simNode.id, simNode]));

  for (let i = 0; i < simNodes.length; i += 1) {
    for (let j = i + 1; j < simNodes.length; j += 1) {
      const a = simNodes[i];
      const b = simNodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distanceSq = dx * dx + dy * dy;
      if (distanceSq < 1) {
        // 完全に重なると力が発散するので、決定的な向きへずらす。
        dx = (i % 2 === 0 ? 1 : -1) * 0.5;
        dy = (j % 2 === 0 ? 1 : -1) * 0.5;
        distanceSq = dx * dx + dy * dy;
      }
      const distance = Math.sqrt(distanceSq);
      const force = options.repulsion / distanceSq;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  for (const link of links) {
    const source = byId.get(link.sourceId);
    const target = byId.get(link.targetId);
    if (!source || !target) continue;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (distance - options.springLength) * options.springStrength;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }

  for (const simNode of simNodes) {
    simNode.vx -= simNode.x * options.centering;
    simNode.vy -= simNode.y * options.centering;
    simNode.vx *= options.damping;
    simNode.vy *= options.damping;
    simNode.x += simNode.vx;
    simNode.y += simNode.vy;
  }
}

/** 現在の配置を囲む正方形の半辺。SVG の viewBox 計算に使う。 */
export function simExtent(simNodes: SimNode[], minimum: number): number {
  return simNodes.reduce(
    (widest, simNode) => Math.max(widest, Math.abs(simNode.x), Math.abs(simNode.y)),
    minimum,
  );
}
