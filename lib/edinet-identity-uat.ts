/** One reviewed filing and its exact JPX candidate. This is not a resolver. */
export const EDINET_IDENTITY_UAT = {
  docId: "S100VWHX",
  sourceSecCode: "45430",
  matchedJpxCode: "4543",
  sourceDate: "2025-06-23",
} as const;

export const EDINET_IDENTITY_RPC = "stock_notes_edinet_financial_identity_rpc_snapshot_v1";

export function edinetIdentityUatUrl(baseUrl: string): string {
  const url = new URL(`/rest/v1/rpc/${EDINET_IDENTITY_RPC}`, baseUrl);
  url.searchParams.set("p_source_sec_code", EDINET_IDENTITY_UAT.sourceSecCode);
  url.searchParams.set("p_matched_jpx_code", EDINET_IDENTITY_UAT.matchedJpxCode);
  return url.toString();
}

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** UI pre-check only. The downloaded raw response must pass Stock Notes' full validator. */
export function inspectEdinetIdentityUatPacket(value: unknown, expectedUserId: string) {
  if (!record(value) || !record(value.execution_context)) return false;
  const context = value.execution_context;
  const rows = [value.reference_rows, value.link_rows, value.listing_rows];
  const counts = [value.reference_count, value.link_count, value.listing_count];
  if (!rows.every(Array.isArray) || !counts.every(Number.isInteger)) return false;
  const [references, links, listings] = rows as RecordValue[][];
  if (references.length !== 1 || links.length > 32 || listings.length > 32) return false;
  if (rows.some((group, index) => (group as unknown[]).length !== counts[index])) return false;
  if (rows.some((group) => (group as unknown[]).some((row) => !record(row) || row.user_id !== expectedUserId))) return false;
  return value.query_version === "edinet_financial_identity_rpc_snapshot_v1"
    && value.identity_time_scope === "current_observation_not_filing_date"
    && value.source_sec_code === EDINET_IDENTITY_UAT.sourceSecCode
    && value.matched_jpx_code === EDINET_IDENTITY_UAT.matchedJpxCode
    && value.user_id === expectedUserId
    && references[0].security_code === EDINET_IDENTITY_UAT.matchedJpxCode
    && context.current_user === "authenticated"
    && context.jwt_role === "authenticated"
    && context.auth_uid === expectedUserId
    && context.transaction_read_only === "on"
    && context.transaction_isolation === "repeatable read"
    && context.row_security === "on"
    && context.rolsuper === false
    && context.rolbypassrls === false;
}
