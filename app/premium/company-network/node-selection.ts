import type {
  CompanyGroupMembership,
  CompanyNetworkNodeSelection,
  CompanyRelationship,
} from "./types";

export function groupGraphNodeId(groupId: string) {
  return `group:${groupId}`;
}

export function selectedGraphNodeId(selection: CompanyNetworkNodeSelection | null) {
  if (!selection) return null;
  return selection.kind === "group" ? groupGraphNodeId(selection.id) : selection.id;
}

export function buildSelectedNeighbourIds(
  selection: CompanyNetworkNodeSelection | null,
  relationships: CompanyRelationship[],
  memberships: CompanyGroupMembership[],
) {
  if (!selection) return null;

  if (selection.kind === "group") {
    const ids = new Set<string>([groupGraphNodeId(selection.id)]);
    for (const membership of memberships) {
      if (membership.groupId === selection.id) ids.add(membership.companyId);
    }
    return ids;
  }

  const ids = new Set<string>([selection.id]);
  for (const relationship of relationships) {
    if (relationship.sourceCompanyId === selection.id) ids.add(relationship.targetCompanyId);
    if (relationship.targetCompanyId === selection.id) ids.add(relationship.sourceCompanyId);
  }
  for (const membership of memberships) {
    if (membership.companyId === selection.id) ids.add(groupGraphNodeId(membership.groupId));
  }
  return ids;
}
