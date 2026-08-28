import type { CompanyNetworkCompany, CompanyRelationship } from "./types";

export type VisualNode = {
  id: string;
  label: string;
  kind: "company" | "group";
  company?: CompanyNetworkCompany;
  groupId?: string;
  groupType?: string;
};

export type SimNode = VisualNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type SimLink = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: "relationship" | "membership";
};

export type ForceOptions = {
  repulsion: number;
  springStrength: number;
  springLength: number;
  centering: number;
  damping: number;
};

export const DEFAULT_FORCE_OPTIONS: ForceOptions = {
  repulsion: 9800,
  springStrength: 0.035,
  springLength: 112,
  centering: 0.012,
  damping: 0.86,
};

/** 乱数を使わず、同じ入力から同じ初期配置を作る。 */
export function seedSimNodes(nodes: VisualNode[], spread: number): SimNode[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return nodes.map((node, index) => {
    const angle = index * goldenAngle;
    const radius = spread * Math.sqrt((index + 1) / Math.max(nodes.length, 1));
    return {
      ...node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    };
  });
}

export function stepForce(
  nodes: SimNode[],
  links: SimLink[],
  options: ForceOptions = DEFAULT_FORCE_OPTIONS,
): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distanceSq = dx * dx + dy * dy;
      if (distanceSq < 1) {
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
    const distance = Math.hypot(dx, dy) || 1;
    const length = link.kind === "membership" ? options.springLength * 1.25 : options.springLength;
    const force = (distance - length) * options.springStrength;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }

  for (const node of nodes) {
    node.vx -= node.x * options.centering;
    node.vy -= node.y * options.centering;
    node.vx *= options.damping;
    node.vy *= options.damping;
    node.x += node.vx;
    node.y += node.vy;
  }
}

export function simExtent(nodes: SimNode[], minimum: number): number {
  return nodes.reduce(
    (extent, node) => Math.max(extent, Math.abs(node.x), Math.abs(node.y)),
    minimum,
  );
}

export type SeriesRow = {
  companyId: string;
  companyName: string;
  depth: number;
  direction: "upstream" | "center" | "downstream";
  relationship: CompanyRelationship | null;
  cycle: boolean;
};

const SERIES_TYPES = new Set(["equity_ownership", "parent_of", "controls", "equity_method_investment"]);

/**
 * 選択企業から「上位」と「下位」を別方向へたどる。
 * 企業グループ所属や歴史的関係は系列ツリーへ混ぜない。
 */
export function buildSeriesRows({
  selectedCompanyId,
  selectedCompanyName,
  relationships,
  maxDepth,
}: {
  selectedCompanyId: string;
  selectedCompanyName: string;
  relationships: CompanyRelationship[];
  maxDepth: 1 | 2;
}): { upstream: SeriesRow[]; center: SeriesRow; downstream: SeriesRow[] } {
  const eligible = relationships.filter(
    (relationship) =>
      SERIES_TYPES.has(relationship.relationType) &&
      relationship.relationCategory !== "historical",
  );

  const walk = (direction: "upstream" | "downstream"): SeriesRow[] => {
    const rows: SeriesRow[] = [];
    let frontier = new Set<string>([selectedCompanyId]);
    const visited = new Set<string>([selectedCompanyId]);

    for (let depth = 1; depth <= maxDepth && frontier.size > 0; depth += 1) {
      const next = new Set<string>();
      for (const relationship of eligible) {
        const matches = direction === "upstream"
          ? frontier.has(relationship.targetCompanyId)
          : frontier.has(relationship.sourceCompanyId);
        if (!matches) continue;

        const companyId = direction === "upstream"
          ? relationship.sourceCompanyId
          : relationship.targetCompanyId;
        const companyName = direction === "upstream"
          ? relationship.sourceCompanyName
          : relationship.targetCompanyName;
        const cycle = visited.has(companyId);
        rows.push({ companyId, companyName, depth, direction, relationship, cycle });
        if (!cycle) {
          visited.add(companyId);
          next.add(companyId);
        }
      }
      frontier = next;
    }
    return rows;
  };

  return {
    upstream: walk("upstream"),
    center: {
      companyId: selectedCompanyId,
      companyName: selectedCompanyName,
      depth: 0,
      direction: "center",
      relationship: null,
      cycle: false,
    },
    downstream: walk("downstream"),
  };
}
