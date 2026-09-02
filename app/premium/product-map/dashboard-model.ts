import type {
  WorkspaceCoreOverview,
  WorkspaceCoreProductRelation,
  WorkspaceCoreProductSummary,
  WorkspaceCoreProviderLink,
  WorkspaceCoreRepositoryLink,
  WorkspaceCoreServiceInstanceLink,
  WorkspaceCoreTechnologyLink,
} from "@/lib/workspace-core/types";
import { isMonitoringRelation } from "./model";

export type WorkspaceDashboardFilters = {
  query: string;
  productType: string;
  lifecycle: string;
  providerSlug: string;
};

export type WorkspaceDashboardScope = {
  products: WorkspaceCoreProductSummary[];
  repositories: WorkspaceCoreRepositoryLink[];
  technologies: WorkspaceCoreTechnologyLink[];
  providerLinks: WorkspaceCoreProviderLink[];
  serviceInstances: WorkspaceCoreServiceInstanceLink[];
  relations: WorkspaceCoreProductRelation[];
};

export type ProductDashboardRow = WorkspaceCoreProductSummary & {
  runtimeProviderCount: number;
  monitoringProviderCount: number;
};

export type UsageBreakdown = {
  slug: string;
  name: string;
  count: number;
  products: string[];
  category?: string;
  monitoringCount?: number;
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function filterWorkspaceOverview(
  overview: WorkspaceCoreOverview,
  filters: WorkspaceDashboardFilters,
): WorkspaceDashboardScope {
  const query = normalized(filters.query);
  const providerProducts = filters.providerSlug === "all"
    ? null
    : new Set(
        overview.providerLinks
          .filter((link) => link.providerSlug === filters.providerSlug)
          .map((link) => link.productSlug),
      );

  const products = overview.products.filter((product) => {
    if (filters.productType !== "all" && product.productType !== filters.productType) return false;
    if (filters.lifecycle !== "all" && product.lifecycleStatus !== filters.lifecycle) return false;
    if (providerProducts && !providerProducts.has(product.slug)) return false;
    if (!query) return true;

    const relatedRepositories = overview.repositories
      .filter((link) => link.productSlug === product.slug)
      .map((link) => link.fullName);
    const relatedTechnologies = overview.technologies
      .filter((link) => link.productSlug === product.slug)
      .map((link) => link.technologyName);
    const relatedProviders = overview.providerLinks
      .filter((link) => link.productSlug === product.slug)
      .map((link) => link.providerName);

    return normalized([
      product.name,
      product.slug,
      product.description ?? "",
      ...relatedRepositories,
      ...relatedTechnologies,
      ...relatedProviders,
    ].join(" ")).includes(query);
  });

  const productSlugs = new Set(products.map((product) => product.slug));

  return {
    products,
    repositories: overview.repositories.filter((link) => productSlugs.has(link.productSlug)),
    technologies: overview.technologies.filter((link) => productSlugs.has(link.productSlug)),
    providerLinks: overview.providerLinks.filter((link) => productSlugs.has(link.productSlug)),
    serviceInstances: overview.serviceInstances.filter((link) => productSlugs.has(link.productSlug)),
    relations: overview.relations.filter(
      (relation) => productSlugs.has(relation.sourceProductSlug) || productSlugs.has(relation.targetProductSlug),
    ),
  };
}

export function buildProductRows(scope: WorkspaceDashboardScope): ProductDashboardRow[] {
  return scope.products.map((product) => {
    const providerLinks = scope.providerLinks.filter((link) => link.productSlug === product.slug);
    return {
      ...product,
      runtimeProviderCount: new Set(
        providerLinks.filter((link) => !isMonitoringRelation(link.relationType)).map((link) => link.providerSlug),
      ).size,
      monitoringProviderCount: new Set(
        providerLinks.filter((link) => isMonitoringRelation(link.relationType)).map((link) => link.providerSlug),
      ).size,
    };
  });
}

export function technologyUsage(scope: WorkspaceDashboardScope): UsageBreakdown[] {
  const usage = new Map<string, UsageBreakdown>();
  for (const link of scope.technologies) {
    const current = usage.get(link.technologySlug) ?? {
      slug: link.technologySlug,
      name: link.technologyName,
      count: 0,
      products: [],
      category: link.category,
    };
    if (!current.products.includes(link.productSlug)) current.products.push(link.productSlug);
    current.count = current.products.length;
    usage.set(link.technologySlug, current);
  }
  return [...usage.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function providerUsage(scope: WorkspaceDashboardScope): UsageBreakdown[] {
  const usage = new Map<string, UsageBreakdown>();
  for (const link of scope.providerLinks) {
    const current = usage.get(link.providerSlug) ?? {
      slug: link.providerSlug,
      name: link.providerName,
      count: 0,
      products: [],
      category: link.providerCategory,
      monitoringCount: 0,
    };
    if (!current.products.includes(link.productSlug)) current.products.push(link.productSlug);
    current.count = current.products.length;
    if (isMonitoringRelation(link.relationType)) current.monitoringCount = (current.monitoringCount ?? 0) + 1;
    usage.set(link.providerSlug, current);
  }
  return [...usage.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function dashboardTotals(scope: WorkspaceDashboardScope) {
  return {
    products: scope.products.length,
    activeProducts: scope.products.filter((product) => product.lifecycleStatus === "active").length,
    repositories: scope.repositories.length,
    technologies: new Set(scope.technologies.map((link) => link.technologySlug)).size,
    providers: new Set(scope.providerLinks.map((link) => link.providerSlug)).size,
    relations: scope.relations.length,
  };
}
