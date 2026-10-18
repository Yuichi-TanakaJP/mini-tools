import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cookies: vi.fn(), verify: vi.fn(), load: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/premium-auth", () => ({ PREMIUM_COOKIE_NAME: "premium", verifyPremiumSession: mocks.verify }));
vi.mock("./data-loader", () => ({ loadThemeListPage: mocks.load }));
import PremiumThemesPage from "./page";

afterEach(() => vi.resetAllMocks());
describe("theme list server page", () => {
  it("checks premium auth before fetching any cursor page", async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined });
    mocks.verify.mockReturnValue(false);
    mocks.redirect.mockImplementation(() => { throw new Error("redirected"); });
    await expect(PremiumThemesPage({ searchParams: Promise.resolve({ cursor: "next_cursor" }) })).rejects.toThrow("redirected");
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("forwards cursor only to the server loader after authentication", async () => {
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session" }) });
    mocks.verify.mockReturnValue(true);
    mocks.load.mockResolvedValue({ status: "empty", data: { themes: [] } });
    const element = await PremiumThemesPage({ searchParams: Promise.resolve({ cursor: "next_cursor" }) });
    expect(mocks.load).toHaveBeenCalledWith("next_cursor");
    expect(element.props.isContinuation).toBe(true);
  });
});
