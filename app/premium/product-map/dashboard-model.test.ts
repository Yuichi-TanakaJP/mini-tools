import { describe, expect, it } from "vitest";
import type { WorkspaceCoreOverview } from "@/lib/workspace-core/types";
import {
  buildProductPortfolio,
  buildServicePortfolio,
  filterWorkspaceOverview,
  focusProducts,
  portfolioStatus,
  productTypeBreakdown,
  reviewQueue,
} from "./dashboard-model";

const overview: WorkspaceCoreOverview = {
  products: [
    {
      productId: "p1", slug: "mini-tools", name: "Mini Tools", description: "central application",
      productType: "application", lifecycleStatus: "active", importance: 5, updatedAt: "2026-09-01T00:00:00Z",
      repositoryCount: 1, technologyCount: 1, providerCount: 1, relationCount: 1,
    },
    {
      productId: "p2", slug: "health-monitor", name: "Health Monitor", description: "watch SaaS",
      productType: "application", lifecycleStatus: "experimental", importance: 3, updatedAt: "2026-08-30T00:00:00Z",
      repositoryCount: 1, technologyCount: 1, providerCount: 1, relationCount: 1,
    },
    {
      productId: "p3", slug: "archived-lab", name: "Archived Lab", description: null,
      productType: "experiment", lifecycleStatus: "archived", importance: 0, updatedAt: "2026-01-01T00:00:00Z",
      repositoryCount: 1, technologyCount: 0, providerCount: 0, relationCount: 0,
    },
  ],
  repositories: [
    {
      productSlug: "mini-tools", repositoryId: "r1", fullName: "Yuichi-TanakaJP/mini-tools", visibility: "public",
      defaultBranch: "main", archived: false, htmlUrl: "https://github.com/Yuichi-TanakaJP/mini-tools",
      role: "primary", isPrimary: true, source: "github", confidence: 1, verifiedAt: null, notes: null,
    },
    {
      productSlug: "health-monitor", repositoryId: "r2", fullName: "Yuichi-TanakaJP/pc-saas-health-monitor", visibility: "private",
      defaultBranch: "main", archived: false, htmlUrl: "https://github.com/Yuichi-TanakaJP/pc-saas-health-monitor",
      role: "primary", isPrimary: true, source: "github", confidence: 1, verifiedAt: null, notes: null,
    },
    {
      productSlug: "archived-lab", repositoryId: "r3", fullName: "Yuichi-TanakaJP/archived-lab", visibility: "private",
      defaultBranch: "main", archived: true, htmlUrl: null, role: "primary", isPrimary: true,
      source: "github", confidence: 1, verifiedAt: null, notes: null,
    },
  ],
  technologies: [
    {
      productSlug: "mini-tools", technologyId: "t1", technologySlug: "nextjs", technologyName: "Next.js", category: "framework",
      layer: null, role: null, version: null, source: "github", confidence: 1, evidenceUri: null, lastVerifiedAt: null, notes: null,
    },
    {
      productSlug: "health-monitor", technologyId: "t1", technologySlug: "nextjs", technologyName: "Next.js", category: "framework",
      layer: null, role: null, version: null, source: "github", confidence: 1, evidenceUri: null, lastVerifiedAt: null, notes: null,
    },
  ],
  providerLinks: [
    {
      productSlug: "mini-tools", providerId: "s1", providerSlug: "vercel", providerName: "Vercel", providerCategory: "hosting",
      relationType: "deployment_target", source: "github", confidence: 1, evidenceUri: null, lastVerifiedAt: null, notes: null,
    },
    {
      productSlug: "health-monitor", providerId: "s2", providerSlug: "supabase", providerName: "Supabase", providerCategory: "database-platform",
      relationType: "monitors_service", source: "github", confidence: 1, evidenceUri: null, lastVerifiedAt: null, notes: null,
    },
  ],
  serviceInstances: [],
  relations: [
    {
      sourceProductSlug: "mini-tools", sourceProductName: "Mini Tools", targetProductSlug: "health-monitor", targetProductName: "Health Monitor",
      relationType: "consumes_api", source: "manual", confidence: 1, verifiedAt: null, notes: null,
    },
  ],
  services: [
    {
      serviceId: "svc1", slug: "investment", name: "Investment Service", summary: "investment value",
      targetUser: "investor", userJob: "collect less", valueProposition: "decide faster", expectedOutcome: "reusable decisions",
      stage: "internal", importance: 5, modelStatus: "provisional", updatedAt: null, productCount: 2, deliveryModeCount: 1,
    },
    {
      serviceId: "svc2", slug: "developer-ops", name: "Developer Ops", summary: "ops value",
      targetUser: "developer", userJob: "manage tools", valueProposition: "see the system", expectedOutcome: "less maintenance",
      stage: "prototype", importance: 3, modelStatus: "provisional", updatedAt: null, productCount: 2, deliveryModeCount: 1,
    },
  ],
  serviceProducts: [
    {
      serviceSlug: "investment", serviceName: "Investment Service", productSlug: "mini-tools", productName: "Mini Tools",
      role: "user_interface", contribution: "main UI", isPrimary: true, source: "manual", confidence: 0.9,
      evidenceUri: null, verifiedAt: null, notes: null,
    },
    {
      serviceSlug: "investment", serviceName: "Investment Service", productSlug: "health-monitor", productName: "Health Monitor",
      role: "support", contribution: "support", isPrimary: false, source: "manual", confidence: 0.8,
      evidenceUri: null, verifiedAt: null, notes: null,
    },
    {
      serviceSlug: "developer-ops", serviceName: "Developer Ops", productSlug: "mini-tools", productName: "Mini Tools",
      role: "portal", contribution: "shared portal", isPrimary: false, source: "manual", confidence: 0.8,
      evidenceUri: null, verifiedAt: null, notes: null,
    },
    {
      serviceSlug: "developer-ops", serviceName: "Developer Ops", productSlug: "health-monitor", productName: "Health Monitor",
      role: "operations_interface", contribution: "main ops UI", isPrimary: true, source: "manual", confidence: 0.9,
      evidenceUri: null, verifiedAt: null, notes: null,
    },
  ],
  serviceDeliveryModes: [
    {
      serviceSlug: "investment", serviceName: "Investment Service", productSlug: "mini-tools", productName: "Mini Tools",
      mode: "web_dashboard", label: "Web / Dashboard", description: "show decisions", touchpoint: "Premium", isUserFacing: true,
      source: "manual", confidence: 0.9, evidenceUri: null, verifiedAt: null, notes: null,
    },
    {
      serviceSlug: "developer-ops", serviceName: "Developer Ops", productSlug: "health-monitor", productName: "Health Monitor",
      mode: "health_check", label: "Health Check", description: "check services", touchpoint: "Health Monitor", isUserFacing: true,
      source: "manual", confidence: 0.9, evidenceUri: null, verifiedAt: null, notes: null,
    },
  ],
};

describe("Workspace Dashboard product/service portfolio model", () => {
  it("Serviceは価値単位でProduct構成とdeliveryを集約する", () => {
    const services = buildServicePortfolio(overview);
    expect(services.map((service) => service.slug)).toEqual(["investment", "developer-ops"]);
    expect(services[0].products.map((link) => link.productSlug)).toEqual(["mini-tools", "health-monitor"]);
    expect(services[0].deliveryModes[0]).toMatchObject({ mode: "web_dashboard", productSlug: "mini-tools" });
  });

  it("同じProductが複数Serviceへ貢献できる", () => {
    const services = buildServicePortfolio(overview);
    expect(services.filter((service) => service.products.some((link) => link.productSlug === "mini-tools"))).toHaveLength(2);
  });

  it("search/filterはProductを軸にしつつ関連Repoも検索できる", () => {
    const result = filterWorkspaceOverview(overview, { query: "pc-saas-health-monitor", productType: "all", lifecycle: "all", providerSlug: "all" });
    expect(result.products.map((product) => product.slug)).toEqual(["health-monitor"]);
    expect(result.services).toHaveLength(2);
  });

  it("portfolio rowへprimary repo / runtime / monitoring / relationを集約する", () => {
    const rows = buildProductPortfolio(overview);
    const miniTools = rows.find((product) => product.slug === "mini-tools");
    const health = rows.find((product) => product.slug === "health-monitor");
    expect(miniTools).toMatchObject({ primaryRepository: { fullName: "Yuichi-TanakaJP/mini-tools" }, relatedProductSlugs: ["health-monitor"] });
    expect(miniTools?.runtimeProviders.map((provider) => provider.providerSlug)).toEqual(["vercel"]);
    expect(health?.runtimeProviders).toEqual([]);
    expect(health?.monitoringProviders.map((provider) => provider.providerSlug)).toEqual(["supabase"]);
  });

  it("top cockpitはProduct lifecycleとimportanceを表す", () => {
    expect(portfolioStatus(overview)).toEqual({ products: 3, active: 1, experimental: 1, inactive: 1, highImportance: 1 });
    expect(focusProducts(overview).map((product) => product.slug)).toEqual(["mini-tools", "health-monitor"]);
  });

  it("review queueは障害ではなく見直し候補を返す", () => {
    const queue = reviewQueue(overview);
    expect(queue.map((product) => product.slug)).toEqual(["health-monitor", "archived-lab"]);
    expect(queue[0].reviewSignals.map((signal) => signal.label)).toContain("実験中");
    expect(queue[1].reviewSignals.map((signal) => signal.label)).toContain("Archive");
  });

  it("product type breakdownはポートフォリオ構成を返す", () => {
    expect(productTypeBreakdown(overview)).toEqual([
      { slug: "application", name: "application", count: 2, products: ["mini-tools", "health-monitor"] },
      { slug: "experiment", name: "experiment", count: 1, products: ["archived-lab"] },
    ]);
  });
});
