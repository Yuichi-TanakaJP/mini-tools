import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const PREMIUM_COOKIE_NAME = "mini_tools_premium";
export const PREMIUM_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

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

function signPremiumSessionPayload(payload: string) {
  const secret = process.env.PREMIUM_ACCESS_SECRET ?? "";
  if (!secret) return "";

  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createPremiumSessionValue() {
  const issuedAt = Date.now().toString();
  const nonce = randomUUID();
  const payload = `${issuedAt}.${nonce}`;
  const signature = signPremiumSessionPayload(payload);
  if (!signature) return "";

  return `${payload}.${signature}`;
}

export function verifyPremiumSession(value: string | undefined) {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [issuedAtRaw, nonce, signature] = parts;
  if (!issuedAtRaw || !nonce || !signature) return false;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;

  const ageMs = Date.now() - issuedAt;
  if (ageMs < 0 || ageMs > PREMIUM_SESSION_MAX_AGE_SECONDS * 1000) {
    return false;
  }

  const expectedSignature = signPremiumSessionPayload(`${issuedAtRaw}.${nonce}`);
  if (!expectedSignature) return false;
  return safeEqual(signature, expectedSignature);
}
