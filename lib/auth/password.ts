// lib/auth/password.ts
// パスワードリセット・変更まわりの純粋関数。
// - 新しいパスワードのバリデーション
// - リセットメールのリンク形式（PKCE / OTP / ハッシュフラグメント / エラー）の判定
// fs や window に依存しないため、Server / Client 双方・テストから利用できる。

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordValidationResult = { valid: boolean; error: string | null };

/** 新しいパスワードのバリデーション（8文字以上・確認用と一致）。 */
export function validateNewPassword(
  password: string,
  confirmPassword: string,
): PasswordValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。` };
  }
  if (password !== confirmPassword) {
    return { valid: false, error: "確認用パスワードが一致しません。" };
  }
  return { valid: true, error: null };
}

export type ResetTokenParams =
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string; type: string }
  | { kind: "access_token"; accessToken: string; refreshToken: string }
  | { kind: "error"; errorCode?: string; errorDescription?: string }
  | { kind: "none" };

function toParams(raw: string, prefix: "?" | "#"): URLSearchParams {
  const stripped = raw.startsWith(prefix) ? raw.slice(1) : raw;
  return new URLSearchParams(stripped);
}

function extractError(params: URLSearchParams): { errorCode?: string; errorDescription?: string } | null {
  const error = params.get("error");
  if (!error) return null;
  return {
    errorCode: params.get("error_code") ?? undefined,
    errorDescription: params.get("error_description") ?? undefined,
  };
}

/**
 * リセットメールのリンクからアクセスした URL の `search`（`?...`）と `hash`（`#...`）を渡すと、
 * Supabase が発行しうる 3 種類のリンク形式のどれに該当するかを判定する。
 * - PKCE: `?code=...`
 * - OTP: `?token_hash=...&type=recovery`
 * - 暗黙フロー: `#access_token=...&refresh_token=...&type=recovery`
 * リンクが無効・期限切れの場合、Supabase は `error` / `error_code` / `error_description` を
 * query または hash に付けてリダイレクトすることがあるため、それも判定する。
 */
export function parseResetTokensFromUrl(search: string, hash: string): ResetTokenParams {
  const searchParams = toParams(search ?? "", "?");
  const hashParams = toParams(hash ?? "", "#");

  const searchError = extractError(searchParams);
  if (searchError) return { kind: "error", ...searchError };
  const hashError = extractError(hashParams);
  if (hashError) return { kind: "error", ...hashError };

  const code = searchParams.get("code");
  if (code) return { kind: "code", code };

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (tokenHash && type) return { kind: "token_hash", tokenHash, type };

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "access_token", accessToken, refreshToken };

  return { kind: "none" };
}
