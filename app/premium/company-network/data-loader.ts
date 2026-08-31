import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyFunctionLink,
  CompanyGroupMembership,
  CompanyNetworkBootstrapResult,
  CompanyNetworkCompany,
  CompanyNetworkData,
  CompanyNetworkGroup,
  CompanyNetworkScopeResult,
  CompanyRelationship,
  Confidence,
  RelationCategory,
  VerificationStatus,
} from "./types";
import { mergeFunctionLinks } from "./function-link-resolution";

const ROW_LIMIT = 2000;
const RELATION_CATEGORIES: readonly string[] = ["capital", "control", "historical"];
const VERIFICATION_STATUSES: readonly string[] = ["proposed", "verified", "rejected", "superseded"];
const CONFIDENCES: readonly string[] = ["high", "medium", "low"];
const COMPANY_SELECT = "id,display_name,country_code,listing_status,status";
const RELATIONSHIP_SELECT =
  "relation_id,source_company_id,source_company_name,target_company_id,target_company_name," +
  "relation_category,relation_type,ownership_pct,voting_rights_pct,is_consolidated,relation_note," +
  "verification_status,confidence,source_title,source_url,source_type,source_as_of,checked_at,valid_to";
const MEMBERSHIP_SELECT =
  "membership_id,company_entity_id,company_name,group_id,group_slug,group_name,group_type," +
  "membership_role,membership_basis,relation_note,verification_status,confidence," +
  "source_title,source_url,source_type,source_as_of,valid_to";
const FUNCTION_LINK_SELECT =
  "id,company_entity_id,node_id,strategic_role,relation_note,source_type,confidence,as_of,valid_to";
const FUNCTION_NODE_SELECT = "id,slug,display_name,kind";
const FUNCTION_EDGE_SELECT = "source_node_id,target_node_id,relation_type";

type Row = Record<string, unknown>;

type FunctionNode = {
  id: string;
  slug: string;
  name: string;
  kind: string;
};

function stringValue(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableString(row: Row, key: string): string | null {
  const value = stringValue(row, key).trim();
  return value.length > 0 ? value : null;
}

function nullableNumber(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nullableBoolean(row: Row, key: string): boolean | null {
  const value = row[key];
  return typeof value === "boolean" ? value : null;
}

function oneOf<T extends string>(row: Row, key: string, allowed: readonly string[]): T | null {
  const value = stringValue(row, key);
  return allowed.includes(value) ? (value as T) : null;
}

function parseCompany(row: Row): CompanyNetworkCompany | null {
  const id = nullableString(row, "id");
  const name = nullableString(row, "display_name");
  if (!id || !name) return null;
  return {
    id,
    name,
    countryCode: nullableString(row, "country_code"),
    listingStatus: stringValue(row, "listing_status"),
    status: stringValue(row, "status"),
  };
}

function parseRelationship(row: Row): CompanyRelationship | null {
  const relationId = nullableString(row, "relation_id");
  const sourceCompanyId = nullableString(row, "source_company_id");
  const sourceCompanyName = nullableString(row, "source_company_name");
  const targetCompanyId = nullableString(row, "target_company_id");
  const targetCompanyName = nullableString(row, "target_company_name");
  const relationCategory = oneOf<RelationCategory>(row, "relation_category", RELATION_CATEGORIES);
  const verificationStatus = oneOf<VerificationStatus>(row, "verification_status", VERIFICATION_STATUSES);
  const confidence = oneOf<Confidence>(row, "confidence", CONFIDENCES);
  if (
    !relationId || !sourceCompanyId || !sourceCompanyName || !targetCompanyId || !targetCompanyName ||
    !relationCategory || !verificationStatus || !confidence
  ) return null;

  return {
    relationId,
    sourceCompanyId,
    sourceCompanyName,
    targetCompanyId,
    targetCompanyName,
    relationCategory,
    relationType: stringValue(row, "relation_type"),
    ownershipPct: nullableNumber(row, "ownership_pct"),
    votingRightsPct: nullableNumber(row, "voting_rights_pct"),
    isConsolidated: nullableBoolean(row, "is_consolidated"),
    note: stringValue(row, "relation_note"),
    verificationStatus,
    confidence,
    sourceTitle: nullableString(row, "source_title"),
    sourceUrl: nullableString(row, "source_url"),
    sourceType: nullableString(row, "source_type"),
    sourceAsOf: nullableString(row, "source_as_of"),
    checkedAt: nullableString(row, "checked_at"),
  };
}

function parseMembership(row: Row): CompanyGroupMembership | null {
  const membershipId = nullableString(row, "membership_id");
  const companyId = nullableString(row, "company_entity_id");
  const companyName = nullableString(row, "company_name");
  const groupId = nullableString(row, "group_id");
  const groupName = nullableString(row, "group_name");
  const verificationStatus = oneOf<VerificationStatus>(row, "verification_status", VERIFICATION_STATUSES);
  const confidence = oneOf<Confidence>(row, "confidence", CONFIDENCES);
  if (!membershipId || !companyId || !companyName || !groupId || !groupName || !verificationStatus || !confidence) return null;

  return {
    membershipId,
    companyId,
    companyName,
    groupId,
    groupSlug: stringValue(row, "group_slug"),
    groupName,
    groupType: stringValue(row, "group_type"),
    membershipRole: stringValue(row, "membership_role"),
    membershipBasis: stringValue(row, "membership_basis"),
    note: stringValue(row, "relation_note"),
    verificationStatus,
    confidence,
    sourceTitle: nullableString(row, "source_title"),
    sourceUrl: nullableString(row, "source_url"),
    sourceType: nullableString(row, "source_type"),
    sourceAsOf: nullableString(row, "source_as_of"),
  };
}

function parseGroup(row: Row): CompanyNetworkGroup | null {
  const id = nullableString(row, "id");
  const name = nullableString(row, "display_name");
  if (!id || !name) return null;
  return { id, name, groupType: stringValue(row, "group_type") };
}

function parseFunctionNode(row: Row): FunctionNode | null {
  const id = nullableString(row, "id");
  const slug = nullableString(row, "slug");
  const name = nullableString(row, "display_name");
  if (!id || !slug || !name) return null;
  return { id, slug, name, kind: stringValue(row, "kind") };
}

async function loadCompaniesByIds(supabase: SupabaseClient, companyIds: string[]) {
  if (companyIds.length === 0) return [] as CompanyNetworkCompany[];
  const result = await supabase
    .from("stock_notes_company_entities")
    .select(COMPANY_SELECT)
    .in("id", companyIds)
    .neq("status", "archived")
    .order("display_name", { ascending: true });
  if (result.error) return null;
  return ((result.data ?? []) as unknown as Row[])
    .map(parseCompany)
    .filter((row): row is CompanyNetworkCompany => row !== null);
}

async function loadCompanyFunctionLinks(
  supabase: SupabaseClient,
  companyIds: string[],
): Promise<CompanyFunctionLink[] | null> {
  if (companyIds.length === 0) return [];

  const nodesResult = await supabase
    .from("stock_notes_taxonomy_nodes")
    .select(FUNCTION_NODE_SELECT)
    .eq("domain", "company-functions")
    .eq("status", "active")
    .order("display_name", { ascending: true })
    .limit(ROW_LIMIT);
  if (nodesResult.error) return null;

  const nodes = ((nodesResult.data ?? []) as unknown as Row[])
    .map(parseFunctionNode)
    .filter((row): row is FunctionNode => row !== null);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const functionNodeIds = nodes.filter((node) => node.kind === "product_segment").map((node) => node.id);
  if (functionNodeIds.length === 0) return [];

  const edgesResult = await supabase
    .from("stock_notes_taxonomy_edges")
    .select(FUNCTION_EDGE_SELECT)
    .eq("domain", "company-functions")
    .eq("relation_type", "contains")
    .in("target_node_id", functionNodeIds)
    .limit(ROW_LIMIT);
  if (edgesResult.error) return null;

  const parentByNodeId = new Map<string, string>();
  ((edgesResult.data ?? []) as unknown as Row[]).forEach((row) => {
    const source = nullableString(row, "source_node_id");
    const target = nullableString(row, "target_node_id");
    if (source && target) parentByNodeId.set(target, source);
  });

  const toFunctionLink = (
    row: Row,
    nodeIdOverride?: string,
    linkIdOverride?: string,
  ): CompanyFunctionLink | null => {
    const linkId = linkIdOverride ?? nullableString(row, "id");
    const companyId = nullableString(row, "company_entity_id");
    const nodeId = nodeIdOverride ?? nullableString(row, "node_id");
    const confidence = oneOf<Confidence>(row, "confidence", CONFIDENCES);
    const node = nodeId ? nodeById.get(nodeId) : null;
    if (!linkId || !companyId || !nodeId || !node || !confidence) return null;
    const parentId = parentByNodeId.get(nodeId) ?? null;
    const parent = parentId ? nodeById.get(parentId) ?? null : null;
    return {
      linkId,
      companyId,
      nodeId,
      functionSlug: node.slug,
      functionName: node.name,
      classificationId: parent?.id ?? null,
      classificationSlug: parent?.slug ?? null,
      classificationName: parent?.name ?? null,
      role: stringValue(row, "strategic_role"),
      confidence,
      sourceType: nullableString(row, "source_type"),
      asOf: nullableString(row, "as_of"),
      note: stringValue(row, "relation_note"),
    };
  };

  const directResult = await supabase
    .from("stock_notes_company_taxonomy_links")
    .select(FUNCTION_LINK_SELECT)
    .in("company_entity_id", companyIds)
    .in("node_id", functionNodeIds)
    .is("valid_to", null)
    .limit(ROW_LIMIT);
  if (directResult.error) return null;

  const directLinks = ((directResult.data ?? []) as unknown as Row[])
    .map((row) => toFunctionLink(row))
    .filter((row): row is CompanyFunctionLink => row !== null);

  const normalizationEdgesResult = await supabase
    .from("stock_notes_taxonomy_edges")
    .select(FUNCTION_EDGE_SELECT)
    .eq("domain", "cross-domain")
    .eq("relation_type", "related_to")
    .in("target_node_id", functionNodeIds)
    .limit(ROW_LIMIT);
  if (normalizationEdgesResult.error) return null;

  const targetNodeIdsBySource = new Map<string, string[]>();
  ((normalizationEdgesResult.data ?? []) as unknown as Row[]).forEach((row) => {
    const source = nullableString(row, "source_node_id");
    const target = nullableString(row, "target_node_id");
    if (!source || !target || !nodeById.has(target)) return;
    const targets = targetNodeIdsBySource.get(source) ?? [];
    if (!targets.includes(target)) targets.push(target);
    targetNodeIdsBySource.set(source, targets);
  });

  const sourceNodeIds = [...targetNodeIdsBySource.keys()];
  if (sourceNodeIds.length === 0) return directLinks;

  const sourceLinksResult = await supabase
    .from("stock_notes_company_taxonomy_links")
    .select(FUNCTION_LINK_SELECT)
    .in("company_entity_id", companyIds)
    .in("node_id", sourceNodeIds)
    .is("valid_to", null)
    .limit(ROW_LIMIT);
  if (sourceLinksResult.error) return null;

  const derivedLinks: CompanyFunctionLink[] = [];
  for (const row of (sourceLinksResult.data ?? []) as unknown as Row[]) {
    const sourceLinkId = nullableString(row, "id");
    const sourceNodeId = nullableString(row, "node_id");
    if (!sourceLinkId || !sourceNodeId) continue;
    for (const targetNodeId of targetNodeIdsBySource.get(sourceNodeId) ?? []) {
      const derived = toFunctionLink(row, targetNodeId, `derived:${sourceLinkId}:${targetNodeId}`);
      if (derived) derivedLinks.push(derived);
    }
  }

  return mergeFunctionLinks(directLinks, derivedLinks);
}

export function companyNetworkUnconfigured(): CompanyNetworkBootstrapResult {
  return { status: "unconfigured", data: null, message: "Supabase 連携が未設定のため企業関係マップを取得できません。" };
}

export function companyNetworkAuthRequired(): CompanyNetworkBootstrapResult {
  return { status: "unauthenticated", data: null, message: "Supabase にログインすると、保存済みの企業関係マップを表示します。" };
}

export async function loadCompanyNetworkBootstrap(supabase: SupabaseClient): Promise<CompanyNetworkBootstrapResult> {
  const groupsResult = await supabase
    .from("stock_notes_corporate_groups")
    .select("id,display_name,group_type")
    .eq("status", "active")
    .is("valid_to", null)
    .in("verification_status", ["verified", "proposed"])
    .order("display_name", { ascending: true })
    .limit(ROW_LIMIT);

  if (groupsResult.error) {
    return { status: "error", data: null, message: "企業グループ一覧を取得できませんでした。" };
  }

  const groups = ((groupsResult.data ?? []) as unknown as Row[])
    .map(parseGroup)
    .filter((row): row is CompanyNetworkGroup => row !== null);

  if (groups.length === 0) {
    return {
      status: "empty",
      data: { entryCompanies: [], groups: [], defaultCompanyId: "", defaultGroupId: "" },
      message: "企業グループがまだありません。",
    };
  }

  const defaultGroupId = groups.find((group) => group.name === "トヨタグループ")?.id ?? groups[0].id;
  return {
    status: "ok",
    data: { entryCompanies: [], groups, defaultCompanyId: "", defaultGroupId },
    message: null,
  };
}

export async function loadCompanyGroupScope(
  supabase: SupabaseClient,
  options: {
    groupId: string;
    verifiedOnly: boolean;
    categories: RelationCategory[];
  },
): Promise<CompanyNetworkScopeResult> {
  const statuses = options.verifiedOnly ? ["verified"] : ["verified", "proposed"];
  const membershipResult = await supabase
    .from("stock_notes_company_group_memberships_v")
    .select(MEMBERSHIP_SELECT)
    .eq("group_id", options.groupId)
    .is("valid_to", null)
    .in("verification_status", statuses)
    .order("company_name", { ascending: true })
    .limit(ROW_LIMIT);

  if (membershipResult.error) {
    return { status: "error", data: null, message: "選択した企業グループの所属企業を取得できませんでした。" };
  }

  const memberships = ((membershipResult.data ?? []) as unknown as Row[])
    .map(parseMembership)
    .filter((row): row is CompanyGroupMembership => row !== null);
  const companyIds = [...new Set(memberships.map((membership) => membership.companyId))];
  const companyIdSet = new Set(companyIds);

  let relationships: CompanyRelationship[] = [];
  if (companyIds.length > 0 && options.categories.length > 0) {
    const relationshipResult = await supabase
      .from("stock_notes_company_relationship_edges_v")
      .select(RELATIONSHIP_SELECT)
      .in("source_company_id", companyIds)
      .in("relation_category", options.categories)
      .is("valid_to", null)
      .in("verification_status", statuses)
      .order("source_company_name", { ascending: true })
      .limit(ROW_LIMIT);
    if (relationshipResult.error) {
      return { status: "error", data: null, message: "グループ内の企業間関係を取得できませんでした。" };
    }
    relationships = ((relationshipResult.data ?? []) as unknown as Row[])
      .map(parseRelationship)
      .filter((row): row is CompanyRelationship => row !== null && companyIdSet.has(row.targetCompanyId));
  }

  const companies = await loadCompaniesByIds(supabase, companyIds);
  if (companies === null) {
    return { status: "error", data: null, message: "グループ所属企業の情報を取得できませんでした。" };
  }
  const functions = await loadCompanyFunctionLinks(supabase, companyIds);
  if (functions === null) {
    return { status: "error", data: null, message: "グループ企業の事業・機能分類を取得できませんでした。" };
  }

  const data: CompanyNetworkData = { companies, relationships, memberships, functions };
  return {
    status: memberships.length === 0 ? "empty" : "ok",
    data,
    message: memberships.length === 0 ? "このグループには現在の条件で表示できる所属企業がありません。" : null,
  };
}

export async function loadCompanyNetworkScope(
  supabase: SupabaseClient,
  options: {
    companyId: string;
    hops: 1 | 2;
    verifiedOnly: boolean;
    categories: RelationCategory[];
    includeGroups: boolean;
  },
): Promise<CompanyNetworkScopeResult> {
  const statuses = options.verifiedOnly ? ["verified"] : ["verified", "proposed"];

  let relationshipIds: string[] = [];
  if (options.categories.length > 0) {
    const networkResult = await supabase.rpc("stock_notes_company_network", {
      p_company_id: options.companyId,
      p_max_hops: options.hops,
      p_verified_only: options.verifiedOnly,
      p_active_only: true,
      p_relation_categories: options.categories,
    });
    if (networkResult.error) {
      return { status: "error", data: null, message: "選択企業の企業間関係を取得できませんでした。" };
    }
    relationshipIds = [...new Set(
      ((networkResult.data ?? []) as unknown as Row[])
        .map((row) => nullableString(row, "relation_id"))
        .filter((id): id is string => Boolean(id)),
    )];
  }

  let relationships: CompanyRelationship[] = [];
  if (relationshipIds.length > 0) {
    const relationshipResult = await supabase
      .from("stock_notes_company_relationship_edges_v")
      .select(RELATIONSHIP_SELECT)
      .in("relation_id", relationshipIds)
      .is("valid_to", null)
      .in("verification_status", statuses)
      .order("source_company_name", { ascending: true });
    if (relationshipResult.error) {
      return { status: "error", data: null, message: "企業関係の根拠情報を取得できませんでした。" };
    }
    relationships = ((relationshipResult.data ?? []) as unknown as Row[])
      .map(parseRelationship)
      .filter((row): row is CompanyRelationship => row !== null);
  }

  let memberships: CompanyGroupMembership[] = [];
  if (options.includeGroups) {
    const centerMembershipResult = await supabase
      .from("stock_notes_company_group_memberships_v")
      .select(MEMBERSHIP_SELECT)
      .eq("company_entity_id", options.companyId)
      .is("valid_to", null)
      .in("verification_status", statuses)
      .limit(ROW_LIMIT);

    if (centerMembershipResult.error) {
      return { status: "error", data: null, message: "選択企業のグループ所属を取得できませんでした。" };
    }

    const centerMemberships = ((centerMembershipResult.data ?? []) as unknown as Row[])
      .map(parseMembership)
      .filter((row): row is CompanyGroupMembership => row !== null);
    const groupIds = [...new Set(centerMemberships.map((membership) => membership.groupId))];

    if (groupIds.length > 0) {
      const groupMembershipResult = await supabase
        .from("stock_notes_company_group_memberships_v")
        .select(MEMBERSHIP_SELECT)
        .in("group_id", groupIds)
        .is("valid_to", null)
        .in("verification_status", statuses)
        .order("company_name", { ascending: true })
        .limit(ROW_LIMIT);
      if (groupMembershipResult.error) {
        return { status: "error", data: null, message: "所属グループの企業一覧を取得できませんでした。" };
      }
      memberships = ((groupMembershipResult.data ?? []) as unknown as Row[])
        .map(parseMembership)
        .filter((row): row is CompanyGroupMembership => row !== null);
    }
  }

  const companyIds = new Set<string>([options.companyId]);
  relationships.forEach((relationship) => {
    companyIds.add(relationship.sourceCompanyId);
    companyIds.add(relationship.targetCompanyId);
  });
  memberships.forEach((membership) => companyIds.add(membership.companyId));

  const companyIdList = [...companyIds];
  const companies = await loadCompaniesByIds(supabase, companyIdList);
  if (companies === null) {
    return { status: "error", data: null, message: "表示対象企業の情報を取得できませんでした。" };
  }
  const functions = await loadCompanyFunctionLinks(supabase, companyIdList);
  if (functions === null) {
    return { status: "error", data: null, message: "表示企業の事業・機能分類を取得できませんでした。" };
  }

  const data: CompanyNetworkData = { companies, relationships, memberships, functions };
  const empty = relationships.length === 0 && memberships.length === 0 && functions.length === 0;
  return { status: empty ? "empty" : "ok", data, message: empty ? "この企業には現在の条件で表示できる関係・機能情報がありません。" : null };
}
