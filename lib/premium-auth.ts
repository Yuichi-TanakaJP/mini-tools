import { createHmac, timingSafeEqual } from "node:crypto";

export const PREMIUM_COOKIE_NAME = "mini_tools_premium";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function isPremiumAuthConfigured() {
  return Boolean(
    process.env.PREMIUM_ACCESS_PASSWORD && process.env.PREMIUM_ACCESS_SECRET
  );
}

export function verifyPremiumPassword(input: string) {
  const expected = process.env.PREMIUM_ACCESS_PASSWORD ?? "";
  if (!expected) return false;
  return safeEqual(input, expected);
}

export function createPremiumSessionValue() {
  const secret = process.env.PREMIUM_ACCESS_SECRET ?? "";
  if (!secret) return "";

  return createHmac("sha256", secret)
    .update("mini-tools-premium-session")
    .digest("hex");
}

export function verifyPremiumSession(value: string | undefined) {
  if (!value) return false;
  const expected = createPremiumSessionValue();
  if (!expected) return false;
  return safeEqual(value, expected);
}
