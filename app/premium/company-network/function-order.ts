export const FUNCTION_CLASS_ORDER = [
  "mobility-manufacturing",
  "technology-rd",
  "materials-industrial",
  "infrastructure-logistics",
  "commerce-services",
  "property-living",
] as const;

export const FUNCTION_ORDER = [
  "finished-vehicles",
  "vehicle-body-production",
  "automotive-components",
  "electrification-powertrain",
  "software",
  "advanced-mobility",
  "research-development",
  "materials",
  "chemicals",
  "fibers-composites",
  "paper-packaging",
  "industrial-machinery",
  "building-systems",
  "plant-engineering",
  "logistics",
  "marine-transport",
  "trading",
  "banking",
  "insurance",
  "leasing-finance",
  "finance",
  "retail",
  "food-services",
  "beverages",
  "real-estate",
  "housing",
] as const;

function rank(value: string | null, order: readonly string[]): number {
  if (!value) return order.length + 1;
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

export function compareFunctionClass(
  a: { classificationSlug: string | null; classificationName: string | null },
  b: { classificationSlug: string | null; classificationName: string | null },
): number {
  const byRank = rank(a.classificationSlug, FUNCTION_CLASS_ORDER) - rank(b.classificationSlug, FUNCTION_CLASS_ORDER);
  if (byRank !== 0) return byRank;
  return (a.classificationName ?? "").localeCompare(b.classificationName ?? "", "ja");
}

export function compareFunction(
  a: { functionSlug: string; functionName: string },
  b: { functionSlug: string; functionName: string },
): number {
  const byRank = rank(a.functionSlug, FUNCTION_ORDER) - rank(b.functionSlug, FUNCTION_ORDER);
  if (byRank !== 0) return byRank;
  return a.functionName.localeCompare(b.functionName, "ja");
}
