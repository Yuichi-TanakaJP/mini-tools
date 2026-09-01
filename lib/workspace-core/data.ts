import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkspaceCoreOverview,
  WorkspaceCoreProductDetail,
  WorkspaceCoreProductRelation,
  WorkspaceCoreProductSummary,
  WorkspaceCoreProviderImpact,
  WorkspaceCoreProviderLink,
  WorkspaceCoreRepositoryLink,
  WorkspaceCoreServiceInstanceLink,
  WorkspaceCoreTechnologyLink,
} from "./types";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? (row[key] as string) : "";
}

function nullableText(row: Row, key: string): string | null {
  const value = text(row, key).trim();
  return value ? value : null;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function booleanValue(row: Row, key: string): boolean {
  return row[key] === true;
}

function productSummary(row: Row): WorkspaceCoreProductSummary {
  return {
    productId: text(row, "product_id"),
    slug: text(row, "slug"),
    name: text(row, "name"),
    description: nullableText(row, "description"),
    productType: text(row, "product_type"),
    lifecycleStatus: text(row, "lifecycle_status"),
    importance: numberValue(row, "importance"),
    updatedAt: nullableText(row, "updated_at"),
    repositoryCount: numberValue(row, "repository_count"),
    technologyCount: numberValue(row, "technology_count"),
    providerCount: numberValue(row, "provider_count"),
    relationCount: numberValue(row, "relation_count"),
  };
}

function repositoryLink(row: Row): WorkspaceCoreRepositoryLink {
  return {
    productSlug: text(row, "product_slug"),
    repositoryId: text(row, "repository_id"),
    fullName: text(row, "full_name"),
    visibility: text(row, "visibility"),
    defaultBranch: nullableText(row, "default_branch"),
    archived: booleanValue(row, "archived"),
    htmlUrl: nullableText(row, "html_url"),
    role: text(row, "role"),
    isPrimary: booleanValue(row, "is_primary"),
    source: text(row, "source"),
    confidence: numberValue(row, "confidence"),
    verifiedAt: nullableText(row, "verified_at"),
    notes: nullableText(row, "notes"),
  };
}

function technologyLink(row: Row): WorkspaceCoreTechnologyLink {
  return {
    productSlug: text(row, "product_slug"),
    technologyId: text(row, "technology_id"),
    technologySlug: text(row, "technology_slug"),
    technologyName: text(row, "technology_name"),
    category: text(row, "category"),
    layer: nullableText(row, "layer"),
    role: nullableText(row, "role"),
    version: nullableText(row, "version"),
    source: text(row, "source"),
    confidence: numberValue(row, "confidence"),
    evidenceUri: nullableText(row, "evidence_uri"),
    lastVerifiedAt: nullableText(row, "last_verified_at"),
    notes: nullableText(row, "notes"),
  };
}

function providerLink(row: Row): WorkspaceCoreProviderLink {
  return {
    productSlug: text(row, "product_slug"),
    providerId: text(row, "provider_id"),
    providerSlug: text(row, "provider_slug"),
    providerName: text(row, "provider_name"),
    providerCategory: text(row, "provider_category"),
    relationType: text(row, "relation_type"),
    source: text(row, "source"),
    confidence: numberValue(row, "confidence"),
    evidenceUri: nullableText(row, "evidence_uri"),
    lastVerifiedAt: nullableText(row, "last_verified_at"),
    notes: nullableText(row, "notes"),
  };
}

function serviceInstanceLink(row: Row): WorkspaceCoreServiceInstanceLink {
  return {
    productSlug: text(row, "product_slug"),
    providerSlug: text(row, "provider_slug"),
    providerName: text(row, "provider_name"),
    serviceInstanceId: text(row, "service_instance_id"),
    externalId: nullableText(row, "external_id"),
    instanceName: text(row, "instance_name"),
    accountScope: text(row, "account_scope"),
    environment: text(row, "environment"),
    region: nullableText(row, "region"),
    url: nullableText(row, "url"),
    status: text(row, "status"),
    relationType: text(row, "relation_type"),
    source: text(row, "source"),
    confidence: numberValue(row, "confidence"),
    verifiedAt: nullableText(row, "verified_at"),
    notes: nullableText(row, "notes"),
  };
}

function productRelation(row: Row): WorkspaceCoreProductRelation {
  return {
    sourceProductSlug: text(row, "source_product_slug"),
    sourceProductName: text(row, "source_product_name"),
    targetProductSlug: text(row, "target_product_slug"),
    targetProductName: text(row, "target_product_name"),
    relationType: text(row, "relation_type"),
    source: text(row, "source"),
    confidence: numberValue(row, "confidence"),
    verifiedAt: nullableText(row, "verified_at"),
    notes: nullableText(row, "notes"),
  };
}

function assertResult(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function loadWorkspaceCoreOverview(supabase: SupabaseClient): Promise<WorkspaceCoreOverview> {
  const [productsResult, providersResult, relationsResult] = await Promise.all([
    supabase
      .from("workspace_core_product_summary_v")
      .select("*")
      .order("importance", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("workspace_core_product_provider_v")
      .select("*")
      .order("provider_name", { ascending: true })
      .order("product_slug", { ascending: true }),
    supabase
      .from("workspace_core_product_relation_v")
      .select("*")
      .order("source_product_name", { ascending: true })
      .order("target_product_name", { ascending: true }),
  ]);

  assertResult("Product一覧の取得に失敗しました", productsResult.error);
  assertResult("Provider一覧の取得に失敗しました", providersResult.error);
  assertResult("Product relationの取得に失敗しました", relationsResult.error);

  return {
    products: ((productsResult.data ?? []) as Row[]).map(productSummary),
    providerLinks: ((providersResult.data ?? []) as Row[]).map(providerLink),
    relations: ((relationsResult.data ?? []) as Row[]).map(productRelation),
  };
}

export async function loadWorkspaceCoreProductDetail(
  supabase: SupabaseClient,
  slug: string,
): Promise<WorkspaceCoreProductDetail | null> {
  const productResult = await supabase
    .from("workspace_core_product_summary_v")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  assertResult("Productの取得に失敗しました", productResult.error);
  if (!productResult.data) return null;

  const [repositoriesResult, technologiesResult, providersResult, instancesResult, outgoingResult, incomingResult] =
    await Promise.all([
      supabase.from("workspace_core_product_repository_v").select("*").eq("product_slug", slug).order("is_primary", { ascending: false }).order("full_name", { ascending: true }),
      supabase.from("workspace_core_product_technology_v").select("*").eq("product_slug", slug).order("technology_name", { ascending: true }),
      supabase.from("workspace_core_product_provider_v").select("*").eq("product_slug", slug).order("provider_name", { ascending: true }),
      supabase.from("workspace_core_product_instance_v").select("*").eq("product_slug", slug).order("provider_name", { ascending: true }),
      supabase.from("workspace_core_product_relation_v").select("*").eq("source_product_slug", slug).order("target_product_name", { ascending: true }),
      supabase.from("workspace_core_product_relation_v").select("*").eq("target_product_slug", slug).order("source_product_name", { ascending: true }),
    ]);

  assertResult("Repository relationの取得に失敗しました", repositoriesResult.error);
  assertResult("Technology relationの取得に失敗しました", technologiesResult.error);
  assertResult("Provider relationの取得に失敗しました", providersResult.error);
  assertResult("Service instance relationの取得に失敗しました", instancesResult.error);
  assertResult("Outgoing relationの取得に失敗しました", outgoingResult.error);
  assertResult("Incoming relationの取得に失敗しました", incomingResult.error);

  return {
    product: productSummary(productResult.data as Row),
    repositories: ((repositoriesResult.data ?? []) as Row[]).map(repositoryLink),
    technologies: ((technologiesResult.data ?? []) as Row[]).map(technologyLink),
    providers: ((providersResult.data ?? []) as Row[]).map(providerLink),
    serviceInstances: ((instancesResult.data ?? []) as Row[]).map(serviceInstanceLink),
    outgoingRelations: ((outgoingResult.data ?? []) as Row[]).map(productRelation),
    incomingRelations: ((incomingResult.data ?? []) as Row[]).map(productRelation),
  };
}

export async function loadWorkspaceCoreProviderImpact(
  supabase: SupabaseClient,
  providerSlug: string,
): Promise<WorkspaceCoreProviderImpact> {
  const result = await supabase
    .from("workspace_core_product_provider_v")
    .select("*")
    .eq("provider_slug", providerSlug)
    .order("product_slug", { ascending: true });
  assertResult("Provider impactの取得に失敗しました", result.error);
  return { providerSlug, links: ((result.data ?? []) as Row[]).map(providerLink) };
}
