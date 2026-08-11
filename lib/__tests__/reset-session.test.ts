import { describe, expect, it, vi } from "vitest";
import { resolveResetSession, type ResetSessionAuthClient } from "../auth/reset-session";
import type { ResetTokenParams } from "../auth/password";

function makeAuth(overrides: Partial<ResetSessionAuthClient> = {}): ResetSessionAuthClient {
  return {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    setSession: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    ...overrides,
  };
}

describe("resolveResetSession", () => {
  it("code の交換に成功したら ready", async () => {
    const auth = makeAuth({ exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }) });
    const parsed: ResetTokenParams = { kind: "code", code: "abc" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "ready" });
  });

  // 本丸: @supabase/ssr の detectSessionInUrl が先に code を消費していると、
  // このコンポーネントが後から同じ code を交換しようとして失敗する。
  // その場合でも getSession() に有効なセッションがあれば、リンクは無効ではなく
  // 復旧可能な状態として扱わなければならない。
  it("exchangeCodeForSession が失敗しても getSession にセッションがあれば ready にする", async () => {
    const auth = makeAuth({
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "invalid request" } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
    });
    const parsed: ResetTokenParams = { kind: "code", code: "abc" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "ready" });
  });

  it("exchangeCodeForSession が失敗し getSession にもセッションが無ければエラーにする", async () => {
    const auth = makeAuth({
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "unexpected failure" } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    });
    const parsed: ResetTokenParams = { kind: "code", code: "abc" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({
      kind: "session-error",
      message: "unexpected failure",
    });
  });

  it("exchangeCodeForSession の失敗メッセージに expired/invalid を含み、セッションも無ければ expired にする", async () => {
    const auth = makeAuth({
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "Token has expired" } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    });
    const parsed: ResetTokenParams = { kind: "code", code: "abc" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "expired" });
  });

  it("verifyOtp が失敗しても getSession にセッションがあれば ready にする", async () => {
    const auth = makeAuth({
      verifyOtp: vi.fn().mockResolvedValue({ error: { message: "invalid token_hash" } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
    });
    const parsed: ResetTokenParams = { kind: "token_hash", tokenHash: "xyz", type: "recovery" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "ready" });
  });

  it("verifyOtp が成功したら ready", async () => {
    const auth = makeAuth();
    const parsed: ResetTokenParams = { kind: "token_hash", tokenHash: "xyz", type: "recovery" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "ready" });
  });

  it("setSession が失敗しても getSession にセッションがあれば ready にする", async () => {
    const auth = makeAuth({
      setSession: vi.fn().mockResolvedValue({ error: { message: "invalid session" } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
    });
    const parsed: ResetTokenParams = { kind: "access_token", accessToken: "at1", refreshToken: "rt1" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "ready" });
  });

  it("setSession が成功したら ready", async () => {
    const auth = makeAuth();
    const parsed: ResetTokenParams = { kind: "access_token", accessToken: "at1", refreshToken: "rt1" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "ready" });
  });

  it("error(otp_expired) は expired にする", async () => {
    const auth = makeAuth();
    const parsed: ResetTokenParams = { kind: "error", errorCode: "otp_expired", errorDescription: "expired" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "expired" });
  });

  it("error(otp_expired 以外) は session-error にし、説明文をそのまま使う", async () => {
    const auth = makeAuth();
    const parsed: ResetTokenParams = { kind: "error", errorCode: "access_denied", errorDescription: "denied" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({
      kind: "session-error",
      message: "denied",
    });
  });

  it("error で errorDescription が無ければ既定の文言にする", async () => {
    const auth = makeAuth();
    const parsed: ResetTokenParams = { kind: "error" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({
      kind: "session-error",
      message: "リンクが無効です。もう一度リセットを申請してください。",
    });
  });

  it("none で getSession にセッションがあれば ready（detectSessionInUrl が既に処理済みのケース）", async () => {
    const auth = makeAuth({ getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }) });
    const parsed: ResetTokenParams = { kind: "none" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "ready" });
  });

  it("none で getSession にもセッションが無ければ no-token", async () => {
    const auth = makeAuth();
    const parsed: ResetTokenParams = { kind: "none" };
    await expect(resolveResetSession(auth, parsed)).resolves.toEqual({ kind: "no-token" });
  });
});
