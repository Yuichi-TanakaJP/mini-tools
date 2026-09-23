import { describe, expect, it } from "vitest";
import cacheRule from "../uncached-api-request.js";

const { isSensitiveApiGet } = cacheRule;

describe("PWA authenticated API cache boundary", () => {
  it("routes bearer and apikey GETs to NetworkOnly", () => {
    expect(isSensitiveApiGet({ request: new Request("https://example.supabase.co/rest/v1/rpc/test", {
      headers: { Authorization: "Bearer synthetic-test-token" },
    }) })).toBe(true);
    expect(isSensitiveApiGet({ request: new Request("https://example.supabase.co/auth/v1/user", {
      headers: { apikey: "synthetic-publishable-key" },
    }) })).toBe(true);
  });

  it("leaves public GETs and non-GETs to existing rules", () => {
    expect(isSensitiveApiGet({ request: new Request("https://images.example.org/public.png") })).toBe(false);
    expect(isSensitiveApiGet({ request: new Request("https://example.supabase.co/rest/v1/rpc/test", {
      method: "POST", headers: { Authorization: "Bearer synthetic-test-token" },
    }) })).toBe(false);
  });
});
