import { describe, expect, it } from "vitest";
import type { WorkspaceCoreOverview } from "@/lib/workspace-core/types";
import {
  buildProductRows,
  dashboardTotals,
  filterWorkspaceOverview,
  providerUsage,
  technologyUsage,
} from "./dashboard-model";

const overview: WorkspaceCoreOverview = {
  products: [
    {
      productId: "p1",
      slug: "mini-tools",
      name: "mini-tools",
      description: "dashboard",
      productType: "application",
      lifecycleStatus: "active",
      importance: 90,
      updatedAt: null,
      repositoryCount: 1,
      technologyCount: 2,
      providerCount: 1,
      relationCount: 1,
    },
    {
      productId: "p2",
      slug: "health-monitor",
      name: "Health Monitor",
      description: "watch SaaS",
      productType: "application",
      lifecycleStatus: "experimental",
      importance: 60,
      updatedAt: null,
      repositoryCount: 1,
      technologyCount: 1,
      providerCount: 1,
      relationCount: 0,
    },
  ],
  repositories: [
    {
      productSlug: "mini-tools",
      repositoryId: "r1",
      fullName: "Yuichi-TanakaJP/mini-tools",
      visibility: "public",
      defaultBranch: "main",
      archived: false,
      htmlUrl: null,
      role: "primary",
      isPrimary: true,
      source: "github",
      confidence: 1,
      verifiedAt: null,
      notes: null,
    },
    {
      productSlug: "health-monitor",
      repositoryId: "r2",
      fullName: "Yuichi-TanakaJP/pc-saas-health-monitor",
      visibility: "private",
      defaultBranch: "main",
      archived: false,
      htmlUrl: null,
      role: "primary",
      isPrimary: true,
      source: "github",
      confidence: 1,
      verifiedAt: null,
      notes: null,
    },
  ],
  technologies: [
    {
      productSlug: "mini-tools",
      technologyId: "t1",
      technologySlug: "nextjs",
      technologyName: "Next.js",
      category: "framework",
      layer: null,
      role: null,
      version: null,
      source: "github",
      confidence: 1,
      evidenceUri: null,
      lastVerifiedAt: null,
      notes: null,
    },
    {
      productSlug: "health-monitor",
      technologyId: "t1",
      technologySlug: "nextjs",
      technologyName: "Next.js",
      category: "framework",
      layer: null,
      role: null,
      version: null,
      source: "github",
      confidence: 1,
      evidenceUri: null,
      lastVerifiedAt: null,
      notes: null,
    },
  ],
  providerLinks: [
    {
      productSlug: "mini-tools",
      providerId: "s1",
      providerSlug: "supabase",
      providerName: "Supabase",
      providerCategory: "database-platform",
      relationType: "uses_database_platform",
      source: "github",
      confidence: 1,
      evidenceUri: null,
      lastVerifiedAt: null,
      notes: null,
    },
    {
      productSlug: "health-monitor",
      providerId: "s1",
      providerSlug: "supabase",
      providerName: "Supabase",
      providerCategory: "database-platform",
      relationType: "monitors_service",
      source: "github",
      confidence: 1,
      evidenceUri: null,
      lastVerifiedAt: null,
      notes: null,
    },
  ],
  serviceInstances: [],
  relations: [
    {
      sourceProductSlug: "mini-tools",
      sourceProductName: "mini-tools",
      targetProductSlug: "health-monitor",
      targetProductName: "Health Monitor",
      relationType: "consumes_api",
      source: "manual",
      confidence: 1,
      verifiedAt: null,
      notes: null,
    },
  ],
};

describe("Workspace Dashboard model", () => {
  it("repository / technology / provider名も横断検索対象にする", () => {
    const result = filterWorkspaceOverview(overview, {
      query: "pc-saas-health-monitor",
      productType: "all",
      lifecycle: "all",
      providerSlug: "all",
    });
    expect(result.products.map((product) => product.slug)).toEqual(["health-monitor"]);
  });

  it("provider filterでruntimeとmonitoringの両方をproduct scopeに含める", () => {
    const result = filterWorkspaceOverview(overview, {
      query: "",
      productType: "all",
      lifecycle: "all",
      providerSlug: "supabase",
    });
    expect(result.products.map((product) => product.slug)).toEqual(["mini-tools", "health-monitor"]);
    expect(buildProductRows(result).map((product) => [product.runtimeProviderCount, product.monitoringProviderCount])).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it("technology/provider usageとKPIを重複Productなしで集計する", () => {
    const scope = filterWorkspaceOverview(overview, {
      query: "",
      productType: "all",
      lifecycle: "all",
      providerSlug: "all",
    });
    expect(technologyUsage(scope)[0]).toMatchObject({ slug: "nextjs", count: 2 });
    expect(providerUsage(scope)[0]).toMatchObject({ slug: "supabase", count: 2, monitoringCount: 1 });
    expect(dashboardTotals(scope)).toEqual({
      products: 2,
      activeProducts: 1,
      repositories: 2,
      technologies: 1,
      providers: 1,
      relations: 1,
    });
  });
});
