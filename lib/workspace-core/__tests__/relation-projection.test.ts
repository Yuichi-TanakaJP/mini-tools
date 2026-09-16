import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWorkspaceCoreOverview, loadWorkspaceCoreProductDetail } from "../data";
import { dependencyFacingProductRelations } from "../product-relation-policy";
import type { WorkspaceCoreProductRelation } from "../types";

type Row = Record<string, unknown>;
const lineage: Row = {
  source_product_slug: "test-antigravity", source_product_name: "Experiment",
  target_product_slug: "sensoria-portfolio", target_product_name: "Successor",
  relation_type: "predecessor_of", source: "fixture", confidence: 1,
};
const dependency: Row = {
  ...lineage, source_product_slug: "consumer", target_product_slug: "sensoria-portfolio",
  relation_type: "consumes_api",
};

/** Read-only query stub. A write or unexpected client method cannot succeed. */
function client(relations: Row[], failRelations = false): SupabaseClient {
  const products = ["test-antigravity", "sensoria-portfolio", "consumer"].map((slug) => ({
    slug, name: slug, product_id: slug, lifecycle_status: slug === "test-antigravity" ? "archived" : "active",
  }));
  return {
    from(table: string) {
      const rows: Row[] = table === "workspace_core_product_relation_v" ? relations
        : table === "workspace_core_product_summary_v" ? products : [];
      const error = failRelations && table === "workspace_core_product_relation_v" ? { message: "fixture failure" } : null;
      const filters: Array<[string, unknown]> = [];
      const result = () => ({ data: rows.filter((r) => filters.every(([key, value]) => r[key] === value)), error });
      const builder = {
        select: () => builder,
        order: () => builder,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
        maybeSingle: () => Promise.resolve({ data: result().data[0] ?? null, error }),
        then: (resolve: (r: ReturnType<typeof result>) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve, reject),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe("historical lineage is not a dependency feed", () => {
  it("filters overview without modifying the canonical input", async () => {
    const rows = [lineage, dependency];
    const before = JSON.stringify(rows);
    const result = await loadWorkspaceCoreOverview(client(rows));
    expect(result.relations.map((r) => r.relationType)).toEqual(["consumes_api"]);
    expect(result.products.some((p) => p.slug === "test-antigravity")).toBe(true);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("filters incoming lineage while retaining actual incoming dependencies", async () => {
    const result = await loadWorkspaceCoreProductDetail(client([lineage, dependency]), "sensoria-portfolio");
    expect(result?.incomingRelations.map((r) => r.relationType)).toEqual(["consumes_api"]);
  });
  it("filters outgoing lineage and preserves an archived product", async () => {
    const result = await loadWorkspaceCoreProductDetail(client([lineage]), "test-antigravity");
    expect(result?.outgoingRelations).toEqual([]);
    expect(result?.product.lifecycleStatus).toBe("archived");
  });
  it("does not convert a relation-read error into an empty graph", async () => {
    await expect(loadWorkspaceCoreOverview(client([], true))).rejects.toThrow("fixture failure");
    await expect(loadWorkspaceCoreProductDetail(client([], true), "sensoria-portfolio")).rejects.toThrow("fixture failure");
  });
  it("handles missing products and empty graphs", async () => {
    expect(await loadWorkspaceCoreProductDetail(client([]), "missing")).toBeNull();
    expect((await loadWorkspaceCoreOverview(client([]))).relations).toEqual([]);
  });
  it("does not reinterpret unrelated or future relation types", () => {
    const relation = (relationType: string): WorkspaceCoreProductRelation => ({
      sourceProductSlug: "a", sourceProductName: "A", targetProductSlug: "b", targetProductName: "B",
      relationType, source: "fixture", confidence: 1, verifiedAt: null, notes: null,
    });
    const rows = [relation("predecessor_of"), relation("consumes_data"), relation("other")];
    expect(dependencyFacingProductRelations(rows)).toEqual(rows.slice(1));
    expect(rows).toHaveLength(3);
  });
});
