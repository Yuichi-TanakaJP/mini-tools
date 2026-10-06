import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  premium: vi.fn(),
  proxyAuth: vi.fn(),
  configured: vi.fn(),
  serverClient: vi.fn(),
  controlCenterV1: vi.fn(),
  controlCenterV2: vi.fn(),
  overview: vi.fn(),
  product: vi.fn(),
  provider: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/premium-auth", () => ({
  PREMIUM_COOKIE_NAME: "premium",
  verifyPremiumSession: mocks.premium,
}));

vi.mock("@/lib/workspace-core/read-proxy-auth", () => ({
  verifyWorkspaceCoreReadProxyToken: mocks.proxyAuth,
}));

vi.mock("@/lib/workspace-core/config", () => ({
  isWorkspaceCoreConfigured: mocks.configured,
}));

vi.mock("@/lib/workspace-core/server", () => ({
  createWorkspaceCoreServerClient: mocks.serverClient,
}));

vi.mock("@/lib/workspace-core/data", () => ({
  loadWorkspaceCoreControlCenter: mocks.controlCenterV1,
  loadWorkspaceCoreControlCenterV2: mocks.controlCenterV2,
  loadWorkspaceCoreOverview: mocks.overview,
  loadWorkspaceCoreProductDetail: mocks.product,
  loadWorkspaceCoreProviderImpact: mocks.provider,
}));

import { GET } from "./route";

const V2_PAYLOAD = {
  status: "ok",
  contract: "workspace-core.control-center-summary",
  version: "2.0",
  generatedAt: "2026-10-06T00:00:00.000Z",
  data: {
    work: {},
    operations: {},
    evolution: {},
    architecture: {},
  },
};

function request(query: string, authorization?: string) {
  return new Request(
    `https://mini-tools.example/api/premium/workspace-core?${query}`,
    {
      headers: authorization ? { authorization } : undefined,
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({
    get: () => undefined,
  });
  mocks.premium.mockReturnValue(false);
  mocks.proxyAuth.mockReturnValue(false);
  mocks.configured.mockReturnValue(true);
  mocks.serverClient.mockReturnValue({ kind: "server-client" });
  mocks.controlCenterV2.mockResolvedValue(V2_PAYLOAD);
  mocks.controlCenterV1.mockResolvedValue({});
  mocks.overview.mockResolvedValue({});
  mocks.product.mockResolvedValue(null);
  mocks.provider.mockResolvedValue({});
});

describe("Workspace Core read endpoint authentication boundary", () => {
  it("allows anonymous GET for the fixed control-center-v2 read contract", async () => {
    const response = await GET(request("mode=control-center-v2"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(V2_PAYLOAD);
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.premium).not.toHaveBeenCalled();
    expect(mocks.controlCenterV2).toHaveBeenCalledTimes(1);
  });

  it("keeps V1 control-center protected", async () => {
    const response = await GET(request("mode=control-center"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      status: "unauthenticated",
      data: null,
    });
    expect(mocks.controlCenterV1).not.toHaveBeenCalled();
  });

  it("keeps overview protected", async () => {
    const response = await GET(request("mode=overview"));

    expect(response.status).toBe(401);
    expect(mocks.overview).not.toHaveBeenCalled();
  });

  it("keeps product/provider reads protected", async () => {
    const productResponse = await GET(request("mode=product&slug=mini-tools"));
    const providerResponse = await GET(request("mode=provider&slug=vercel"));

    expect(productResponse.status).toBe(401);
    expect(providerResponse.status).toBe(401);
    expect(mocks.product).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("still validates the public V2 fixed input boundary", async () => {
    const response = await GET(
      request("mode=control-center-v2&slug=mini-tools"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      status: "error",
      contract: "workspace-core.control-center-summary",
      version: "2.0",
      data: null,
      error: { code: "INVALID_REQUEST" },
    });
    expect(mocks.controlCenterV2).not.toHaveBeenCalled();
  });
});
