import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadScreening, PAGE_SIZE, screenHref, screeningFilters } from "./data";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({ isSyncConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));

const now = new Date("2026-11-21T12:00:00.000Z");
const row = {
  jpx_code: "1301",
  edinet_doc_id: "S100ABCD",
  period_end: "2026-03-31",
  source_as_of: "2026-06-15T00:00:00+00:00",
  fcf_jpy_million: "-10.125001",
  disclosed_debt_jpy_million: "0",
  debt_basis: "explicitly_not_applicable",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [row], error: null });
});

describe("EDINET screening navigation and access", () => {
  it("does not invoke the RPC for an unauthenticated request", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await loadScreening({}, now)).toEqual({ state: "unauthorized" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps an authentication outage separate from an expired session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
    expect(await loadScreening({}, now)).toMatchObject({ state: "failed" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({
      data: { user: null }, error: { name: "AuthSessionMissingError", status: 400 },
    });
    expect(await loadScreening({}, now)).toEqual({ state: "unauthorized" });
  });

  it.each([
    { minFcf: "9999999999" }, { minFcf: "1.1234567" }, { minFcf: "1e5" },
    { minFcf: ["1", "2"] }, { maxDebt: "-1" }, { after: "1301" },
    { after: "1301)", asOf: now.toISOString() }, { asOf: "2026-12-01T00:00:00.000Z" },
  ])("rejects unbounded or ambiguous input %o", async (query) => {
    expect(await loadScreening(query, now)).toMatchObject({ state: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("binds exact signed values, freezes the cutoff across cursor pages and distinguishes an explicit zero", async () => {
    const query = { minFcf: "-50.123456", maxDebt: "0", after: "1300", asOf: "2026-11-21T11:00:00.000Z" };
    expect(await loadScreening(query, now)).toMatchObject({
      state: "ready", rows: [{ fcf_jpy_million: -10.125001, disclosed_debt_jpy_million: 0, debt_basis: "explicitly_not_applicable" }],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("stock_notes_screen_edinet_fcf_debt_v1", {
      p_as_of: query.asOf,
      p_min_fcf_million: query.minFcf,
      p_max_debt_million: query.maxDebt,
      p_after_code: query.after,
      p_limit: PAGE_SIZE + 1,
    });
    const parsed = screeningFilters(query, now);
    const href = new URL(screenHref(parsed.filters, "1301"), "https://example.test");
    expect(Object.fromEntries(href.searchParams)).toEqual({ ...query, after: "1301" });
    expect(new URL(screenHref(parsed.filters, ""), href).searchParams.has("after")).toBe(false);
  });

  it("uses the last displayed row for page N+1 and does not expose the look-ahead row", async () => {
    mocks.rpc.mockResolvedValue({
      data: Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({ ...row, jpx_code: String(1301 + i) })),
      error: null,
    });
    const result = await loadScreening({}, now);
    expect(result).toMatchObject({ state: "ready", next: "1350" });
    if (result.state !== "ready") throw new Error("expected a ready page");
    expect(result.rows).toHaveLength(PAGE_SIZE);
    expect(result.rows.at(-1)?.jpx_code).toBe("1350");
    expect(mocks.rpc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ p_limit: 51 }));
  });

  it("distinguishes an empty result from an RPC failure", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadScreening({}, now)).toMatchObject({ state: "ready", rows: [], next: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database error" } });
    expect(await loadScreening({}, now)).toMatchObject({ state: "failed" });
  });

  it.each([
    ["balance_sheet", "0", "ready"],
    ["balance_sheet", "25", "ready"],
    ["verified", "0", "failed"],
    ["verified", "25", "ready"],
    ["explicitly_not_applicable", "0", "ready"],
    ["explicitly_not_applicable", "25", "failed"],
  ])("validates %s debt of %s against the database contract", async (debt_basis, disclosed_debt_jpy_million, state) => {
    mocks.rpc.mockResolvedValue({ data: [{ ...row, debt_basis, disclosed_debt_jpy_million }], error: null });
    const result = await loadScreening({}, now);
    expect(result.state).toBe(state);
    if (result.state === "ready") {
      expect(result.rows).toMatchObject([{ debt_basis, disclosed_debt_jpy_million: Number(disclosed_debt_jpy_million) }]);
    }
  });
});
