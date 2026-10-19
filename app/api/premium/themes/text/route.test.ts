import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { loadThemeText } from "@/app/premium/themes/data-loader";
import { verifyPremiumSession } from "@/lib/premium-auth";
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => ({ value: "synthetic" }) })) }));
vi.mock("@/lib/premium-auth", () => ({ PREMIUM_COOKIE_NAME: "premium", verifyPremiumSession: vi.fn(() => true) }));
vi.mock("@/app/premium/themes/data-loader", () => ({ loadThemeText: vi.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
const url = `http://localhost/api/premium/themes/text?themeId=${id}&section=analysisHistory&recordId=${id}&field=body&offset=0`;
afterEach(() => { vi.clearAllMocks(); vi.mocked(verifyPremiumSession).mockReturnValue(true); });
describe("premium text read proxy", () => {
  it("rejects anonymous reads before touching upstream", async () => {
    vi.mocked(verifyPremiumSession).mockReturnValue(false);
    expect((await GET(new Request(url))).status).toBe(401); expect(loadThemeText).not.toHaveBeenCalled();
  });
  it.each(["&offset=2", "&revision=x", "&unknown=1", "&field=user_id"])("rejects ambiguous/unknown input %s", async suffix => {
    expect((await GET(new Request(url + suffix))).status).toBe(400); expect(loadThemeText).not.toHaveBeenCalled();
  });
  it("returns private no-store and only validated data", async () => {
    vi.mocked(loadThemeText).mockResolvedValue({ status: "ok", data: { text: "test" } as never });
    const response = await GET(new Request(url)); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(await response.json()).toEqual({ text: "test" });
  });
  it("keeps revision conflict actionable", async () => {
    vi.mocked(loadThemeText).mockResolvedValue({ status: "upstream_error", message: "更新", httpStatus: 409 });
    expect((await GET(new Request(url))).status).toBe(409);
  });
});
