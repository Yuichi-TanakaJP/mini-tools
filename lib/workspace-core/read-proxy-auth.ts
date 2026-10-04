import { timingSafeEqual } from "node:crypto";

const TOKEN_ENV_NAME = "WORKSPACE_CORE_READ_PROXY_TOKEN";
const MIN_TOKEN_LENGTH = 32;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseBearerToken(value: string | null) {
  if (!value) return "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? "";
}

export function isWorkspaceCoreReadProxyConfigured() {
  const expected = process.env[TOKEN_ENV_NAME]?.trim() ?? "";
  return expected.length >= MIN_TOKEN_LENGTH;
}

export function verifyWorkspaceCoreReadProxyToken(value: string | null) {
  const expected = process.env[TOKEN_ENV_NAME]?.trim() ?? "";
  const actual = parseBearerToken(value);

  if (expected.length < MIN_TOKEN_LENGTH || !actual) return false;
  return safeEqual(actual, expected);
}
