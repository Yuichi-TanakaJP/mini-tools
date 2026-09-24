import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  canRunEdinetIdentityUat,
  edinetIdentityUatUrl,
  inspectEdinetIdentityUatPacket,
  readEdinetIdentityUatResponse,
} from "../edinet-identity-uat";

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

  it("rejects preview and alternate hosts before any authenticated request", () => {
    const supabase = "https://uqnkjitvuebwhjvmaddb.supabase.co";
    expect(canRunEdinetIdentityUat("https://mini-tools-rho.vercel.app", "production", supabase)).toBe(true);
    expect(canRunEdinetIdentityUat("https://mini-tools-rho.vercel.app", "blocked", supabase)).toBe(false);
    expect(canRunEdinetIdentityUat("https://mini-tools-git-branch.vercel.app", "production", supabase)).toBe(false);
    expect(canRunEdinetIdentityUat("http://localhost:3000", "production", supabase)).toBe(false);
    expect(canRunEdinetIdentityUat("https://mini-tools-rho.vercel.app", "production", "https://other.supabase.co")).toBe(false);
  });

  it("hashes and retains exact response bytes only for HTTP 200", async () => {
    const raw = new TextEncoder().encode(JSON.stringify(packet));
    const expectedDigest = createHash("sha256").update(raw).digest("hex");
    const good = await readEdinetIdentityUatResponse(new Response(raw, { status: 200 }), owner);
    expect(good.responseSha256).toBe(expectedDigest);
    expect(good.packetPrecheck).toBe(true);
    expect(new Uint8Array(good.rawResponse!)).toEqual(raw);

    const failed = await readEdinetIdentityUatResponse(new Response(raw, { status: 403 }), owner);
    expect(failed.responseSha256).toBe(expectedDigest);
    expect(failed.packetPrecheck).toBe(false);
    expect(failed.rawResponse).toBeNull();
  });

  it("does not pass malformed 200 response, but retains its exact bytes", async () => {
    const raw = new Uint8Array([0xff, 0xfe]);
    const result = await readEdinetIdentityUatResponse(new Response(raw, { status: 200 }), owner);
    expect(result.packetPrecheck).toBe(false);
    expect(new Uint8Array(result.rawResponse!)).toEqual(raw);
    expect(result.responseSha256).toBe(createHash("sha256").update(raw).digest("hex"));
  });
});
