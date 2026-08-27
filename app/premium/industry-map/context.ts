import { buildForest, type TreeNode } from "./graph-layout";
import {
  CROSS_RELATIONS,
  type IndustryDomain,
  type IndustryEdge,
  type IndustryNode,
  type IndustryStock,
  type IndustryStockLink,
  type IndustryTheme,
  type IndustryThemeLink,
  type RelationType,
  type TaxonomyKind,
} from "./types";

/** 各ビューが共通で使う索引。domain を切り替えたときだけ作り直す。 */
export type MapContext = {
  domain: IndustryDomain;
  roots: TreeNode[];
  nodeById: Map<string, IndustryNode>;
  stockById: Map<string, IndustryStock>;
  themeById: Map<string, IndustryTheme>;
  stockLinksByNode: Map<string, IndustryStockLink[]>;
  themeLinksByNode: Map<string, IndustryThemeLink[]>;
  /** 階層をまたぐ関係だけを、両端のノードから引けるようにしたもの。 */
  crossEdgesByNode: Map<string, IndustryEdge[]>;
  /** 階層の親子。`contains` / `part_of` を正規化済み。 */
  parentOf: Map<string, string>;
  childrenOf: Map<string, string[]>;
  kindCounts: Record<TaxonomyKind, number>;
  relationCounts: Record<RelationType, number>;
};

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const current = grouped.get(groupKey);
    if (current) current.push(item);
    else grouped.set(groupKey, [item]);
  }
  return grouped;
}

const CROSS_SET = new Set<RelationType>(CROSS_RELATIONS);

export function buildMapContext(
  domain: IndustryDomain,
  stocks: IndustryStock[],
  themes: IndustryTheme[],
): MapContext {
  const roots = buildForest(domain);

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const walk = (item: TreeNode) => {
    childrenOf.set(
      item.node.id,
      item.children.map((child) => child.node.id),
    );
    for (const child of item.children) {
      parentOf.set(child.node.id, item.node.id);
      walk(child);
    }
  };
  roots.forEach(walk);

  const crossEdgesByNode = new Map<string, IndustryEdge[]>();
  const attach = (nodeId: string, edge: IndustryEdge) => {
    const current = crossEdgesByNode.get(nodeId);
    if (current) current.push(edge);
    else crossEdgesByNode.set(nodeId, [edge]);
  };
  for (const edge of domain.edges) {
    if (!CROSS_SET.has(edge.relationType)) continue;
    attach(edge.sourceId, edge);
    attach(edge.targetId, edge);
  }

  const kindCounts: Record<TaxonomyKind, number> = {
    classification: 0,
    product_segment: 0,
    technology: 0,
  };
  for (const node of domain.nodes) kindCounts[node.kind] += 1;

  const relationCounts: Record<RelationType, number> = {
    contains: 0,
    part_of: 0,
    depends_on: 0,
    enables: 0,
    used_for: 0,
    related_to: 0,
  };
  for (const edge of domain.edges) relationCounts[edge.relationType] += 1;

  return {
    domain,
    roots,
    nodeById: new Map(domain.nodes.map((node) => [node.id, node])),
    stockById: new Map(stocks.map((stock) => [stock.id, stock])),
    themeById: new Map(themes.map((theme) => [theme.id, theme])),
    stockLinksByNode: groupBy(domain.stockLinks, (link) => link.nodeId),
    themeLinksByNode: groupBy(domain.themeLinks, (link) => link.nodeId),
    crossEdgesByNode,
    parentOf,
    childrenOf,
    kindCounts,
    relationCounts,
  };
}

/** 種別フィルタと検索語を通過したノード。ビューはこれを使って強調と絞り込みを行う。 */
export function selectActiveIds(
  context: MapContext,
  kinds: Set<TaxonomyKind>,
  query: string,
): Set<string> {
  const needle = query.trim().toLocaleLowerCase("ja");
  const active = new Set<string>();

  for (const node of context.domain.nodes) {
    if (!kinds.has(node.kind)) continue;
    if (needle.length > 0) {
      const haystack =
        `${node.displayName} ${node.slug} ${node.description}`.toLocaleLowerCase("ja");
      if (!haystack.includes(needle)) continue;
    }
    active.add(node.id);
  }
  return active;
}

/** 検索でヒットしたノードの祖先。ツリーで自動展開するために使う。 */
export function ancestorsOf(context: MapContext, nodeIds: Iterable<string>): Set<string> {
  const ancestors = new Set<string>();
  for (const nodeId of nodeIds) {
    let current = context.parentOf.get(nodeId);
    while (current && !ancestors.has(current)) {
      ancestors.add(current);
      current = context.parentOf.get(current);
    }
  }
  return ancestors;
}

/** 相手側のノードID。横断エッジの詳細表示に使う。 */
export function otherEndOf(edge: IndustryEdge, nodeId: string): string {
  return edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
}
