import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/supabase/config", () => ({
  getSupabaseEnv: () => ({ url: "https://fixture.invalid", anonKey: "fixture" }),
  isSyncConfigured: mocks.configured,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (...args: unknown[]) => void } }) => ({
    auth: { getUser: () => mocks.getUser(options.cookies.setAll) },
  }),
}));

const refreshHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

beforeEach(() => {
  mocks.configured.mockReturnValue(true);
  mocks.getUser.mockReset().mockResolvedValue(undefined);
});

it.each(["/tools/stock-notes/screening", "/tools/stock-notes/screening/"])(
  "marks %s private and no-store when there is no cookie rotation",
  async (path) => {
    const response = await proxy(new NextRequest("https://fixture.invalid" + path));
    expect(response.headers.get("Cache-Control")).toBe(refreshHeaders["Cache-Control"]);
  },
);

it("keeps the screen non-cacheable even when authentication is not configured", async () => {
  mocks.configured.mockReturnValue(false);
  const response = await proxy(new NextRequest("https://fixture.invalid/tools/stock-notes/screening"));
  expect(response.headers.get("Cache-Control")).toBe(refreshHeaders["Cache-Control"]);
  expect(mocks.getUser).not.toHaveBeenCalled();
});

it("forwards Supabase refresh headers and updated cookies for the existing account route", async () => {
  mocks.getUser.mockImplementationOnce((setAll) => setAll(
    [{ name: "fixture-auth", value: "refreshed", options: { path: "/" } }],
    refreshHeaders,
  ));
  const request = new NextRequest("https://fixture.invalid/account");
  const response = await proxy(request);
  expect(request.cookies.get("fixture-auth")?.value).toBe("refreshed");
  expect(response.cookies.get("fixture-auth")?.value).toBe("refreshed");
  for (const [name, value] of Object.entries(refreshHeaders)) expect(response.headers.get(name)).toBe(value);

  const withoutRotation = await proxy(new NextRequest("https://fixture.invalid/account"));
  expect(withoutRotation.headers.has("Cache-Control")).toBe(false);
});
