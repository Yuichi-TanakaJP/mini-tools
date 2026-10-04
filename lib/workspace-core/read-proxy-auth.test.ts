import { afterEach, describe, expect, it } from "vitest";
import {
  isWorkspaceCoreReadProxyConfigured,
  parseBearerToken,
  verifyWorkspaceCoreReadProxyToken,
} from "./read-proxy-auth";

const ENV = "WORKSPACE_CORE_READ_PROXY_TOKEN";
const TOKEN = "test-token-0123456789-abcdefghijklmnopqrstuvwxyz";

afterEach(() => {
  delete process.env[ENV];
});

describe("read proxy auth", () => {
  it("parses a bearer token", () => {
    expect(parseBearerToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(parseBearerToken(`bearer ${TOKEN}`)).toBe(TOKEN);
  });

  it("rejects malformed authorization headers", () => {
    expect(parseBearerToken(null)).toBe("");
    expect(parseBearerToken("")).toBe("");
    expect(parseBearerToken(TOKEN)).toBe("");
    expect(parseBearerToken("Basic abc")).toBe("");
    expect(parseBearerToken("Bearer a b")).toBe("");
  });

  it("requires a sufficiently long configured token", () => {
    process.env[ENV] = "short";
    expect(isWorkspaceCoreReadProxyConfigured()).toBe(false);
    expect(verifyWorkspaceCoreReadProxyToken("Bearer short")).toBe(false);

    process.env[ENV] = TOKEN;
    expect(isWorkspaceCoreReadProxyConfigured()).toBe(true);
  });

  it("accepts only the configured token", () => {
    process.env[ENV] = TOKEN;
    expect(verifyWorkspaceCoreReadProxyToken(`Bearer ${TOKEN}`)).toBe(true);
    expect(
      verifyWorkspaceCoreReadProxyToken(
        "Bearer test-token-0123456789-abcdefghijklmnopqrstuvwxyzX",
      ),
    ).toBe(false);
  });
});
