import type { SupabaseClient } from "@supabase/supabase-js";

const ROW_LIMIT = 2000;

export type ThemeNetworkTheme = {
  id: string;
  slug: string;
  name: string;
};

export type ThemeDirectCompany = {
  linkId: string;
  themeId: string;
  companyId: string;
  companyName: string;
  note: string;
  sourceLinkId: string | null;
  sourceStatus: string | null;
  relationType: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceAsOf: string | null;
  confidence: string | null;
};

export type ThemeCompanyRelationship = {
  relationId: string;
  sourceCompanyId: string;
  sourceCompanyName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  relationCategory: string;
  relationType: string;
  ownershipPct: number | null;
  votingRightsPct: number | null;
  verificationStatus: string;
  confidence: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceAsOf: string | null;
  note: string;
};

export type ThemeCompanyNetworkData = {
  themes: ThemeNetworkTheme[];
  directCompanies: ThemeDirectCompany[];
  relationships: ThemeCompanyRelationship[];
};

export type ThemeCompanyNetworkLoadResult =
  | { status: "ok"; data: ThemeCompanyNetworkData; message: null }
  | { status: "empty" | "error" | "unconfigured" | "unauthenticated"; data: ThemeCompanyNetworkData | null; message: string };

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableText(row: Row, key: string): string | null {
  const value = text(row, key).trim();
  return value ? value : null;
}

function nullableNumber(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function themeCompanyNetworkUnconfigured(): ThemeCompanyNetworkLoadResult {
  return { status: "unconfigured", data: null, message: "Supabase 連携が未設定のためテーマ企業ネットワークを取得できません。" };
}

export function themeCompanyNetworkAuthRequired(): ThemeCompanyNetworkLoadResult {
  return { status: "unauthenticated", data: null, message: "Supabase にログインするとテーマ企業ネットワークを表示します。" };
}

export async function loadThemeCompanyNetwork(supabase: SupabaseClient): Promise<ThemeCompanyNetworkLoadResult> {
  const [themesResult, linksResult, sourceLinksResult, companiesResult, relationshipsResult] = await Promise.all([
    supabase
      .from("stock_notes_themes")
      .select("id,slug,display_name,status")
      .neq("status", "archived")
      .order("display_name", { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from("stock_notes_theme_company_links")
      .select("id,theme_id,company_entity_id,source_theme_link_id,relation_note")
      .order("created_at", { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from("stock_notes_theme_links")
      .select("id,status,relation_type,source_title,source_url,source_as_of,confidence")
      .in("status", ["verified", "proposed"])
      .limit(ROW_LIMIT),
    supabase
      .from("stock_notes_company_entities")
      .select("id,display_name,status")
      .neq("status", "archived")
      .limit(ROW_LIMIT),
    supabase
      .from("stock_notes_company_relationship_edges_v")
      .select(
        "relation_id,source_company_id,source_company_name,target_company_id,target_company_name," +
          "relation_category,relation_type,ownership_pct,voting_rights_pct,verification_status,confidence," +
          "source_title,source_url,source_as_of,relation_note,valid_to",
      )
      .is("valid_to", null)
      .in("verification_status", ["verified", "proposed"])
      .limit(ROW_LIMIT),
  ]);

  if (themesResult.error || linksResult.error || sourceLinksResult.error || companiesResult.error || relationshipsResult.error) {
    return { status: "error", data: null, message: "テーマ企業ネットワークの取得に失敗しました。Supabase のRLS / View設定を確認してください。" };
  }

  const companies = new Map<string, string>();
  for (const raw of (companiesResult.data ?? []) as unknown as Row[]) {
    const id = nullableText(raw, "id");
    const name = nullableText(raw, "display_name");
    if (id && name) companies.set(id, name);
  }

  const sources = new Map<string, Row>();
  for (const raw of (sourceLinksResult.data ?? []) as unknown as Row[]) {
    const id = nullableText(raw, "id");
    if (id) sources.set(id, raw);
  }

  const directCompanies: ThemeDirectCompany[] = [];
  for (const raw of (linksResult.data ?? []) as unknown as Row[]) {
    const linkId = nullableText(raw, "id");
    const themeId = nullableText(raw, "theme_id");
    const companyId = nullableText(raw, "company_entity_id");
    if (!linkId || !themeId || !companyId) continue;
    const companyName = companies.get(companyId);
    if (!companyName) continue;
    const sourceLinkId = nullableText(raw, "source_theme_link_id");
    const source = sourceLinkId ? sources.get(sourceLinkId) : undefined;
    directCompanies.push({
      linkId,
      themeId,
      companyId,
      companyName,
      note: text(raw, "relation_note"),
      sourceLinkId,
      sourceStatus: source ? nullableText(source, "status") : null,
      relationType: source ? nullableText(source, "relation_type") : null,
      sourceTitle: source ? nullableText(source, "source_title") : null,
      sourceUrl: source ? nullableText(source, "source_url") : null,
      sourceAsOf: source ? nullableText(source, "source_as_of") : null,
      confidence: source ? nullableText(source, "confidence") : null,
    });
  }

  const usedThemeIds = new Set(directCompanies.map((link) => link.themeId));
  const themes: ThemeNetworkTheme[] = ((themesResult.data ?? []) as unknown as Row[])
    .map((raw) => ({ id: text(raw, "id"), slug: text(raw, "slug"), name: text(raw, "display_name") }))
    .filter((theme) => theme.id && theme.name && usedThemeIds.has(theme.id));

  const relationships: ThemeCompanyRelationship[] = [];
  for (const raw of (relationshipsResult.data ?? []) as unknown as Row[]) {
    const relationId = nullableText(raw, "relation_id");
    const sourceCompanyId = nullableText(raw, "source_company_id");
    const sourceCompanyName = nullableText(raw, "source_company_name");
    const targetCompanyId = nullableText(raw, "target_company_id");
    const targetCompanyName = nullableText(raw, "target_company_name");
    const verificationStatus = nullableText(raw, "verification_status");
    const confidence = nullableText(raw, "confidence");
    if (!relationId || !sourceCompanyId || !sourceCompanyName || !targetCompanyId || !targetCompanyName || !verificationStatus || !confidence) continue;
    relationships.push({
      relationId,
      sourceCompanyId,
      sourceCompanyName,
      targetCompanyId,
      targetCompanyName,
      relationCategory: text(raw, "relation_category"),
      relationType: text(raw, "relation_type"),
      ownershipPct: nullableNumber(raw, "ownership_pct"),
      votingRightsPct: nullableNumber(raw, "voting_rights_pct"),
      verificationStatus,
      confidence,
      sourceTitle: nullableText(raw, "source_title"),
      sourceUrl: nullableText(raw, "source_url"),
      sourceAsOf: nullableText(raw, "source_as_of"),
      note: text(raw, "relation_note"),
    });
  }

  const data = { themes, directCompanies, relationships };
  if (themes.length === 0 || directCompanies.length === 0) {
    return { status: "empty", data, message: "company identityへ接続済みのテーマ企業がまだありません。" };
  }
  return { status: "ok", data, message: null };
}
