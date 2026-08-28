import type { SupabaseClient } from "@supabase/supabase-js";

export type CompanyGroupExposureMember = {
  instrumentId: string;
  identifier: string;
  name: string;
  marketValue: number;
  companyEntityId: string;
  companyName: string;
  membershipBasis: string;
  sourceAsOf: string | null;
};

export type CompanyGroupExposureRow = {
  groupId: string;
  groupName: string;
  groupType: string;
  marketValue: number;
  portfolioSharePct: number | null;
  members: CompanyGroupExposureMember[];
};

export type CompanyGroupExposure = {
  snapshotId: string | null;
  totalMarketValue: number | null;
  eligibleInstrumentCount: number;
  companyResolvedInstrumentCount: number;
  groupResolvedInstrumentCount: number;
  groupResolvedMarketValue: number;
  coveragePct: number | null;
  groups: CompanyGroupExposureRow[];
};

type PositionRow = { instrument_id: string; market_value: number | string | null };
type InstrumentRow = { id: string; stock_id: string | null; asset_type: string; identifier: string; name: string };
type CompanyStockLinkRow = { stock_id: string; company_entity_id: string };
type MembershipRow = {
  company_entity_id: string;
  company_name: string;
  group_id: string;
  group_name: string;
  group_type: string;
  membership_basis: string;
  source_as_of: string | null;
};

const ELIGIBLE_GROUP_TYPES = new Set(["corporate_group", "capital_group", "keiretsu", "presidents_club"]);

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function emptyCompanyGroupExposure(snapshotId: string | null = null): CompanyGroupExposure {
  return {
    snapshotId,
    totalMarketValue: null,
    eligibleInstrumentCount: 0,
    companyResolvedInstrumentCount: 0,
    groupResolvedInstrumentCount: 0,
    groupResolvedMarketValue: 0,
    coveragePct: null,
    groups: [],
  };
}

export async function loadCompanyGroupExposure(supabase: SupabaseClient, snapshotId: string | null): Promise<CompanyGroupExposure> {
  if (!snapshotId) return emptyCompanyGroupExposure();

  const { data: positionData, error: positionError } = await supabase
    .from("stock_notes_portfolio_positions")
    .select("instrument_id, market_value")
    .eq("snapshot_id", snapshotId)
    .returns<PositionRow[]>();
  if (positionError) throw positionError;

  const valueByInstrument = new Map<string, number>();
  for (const row of positionData ?? []) {
    const marketValue = toNumber(row.market_value);
    if (marketValue === null) continue;
    valueByInstrument.set(row.instrument_id, (valueByInstrument.get(row.instrument_id) ?? 0) + marketValue);
  }

  const instrumentIds = [...valueByInstrument.keys()];
  if (instrumentIds.length === 0) return { ...emptyCompanyGroupExposure(snapshotId), totalMarketValue: 0 };

  const { data: instrumentData, error: instrumentError } = await supabase
    .from("stock_notes_portfolio_instruments")
    .select("id, stock_id, asset_type, identifier, name")
    .in("id", instrumentIds)
    .returns<InstrumentRow[]>();
  if (instrumentError) throw instrumentError;

  const instruments = (instrumentData ?? []).filter((row) => row.stock_id && row.asset_type === "domestic_stock");
  const totalMarketValue = [...valueByInstrument.values()].reduce((sum, value) => sum + value, 0);
  const stockIds = [...new Set(instruments.map((row) => row.stock_id).filter((id): id is string => Boolean(id)))];
  if (stockIds.length === 0) {
    return { ...emptyCompanyGroupExposure(snapshotId), totalMarketValue, eligibleInstrumentCount: instruments.length, coveragePct: totalMarketValue > 0 ? 0 : null };
  }

  const { data: linkData, error: linkError } = await supabase
    .from("stock_notes_company_stock_links")
    .select("stock_id, company_entity_id")
    .in("stock_id", stockIds)
    .is("valid_to", null)
    .returns<CompanyStockLinkRow[]>();
  if (linkError) throw linkError;

  const companyByStock = new Map<string, string>();
  for (const row of linkData ?? []) companyByStock.set(row.stock_id, row.company_entity_id);
  const companyIds = [...new Set(companyByStock.values())];

  const { data: membershipData, error: membershipError } = companyIds.length > 0
    ? await supabase
      .from("stock_notes_company_group_memberships_v")
      .select("company_entity_id, company_name, group_id, group_name, group_type, membership_basis, source_as_of")
      .in("company_entity_id", companyIds)
      .eq("verification_status", "verified")
      .eq("is_current", true)
      .returns<MembershipRow[]>()
    : { data: [], error: null };
  if (membershipError) throw membershipError;

  const membershipsByCompany = new Map<string, MembershipRow[]>();
  for (const membership of membershipData ?? []) {
    if (!ELIGIBLE_GROUP_TYPES.has(membership.group_type)) continue;
    const rows = membershipsByCompany.get(membership.company_entity_id) ?? [];
    rows.push(membership);
    membershipsByCompany.set(membership.company_entity_id, rows);
  }

  const companyResolved = new Set<string>();
  const groupResolved = new Set<string>();
  const groups = new Map<string, CompanyGroupExposureRow>();

  for (const instrument of instruments) {
    if (!instrument.stock_id) continue;
    const companyEntityId = companyByStock.get(instrument.stock_id);
    if (!companyEntityId) continue;
    companyResolved.add(instrument.id);

    const memberships = membershipsByCompany.get(companyEntityId) ?? [];
    if (memberships.length === 0) continue;
    groupResolved.add(instrument.id);
    const marketValue = valueByInstrument.get(instrument.id) ?? 0;

    for (const membership of memberships) {
      const current = groups.get(membership.group_id) ?? {
        groupId: membership.group_id,
        groupName: membership.group_name,
        groupType: membership.group_type,
        marketValue: 0,
        portfolioSharePct: null,
        members: [],
      };
      current.marketValue += marketValue;
      current.members.push({
        instrumentId: instrument.id,
        identifier: instrument.identifier,
        name: instrument.name,
        marketValue,
        companyEntityId,
        companyName: membership.company_name,
        membershipBasis: membership.membership_basis,
        sourceAsOf: membership.source_as_of,
      });
      groups.set(membership.group_id, current);
    }
  }

  const groupResolvedMarketValue = [...groupResolved].reduce((sum, instrumentId) => sum + (valueByInstrument.get(instrumentId) ?? 0), 0);
  const groupRows = [...groups.values()]
    .map((group) => ({
      ...group,
      portfolioSharePct: totalMarketValue > 0 ? (group.marketValue / totalMarketValue) * 100 : null,
      members: group.members.sort((a, b) => b.marketValue - a.marketValue || a.identifier.localeCompare(b.identifier)),
    }))
    .sort((a, b) => b.marketValue - a.marketValue || a.groupName.localeCompare(b.groupName, "ja"));

  return {
    snapshotId,
    totalMarketValue,
    eligibleInstrumentCount: instruments.length,
    companyResolvedInstrumentCount: companyResolved.size,
    groupResolvedInstrumentCount: groupResolved.size,
    groupResolvedMarketValue,
    coveragePct: totalMarketValue > 0 ? (groupResolvedMarketValue / totalMarketValue) * 100 : null,
    groups: groupRows,
  };
}
