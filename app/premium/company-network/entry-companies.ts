import type { CompanyNetworkCompany, CompanyRelationship } from "./types";

export function buildEntryCompanies(
  companies: CompanyNetworkCompany[],
  relationships: CompanyRelationship[],
) {
  const outboundCompanyIds = new Set(relationships.map((relationship) => relationship.sourceCompanyId));
  const entries = companies.filter(
    (company) => company.listingStatus === "domestic_listed" || outboundCompanyIds.has(company.id),
  );

  return entries.length > 0 ? entries : companies;
}
