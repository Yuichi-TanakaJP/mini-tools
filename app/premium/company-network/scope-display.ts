import type { CompanyNetworkData, CompanyNetworkScopeMode, RelationCategory } from "./types";

export type ScopeContext = {
  mode: CompanyNetworkScopeMode; groupId: string; centerId: string; baseId: string;
  hops: 1 | 2; verifiedOnly: boolean; categories: RelationCategory[]; showGroups: boolean;
};
export type ScopeSnapshot = { key: string; data: CompanyNetworkData; context: ScopeContext };
/** A stale dataset must retain its own labels/IDs, never those of the requested scope. */
export function selectScopeDisplay(snapshot: ScopeSnapshot | null, key: string, requested: ScopeContext) {
  const previous = snapshot !== null && snapshot.key !== key;
  return { data: snapshot?.data ?? null, context: previous ? snapshot.context : requested,
    previous, current: snapshot?.key === key ? snapshot.data : null };
}

/** Save a local focus change while its scope is still current, before the next request key. */
export function withScopeFocus(snapshot: ScopeSnapshot | null, key: string, baseId: string): ScopeSnapshot | null {
  if (!snapshot || snapshot.key !== key || snapshot.context.baseId === baseId) return snapshot;
  return { ...snapshot, context: { ...snapshot.context, baseId } };
}
