import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), getUser: vi.fn(), premium: vi.fn(), holdings: vi.fn(), watch: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ isSyncConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("@/lib/premium-auth", () => ({ PREMIUM_COOKIE_NAME: "premium", verifyPremiumSession: mocks.premium }));
vi.mock("@/lib/portfolio/holdings", async (original) => ({ ...await original<typeof import("@/lib/portfolio/holdings")>(), loadHoldings: mocks.holdings, loadWatchCodes: mocks.watch }));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  mocks.premium.mockReturnValue(true);
  mocks.holdings.mockResolvedValue({ state: "ready", snapshotId: "s", updatedAt: "2026-09-04", holdings: [] });
  mocks.watch.mockResolvedValue(["7203"]);
});
describe("audience authorization and partial failure", () => {
  it("rejects anonymous sessions before reading either source", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.holdings).not.toHaveBeenCalled(); expect(mocks.watch).not.toHaveBeenCalled();
  });
  it("keeps watch usable without granting Premium holdings", async () => {
    mocks.premium.mockReturnValue(false);
    const response = await GET();
    expect(await response.json()).toMatchObject({ holdings: { state: "premium_required", holdings: [] }, watch: { state: "ready", codes: ["7203"] } });
    expect(mocks.holdings).not.toHaveBeenCalled();
    expect(mocks.watch).toHaveBeenCalledWith(expect.anything(), "u");
  });
  it("separates holdings failures from watch results", async () => {
    mocks.holdings.mockRejectedValue(new Error("failure"));
    expect(await (await GET()).json()).toMatchObject({ holdings: { state: "unavailable" }, watch: { state: "ready" } });
  });
  it("separates watch failures from holdings results", async () => {
    mocks.watch.mockRejectedValue(new Error("failure"));
    expect(await (await GET()).json()).toMatchObject({ holdings: { state: "ready" }, watch: { state: "unavailable", codes: [] } });
  });
  it("reports unavailable configuration", async () => {
    mocks.configured.mockReturnValue(false);
    expect((await GET()).status).toBe(503);
  });
});
