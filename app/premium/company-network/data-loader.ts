import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompanyGroupMembership,
  CompanyNetworkCompany,
  CompanyNetworkData,
  CompanyNetworkLoadResult,
  CompanyRelationship,
  Confidence,
  RelationCategory,
  VerificationStatus,
} from "./types";

const ROW_LIMIT = 2000;
const RELATION_CATEGORIES: readonly string[] = ["capital", "control", "historical"];
const VERIFICATION_STATUSES: readonly string[] = ["proposed", "verified", "rejected", "superseded"];
const CONFIDENCES: readonly string[] = ["high", "medium", "low"];

type Row = Record<string, unknown>;

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
    !relationId ||
    !sourceCompanyId ||
    !sourceCompanyName ||
    !targetCompanyId ||
    !targetCompanyName ||
    !relationCategory ||
    !verificationStatus ||
    !confidence
  ) {
    return null;
  }
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
  if (!membershipId || !companyId || !companyName || !groupId || !groupName || !verificationStatus || !confidence) {
    return null;
  }
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

export function companyNetworkUnconfigured(): CompanyNetworkLoadResult {
  return {
    status: "unconfigured",
    data: null,
    message: "Supabase 連携が未設定のため企業関係マップを取得できません。",
  };
}

export function companyNetworkAuthRequired(): CompanyNetworkLoadResult {
  return {
    status: "unauthenticated",
    data: null,
    message: "Supabase にログインすると、保存済みの企業関係マップを表示します。",
  };
}

export async function loadCompanyNetwork(supabase: SupabaseClient): Promise<CompanyNetworkLoadResult> {
  const [companiesResult, relationshipsResult, membershipsResult] = await Promise.all([
    supabase
      .from("stock_notes_company_entities")
      .select("id,display_name,country_code,listing_status,status")
      .neq("status", "archived")
      .order("display_name", { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from("stock_notes_company_relationship_edges_v")
      .select(
        "relation_id,source_company_id,source_company_name,target_company_id,target_company_name," +
          "relation_category,relation_type,ownership_pct,voting_rights_pct,is_consolidated,relation_note," +
          "verification_status,confidence,source_title,source_url,source_type,source_as_of,checked_at,valid_to",
      )
      .is("valid_to", null)
      .in("verification_status", ["verified", "proposed"])
      .order("source_company_name", { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from("stock_notes_company_group_memberships_v")
      .select(
        "membership_id,company_entity_id,company_name,group_id,group_slug,group_name,group_type," +
          "membership_role,membership_basis,relation_note,verification_status,confidence," +
          "source_title,source_url,source_type,source_as_of,valid_to",
      )
      .is("valid_to", null)
      .in("verification_status", ["verified", "proposed"])
      .order("company_name", { ascending: true })
      .limit(ROW_LIMIT),
  ]);

  if (companiesResult.error || relationshipsResult.error || membershipsResult.error) {
    return {
      status: "error",
      data: null,
      message: "企業関係マップの取得に失敗しました。Supabase のView/RLS設定を確認してください。",
    };
  }

  const companies = ((companiesResult.data ?? []) as unknown as Row[])
    .map(parseCompany)
    .filter((row): row is CompanyNetworkCompany => row !== null);
  const relationships = ((relationshipsResult.data ?? []) as unknown as Row[])
    .map(parseRelationship)
    .filter((row): row is CompanyRelationship => row !== null);
  const memberships = ((membershipsResult.data ?? []) as unknown as Row[])
    .map(parseMembership)
    .filter((row): row is CompanyGroupMembership => row !== null);

  const data: CompanyNetworkData = { companies, relationships, memberships };
  if (relationships.length === 0 && memberships.length === 0) {
    return {
      status: "empty",
      data,
      message: "保存済みの企業関係がまだありません。",
    };
  }
  return { status: "ok", data, message: null };
}
