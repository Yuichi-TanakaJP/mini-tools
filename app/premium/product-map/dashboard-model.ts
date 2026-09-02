import type {
  WorkspaceCoreOverview,
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

export type WorkspaceDashboardScope = WorkspaceCoreOverview;

export type ReviewSignal = {
  code: "lifecycle" | "missing_repo" | "missing_runtime" | "isolated";
  label: string;
  detail: string;
  tone: "warning" | "muted";
};

export type ProductPortfolioRow = WorkspaceCoreProductSummary & {
  primaryRepository: WorkspaceCoreRepositoryLink | null;
  repositories: WorkspaceCoreRepositoryLink[];
  technologies: WorkspaceCoreTechnologyLink[];
  runtimeProviders: WorkspaceCoreProviderLink[];
  monitoringProviders: WorkspaceCoreProviderLink[];
  serviceInstances: WorkspaceCoreServiceInstanceLink[];
  relatedProductSlugs: string[];
  reviewSignals: ReviewSignal[];
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

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
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

    const repositories = overview.repositories
      .filter((link) => link.productSlug === product.slug)
      .map((link) => link.fullName);
    const providers = overview.providerLinks
      .filter((link) => link.productSlug === product.slug)
      .map((link) => link.providerName);
    const technologies = overview.technologies
      .filter((link) => link.productSlug === product.slug)
      .map((link) => link.technologyName);

    return normalized([
      product.name,
      product.slug,
      product.description ?? "",
      ...repositories,
      ...providers,
      ...technologies,
    ].join(" ")).includes(query);
  });

  const slugs = new Set(products.map((product) => product.slug));
  return {
    products,
    repositories: overview.repositories.filter((link) => slugs.has(link.productSlug)),
    technologies: overview.technologies.filter((link) => slugs.has(link.productSlug)),
    providerLinks: overview.providerLinks.filter((link) => slugs.has(link.productSlug)),
    serviceInstances: overview.serviceInstances.filter((link) => slugs.has(link.productSlug)),
    relations: overview.relations.filter(
      (relation) => slugs.has(relation.sourceProductSlug) || slugs.has(relation.targetProductSlug),
    ),
  };
}

function productReviewSignals(
  product: WorkspaceCoreProductSummary,
  repositories: WorkspaceCoreRepositoryLink[],
  runtimeProviders: WorkspaceCoreProviderLink[],
  relatedProductSlugs: string[],
): ReviewSignal[] {
  const signals: ReviewSignal[] = [];

  if (product.lifecycleStatus === "experimental") {
    signals.push({
      code: "lifecycle",
      label: "実験中",
      detail: "継続・昇格・停止を定期的に見直す対象です。",
      tone: "warning",
    });
  } else if (product.lifecycleStatus === "paused") {
    signals.push({
      code: "lifecycle",
      label: "停止中",
      detail: "再開するか、整理するかを確認する対象です。",
      tone: "warning",
    });
  } else if (product.lifecycleStatus === "archived") {
    signals.push({
      code: "lifecycle",
      label: "Archive",
      detail: "現役ポートフォリオから外れている資産です。",
      tone: "muted",
    });
  }

  if (repositories.length === 0) {
    signals.push({
      code: "missing_repo",
      label: "Repo未登録",
      detail: "Workspace Core上でRepositoryとの接続が確認できません。",
      tone: "warning",
    });
  }

  const shouldHaveRuntime = ["application", "service", "automation"].includes(product.productType);
  if (product.importance >= 4 && product.lifecycleStatus === "active" && shouldHaveRuntime && runtimeProviders.length === 0) {
    signals.push({
      code: "missing_runtime",
      label: "運用先未登録",
      detail: "重要Productですが、Workspace Coreにruntime/deploy Providerが登録されていません。障害判定ではありません。",
      tone: "warning",
    });
  }

  if (product.importance >= 4 && product.lifecycleStatus === "active" && relatedProductSlugs.length === 0) {
    signals.push({
      code: "isolated",
      label: "接続未登録",
      detail: "重要Productですが、他Productとの関係がWorkspace Coreに登録されていません。",
      tone: "muted",
    });
  }

  return signals;
}

export function buildProductPortfolio(scope: WorkspaceDashboardScope): ProductPortfolioRow[] {
  return scope.products
    .map((product) => {
      const repositories = scope.repositories.filter((link) => link.productSlug === product.slug);
      const providerLinks = scope.providerLinks.filter((link) => link.productSlug === product.slug);
      const runtimeProviders = uniqueBy(
        providerLinks.filter((link) => !isMonitoringRelation(link.relationType)),
        (link) => link.providerSlug,
      );
      const monitoringProviders = uniqueBy(
        providerLinks.filter((link) => isMonitoringRelation(link.relationType)),
        (link) => link.providerSlug,
      );
      const relatedProductSlugs = [...new Set(
        scope.relations.flatMap((relation) => {
          if (relation.sourceProductSlug === product.slug) return [relation.targetProductSlug];
          if (relation.targetProductSlug === product.slug) return [relation.sourceProductSlug];
          return [];
        }),
      )];

      return {
        ...product,
        primaryRepository: repositories.find((link) => link.isPrimary) ?? repositories[0] ?? null,
        repositories,
        technologies: scope.technologies.filter((link) => link.productSlug === product.slug),
        runtimeProviders,
        monitoringProviders,
        serviceInstances: scope.serviceInstances.filter((link) => link.productSlug === product.slug),
        relatedProductSlugs,
        reviewSignals: productReviewSignals(product, repositories, runtimeProviders, relatedProductSlugs),
      };
    })
    .sort((a, b) => b.importance - a.importance || a.name.localeCompare(b.name));
}

export function portfolioStatus(scope: WorkspaceDashboardScope) {
  return {
    products: scope.products.length,
    active: scope.products.filter((product) => product.lifecycleStatus === "active").length,
    experimental: scope.products.filter((product) => product.lifecycleStatus === "experimental").length,
    inactive: scope.products.filter((product) => ["paused", "archived"].includes(product.lifecycleStatus)).length,
    highImportance: scope.products.filter(
      (product) => product.importance >= 4 && ["active", "experimental"].includes(product.lifecycleStatus),
    ).length,
  };
}

export function focusProducts(scope: WorkspaceDashboardScope, limit = 4): ProductPortfolioRow[] {
  return buildProductPortfolio(scope)
    .filter((product) => ["active", "experimental"].includes(product.lifecycleStatus))
    .slice(0, limit);
}

export function reviewQueue(scope: WorkspaceDashboardScope): ProductPortfolioRow[] {
  return buildProductPortfolio(scope)
    .filter((product) => product.reviewSignals.length > 0)
    .sort((a, b) => {
      const warningA = a.reviewSignals.filter((signal) => signal.tone === "warning").length;
      const warningB = b.reviewSignals.filter((signal) => signal.tone === "warning").length;
      return warningB - warningA || b.importance - a.importance || a.name.localeCompare(b.name);
    });
}

export function productTypeBreakdown(scope: WorkspaceDashboardScope): UsageBreakdown[] {
  const map = new Map<string, UsageBreakdown>();
  for (const product of scope.products) {
    const current = map.get(product.productType) ?? {
      slug: product.productType,
      name: product.productType,
      count: 0,
      products: [],
    };
    current.products.push(product.slug);
    current.count += 1;
    map.set(product.productType, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function technologyUsage(scope: WorkspaceDashboardScope): UsageBreakdown[] {
  const map = new Map<string, UsageBreakdown>();
  for (const link of scope.technologies) {
    const current = map.get(link.technologySlug) ?? {
      slug: link.technologySlug,
      name: link.technologyName,
      count: 0,
      products: [],
      category: link.category,
    };
    if (!current.products.includes(link.productSlug)) current.products.push(link.productSlug);
    current.count = current.products.length;
    map.set(link.technologySlug, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function providerUsage(scope: WorkspaceDashboardScope): UsageBreakdown[] {
  const map = new Map<string, UsageBreakdown>();
  for (const link of scope.providerLinks) {
    const current = map.get(link.providerSlug) ?? {
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
    map.set(link.providerSlug, current);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
