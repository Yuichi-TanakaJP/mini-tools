import { describe, expect, it } from "vitest";
import cacheRule from "../uncached-api-request.js";

const { isSensitiveApiGet } = cacheRule;

describe("PWA authenticated API cache boundary", () => {
  it("routes bearer and apikey GETs to NetworkOnly", () => {
    expect(isSensitiveApiGet({ request: new Request("https://example.supabase.co/rest/v1/rpc/test", {
      headers: { Authorization: "Bearer synthetic-test-token" },
    }), url: new URL("https://example.supabase.co/rest/v1/rpc/test") })).toBe(true);
    expect(isSensitiveApiGet({ request: new Request("https://example.supabase.co/auth/v1/user", {
      headers: { apikey: "synthetic-publishable-key" },
    }), url: new URL("https://example.supabase.co/auth/v1/user") })).toBe(true);
  });

  it("keeps the public Workspace Core read route NetworkOnly", () => {
    const request = new Request("https://mini-tools.example/api/premium/workspace-core?mode=control-center-v2");
    expect(
      isSensitiveApiGet({
        request,
        url: new URL(request.url),
      }),
    ).toBe(true);
  });

  it("leaves unrelated public GETs and non-GETs to existing rules", () => {
    const publicRequest = new Request("https://images.example.org/public.png");
    expect(
      isSensitiveApiGet({
        request: publicRequest,
        url: new URL(publicRequest.url),
      }),
    ).toBe(false);

    const postRequest = new Request("https://example.supabase.co/rest/v1/rpc/test", {
      method: "POST",
      headers: { Authorization: "Bearer synthetic-test-token" },
    });
    expect(
      isSensitiveApiGet({
        request: postRequest,
        url: new URL(postRequest.url),
      }),
    ).toBe(false);
  });
});


it("never caches private theme text reads authenticated by Cookie", () => {
  expect(isSensitiveApiGet({ request: new Request("https://example.com/api/premium/themes/text?offset=0"), url: new URL("https://example.com/api/premium/themes/text?offset=0") })).toBe(true);
});


it.each(["/api/premium/themes/text/", "/api/premium/themes/text///"])("never caches redirect variants of private theme text: %s", (pathname) => {
  const href = `https://example.com${pathname}?offset=0`;
  expect(isSensitiveApiGet({ request: new Request(href), url: new URL(href) })).toBe(true);
});
