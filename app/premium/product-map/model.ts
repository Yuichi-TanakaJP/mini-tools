import type {
  WorkspaceCoreProductRelation,
  WorkspaceCoreProviderLink,
} from "@/lib/workspace-core/types";

export function isMonitoringRelation(relationType: string): boolean {
  return relationType === "monitors_service";
}

export function splitProviderLinks(links: WorkspaceCoreProviderLink[]) {
  return {
    runtime: links.filter((link) => !isMonitoringRelation(link.relationType)),
    monitoring: links.filter((link) => isMonitoringRelation(link.relationType)),
  };
}

export function splitProductRelations(slug: string, relations: WorkspaceCoreProductRelation[]) {
  return {
    outgoing: relations.filter((relation) => relation.sourceProductSlug === slug),
    incoming: relations.filter((relation) => relation.targetProductSlug === slug),
  };
}

export function providerImpactProducts(providerSlug: string, links: WorkspaceCoreProviderLink[]) {
  const matching = links.filter((link) => link.providerSlug === providerSlug);
  return {
    runtimeProducts: [...new Set(matching.filter((link) => !isMonitoringRelation(link.relationType)).map((link) => link.productSlug))],
    monitoringProducts: [...new Set(matching.filter((link) => isMonitoringRelation(link.relationType)).map((link) => link.productSlug))],
  };
}

export function confidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
