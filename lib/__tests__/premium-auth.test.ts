import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PREMIUM_SESSION_MAX_AGE_SECONDS,
  createPremiumSessionValue,
  verifyPremiumSession,
} from "../premium-auth";

describe("premium session", () => {
  beforeEach(() => {
    process.env.PREMIUM_ACCESS_SECRET = "test-premium-secret";
  });

  afterEach(() => {
    delete process.env.PREMIUM_ACCESS_SECRET;
    vi.restoreAllMocks();
  });

  it("有効期間をログインから30日間にする", () => {
    expect(PREMIUM_SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30);
  });

  it("30日以内の署名済みセッションを受け入れ、期限超過後は拒否する", () => {
    const issuedAt = Date.UTC(2026, 6, 19, 0, 0, 0);
    const now = vi.spyOn(Date, "now").mockReturnValue(issuedAt);
    const session = createPremiumSessionValue();

    now.mockReturnValue(issuedAt + PREMIUM_SESSION_MAX_AGE_SECONDS * 1000);
    expect(verifyPremiumSession(session)).toBe(true);

    now.mockReturnValue(issuedAt + PREMIUM_SESSION_MAX_AGE_SECONDS * 1000 + 1);
    expect(verifyPremiumSession(session)).toBe(false);
  });
});
