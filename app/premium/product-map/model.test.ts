import { describe, expect, it } from "vitest";
import type { WorkspaceCoreProductRelation, WorkspaceCoreProviderLink } from "@/lib/workspace-core/types";
import { providerImpactProducts, splitProductRelations, splitProviderLinks } from "./model";

const providerLinks: WorkspaceCoreProviderLink[] = [
  {
    productSlug: "mini-tools",
    providerId: "p1",
    providerSlug: "supabase",
    providerName: "Supabase",
    providerCategory: "database-platform",
    relationType: "uses_database_platform",
    source: "github-discovery",
    confidence: 1,
    evidenceUri: "https://example.com/mini-tools",
    lastVerifiedAt: null,
    notes: null,
  },
  {
    productSlug: "pc-saas-health-monitor",
    providerId: "p1",
    providerSlug: "supabase",
    providerName: "Supabase",
    providerCategory: "database-platform",
    relationType: "monitors_service",
    source: "github-discovery",
    confidence: 0.85,
    evidenceUri: "https://example.com/health",
    lastVerifiedAt: null,
    notes: null,
  },
];

const relations: WorkspaceCoreProductRelation[] = [
  {
    sourceProductSlug: "mini-tools",
    sourceProductName: "mini-tools",
    targetProductSlug: "market-info",
    targetProductName: "Market Info",
    relationType: "consumes_api",
    source: "github-discovery",
    confidence: 1,
    verifiedAt: null,
    notes: null,
  },
  {
    sourceProductSlug: "portfolio-x-post",
    sourceProductName: "Portfolio X Post",
    targetProductSlug: "mini-tools",
    targetProductName: "mini-tools",
    relationType: "uses_workflow_asset",
    source: "manual",
    confidence: 0.9,
    verifiedAt: null,
    notes: null,
  },
];

describe("Product Map model", () => {
  it("monitoring targetをruntime dependencyと分離する", () => {
    const split = splitProviderLinks(providerLinks);
    expect(split.runtime.map((link) => link.productSlug)).toEqual(["mini-tools"]);
    expect(split.monitoring.map((link) => link.productSlug)).toEqual(["pc-saas-health-monitor"]);
  });

  it("provider impactで監視対象を依存先に混ぜない", () => {
    expect(providerImpactProducts("supabase", providerLinks)).toEqual({
      runtimeProducts: ["mini-tools"],
      monitoringProducts: ["pc-saas-health-monitor"],
    });
  });

  it("selected productのincoming/outgoingを1-hopに分ける", () => {
    expect(splitProductRelations("mini-tools", relations)).toEqual({
      outgoing: [relations[0]],
      incoming: [relations[1]],
    });
  });
});
