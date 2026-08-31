import type { CompanyFunctionLink, Confidence } from "./types";

const CONFIDENCE_RANK: Record<Confidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const ROLE_RANK: Record<string, number> = {
  core: 5,
  growth: 4,
  supporting: 3,
  adjacent: 2,
  experimental: 1,
};

function keyOf(link: CompanyFunctionLink): string {
  return `${link.companyId}:${link.nodeId}`;
}

function preferDerived(a: CompanyFunctionLink, b: CompanyFunctionLink): CompanyFunctionLink {
  const confidence = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
  if (confidence !== 0) return confidence > 0 ? a : b;

  const role = (ROLE_RANK[a.role] ?? 0) - (ROLE_RANK[b.role] ?? 0);
  if (role !== 0) return role > 0 ? a : b;

  return a.linkId.localeCompare(b.linkId) <= 0 ? a : b;
}

export function mergeFunctionLinks(
  directLinks: CompanyFunctionLink[],
  derivedLinks: CompanyFunctionLink[],
): CompanyFunctionLink[] {
  const resolved = new Map<string, CompanyFunctionLink>();

  for (const link of derivedLinks) {
    const key = keyOf(link);
    const current = resolved.get(key);
    resolved.set(key, current ? preferDerived(current, link) : link);
  }

  // Explicit direct links are exceptions/overrides and always win over derived links.
  for (const link of directLinks) {
    resolved.set(keyOf(link), link);
  }

  return [...resolved.values()].sort((a, b) => {
    const byClass = (a.classificationName ?? "").localeCompare(b.classificationName ?? "", "ja");
    if (byClass !== 0) return byClass;
    const byFunction = a.functionName.localeCompare(b.functionName, "ja");
    if (byFunction !== 0) return byFunction;
    return a.companyId.localeCompare(b.companyId);
  });
}
