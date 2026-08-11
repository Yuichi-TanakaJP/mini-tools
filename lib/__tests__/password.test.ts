import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, parseResetTokensFromUrl, validateNewPassword } from "../auth/password";

describe("validateNewPassword", () => {
  it(`${MIN_PASSWORD_LENGTH}文字未満はエラーになる`, () => {
    const result = validateNewPassword("short1", "short1");
    expect(result.valid).toBe(false);
    expect(result.error).toContain(`${MIN_PASSWORD_LENGTH}文字以上`);
  });

  it("確認用パスワードが一致しないとエラーになる", () => {
    const result = validateNewPassword("password123", "password124");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("一致しません");
  });

  it(`${MIN_PASSWORD_LENGTH}文字以上かつ一致すれば valid`, () => {
    const result = validateNewPassword("password123", "password123");
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("ちょうど最小文字数は valid", () => {
    const exact = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(exact, exact).valid).toBe(true);
  });
});

describe("parseResetTokensFromUrl", () => {
  it("?code= を PKCE として判定する", () => {
    expect(parseResetTokensFromUrl("?code=abc123", "")).toEqual({ kind: "code", code: "abc123" });
  });

  it("?token_hash=...&type=recovery を OTP として判定する", () => {
    expect(parseResetTokensFromUrl("?token_hash=xyz&type=recovery", "")).toEqual({
      kind: "token_hash",
      tokenHash: "xyz",
      type: "recovery",
    });
  });

  it("token_hash だけで type が無ければ none として扱う", () => {
    expect(parseResetTokensFromUrl("?token_hash=xyz", "")).toEqual({ kind: "none" });
  });

  it("#access_token=...&refresh_token=... をハッシュフラグメントとして判定する", () => {
    expect(
      parseResetTokensFromUrl("", "#access_token=at1&refresh_token=rt1&type=recovery"),
    ).toEqual({ kind: "access_token", accessToken: "at1", refreshToken: "rt1" });
  });

  it("access_token だけで refresh_token が無ければ none として扱う", () => {
    expect(parseResetTokensFromUrl("", "#access_token=at1")).toEqual({ kind: "none" });
  });

  it("トークンが何も無ければ none", () => {
    expect(parseResetTokensFromUrl("", "")).toEqual({ kind: "none" });
    expect(parseResetTokensFromUrl("?foo=bar", "#baz=qux")).toEqual({ kind: "none" });
  });

  it("query の error を判定する（期限切れリンクなど）", () => {
    expect(
      parseResetTokensFromUrl(
        "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
        "",
      ),
    ).toEqual({
      kind: "error",
      errorCode: "otp_expired",
      errorDescription: "Email link is invalid or has expired",
    });
  });

  it("hash の error を判定する", () => {
    expect(
      parseResetTokensFromUrl("", "#error=access_denied&error_code=otp_expired&error_description=expired"),
    ).toEqual({ kind: "error", errorCode: "otp_expired", errorDescription: "expired" });
  });

  it("error が code より優先される", () => {
    expect(parseResetTokensFromUrl("?code=abc&error=access_denied", "")).toEqual({
      kind: "error",
      errorCode: undefined,
      errorDescription: undefined,
    });
  });

  it("先頭の ? / # が無くても解釈できる", () => {
    expect(parseResetTokensFromUrl("code=abc123", "")).toEqual({ kind: "code", code: "abc123" });
  });
});
