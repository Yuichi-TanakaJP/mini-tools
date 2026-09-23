import { describe, expect, it } from "vitest";
import { edinetIdentityUatUrl, inspectEdinetIdentityUatPacket } from "../edinet-identity-uat";

const owner = "owner-1";
const packet = {
  query_version: "edinet_financial_identity_rpc_snapshot_v1",
  identity_time_scope: "current_observation_not_filing_date",
  source_sec_code: "45430",
  matched_jpx_code: "4543",
  user_id: owner,
  reference_count: 1,
  link_count: 0,
  listing_count: 0,
  reference_rows: [{ user_id: owner, security_code: "4543" }],
  link_rows: [],
  listing_rows: [],
  execution_context: {
    current_user: "authenticated",
    jwt_role: "authenticated",
    auth_uid: owner,
    transaction_read_only: "on",
    transaction_isolation: "repeatable read",
    row_security: "on",
    rolsuper: false,
    rolbypassrls: false,
  },
};

describe("EDINET identity UAT boundary", () => {
  it("uses only the fixed GET RPC candidate", () => {
    const url = new URL(edinetIdentityUatUrl("https://example.supabase.co"));
    expect(url.pathname).toBe("/rest/v1/rpc/stock_notes_edinet_financial_identity_rpc_snapshot_v1");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      p_source_sec_code: "45430",
      p_matched_jpx_code: "4543",
    });
  });

  it("prechecks owner and non-privileged read-only context", () => {
    expect(inspectEdinetIdentityUatPacket(packet, owner)).toBe(true);
    expect(inspectEdinetIdentityUatPacket(packet, "someone-else")).toBe(false);
    expect(inspectEdinetIdentityUatPacket({ ...packet, execution_context: { ...packet.execution_context, rolbypassrls: true } }, owner)).toBe(false);
    expect(inspectEdinetIdentityUatPacket({ ...packet, link_count: 1 }, owner)).toBe(false);
    expect(inspectEdinetIdentityUatPacket({ ...packet, source_sec_code: "99990" }, owner)).toBe(false);
  });
});
