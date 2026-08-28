import type { CompanyRelationship, RelationCategory } from "./types";

export type ReachableNetwork = {
  relationships: CompanyRelationship[];
  depthByCompany: Map<string, number>;
};

export function buildReachableNetwork({
  selectedCompanyId,
  relationships,
  hops,
  categories,
  verifiedOnly,
}: {
  selectedCompanyId: string;
  relationships: CompanyRelationship[];
  hops: 1 | 2;
  categories: readonly RelationCategory[];
  verifiedOnly: boolean;
}): ReachableNetwork {
  const allowedCategories = new Set(categories);
  const eligible = relationships.filter(
    (relationship) =>
      allowedCategories.has(relationship.relationCategory) &&
      (!verifiedOnly || relationship.verificationStatus === "verified"),
  );

  const depthByCompany = new Map<string, number>([[selectedCompanyId, 0]]);
  let frontier = new Set<string>([selectedCompanyId]);

  for (let depth = 1; depth <= hops && frontier.size > 0; depth += 1) {
    const nextFrontier = new Set<string>();
    for (const relationship of eligible) {
      const sourceInFrontier = frontier.has(relationship.sourceCompanyId);
      const targetInFrontier = frontier.has(relationship.targetCompanyId);
      if (!sourceInFrontier && !targetInFrontier) continue;

      const neighborId = sourceInFrontier
        ? relationship.targetCompanyId
        : relationship.sourceCompanyId;
      if (depthByCompany.has(neighborId)) continue;
      depthByCompany.set(neighborId, depth);
      nextFrontier.add(neighborId);
    }
    frontier = nextFrontier;
  }

  const visibleRelationships = eligible.filter(
    (relationship) =>
      depthByCompany.has(relationship.sourceCompanyId) &&
      depthByCompany.has(relationship.targetCompanyId),
  );

  return { relationships: visibleRelationships, depthByCompany };
}
