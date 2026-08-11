// lib/auth/reset-session.ts
// パスワードリセットのリンクからセッションを確立するロジック（Supabase 呼び出し部分だけを抽象化）。
// React / window に依存しない形にして、ユニットテストで交換失敗時のフォールバック挙動を検証できるようにする。
import type { ResetTokenParams } from "./password";

export type ResetSessionOutcome =
  | { kind: "ready" }
  | { kind: "no-token" }
  | { kind: "expired" }
  | { kind: "session-error"; message: string };

type AuthError = { message: string } | null;

/** ResetPasswordClient から渡す Supabase Auth クライアントの必要最小インターフェース。 */
export type ResetSessionAuthClient = {
  exchangeCodeForSession: (code: string) => Promise<{ error: AuthError }>;
  verifyOtp: (params: { token_hash: string; type: "recovery" }) => Promise<{ error: AuthError }>;
  setSession: (params: { access_token: string; refresh_token: string }) => Promise<{ error: AuthError }>;
  getSession: () => Promise<{ data: { session: unknown | null } }>;
};

/**
 * 交換 API（exchangeCodeForSession / verifyOtp / setSession）が失敗しても、即エラー扱いにしない。
 *
 * @supabase/ssr の createBrowserClient は detectSessionInUrl が既定で有効なため、
 * 呼び出し元コンポーネントの副作用が走るより先に SDK が同じトークンを消費してセッションを
 * 確立し、code verifier 等の使い捨て情報を削除していることがある。その状態で同じトークンを
 * 使って再度交換すると必ず失敗するが、セッション自体は既に確立済みで正常な状態。
 * 「交換失敗＝復旧不能」ではないため、失敗時は必ず getSession() で実際のセッション有無を
 * 確認してから最終的なエラー判定をする。
 */
async function finishWithSessionCheck(
  auth: ResetSessionAuthClient,
  exchangeError: AuthError,
): Promise<ResetSessionOutcome> {
  if (!exchangeError) return { kind: "ready" };
  const { data } = await auth.getSession();
  if (data.session) return { kind: "ready" };
  return /expired|invalid/i.test(exchangeError.message)
    ? { kind: "expired" }
    : { kind: "session-error", message: exchangeError.message };
}

/** URL から判定したトークン種別に応じて Supabase 側の交換 API を呼び、最終的な画面状態を返す。 */
export async function resolveResetSession(
  auth: ResetSessionAuthClient,
  parsed: ResetTokenParams,
): Promise<ResetSessionOutcome> {
  if (parsed.kind === "error") {
    if (parsed.errorCode === "otp_expired") return { kind: "expired" };
    return {
      kind: "session-error",
      message: parsed.errorDescription || "リンクが無効です。もう一度リセットを申請してください。",
    };
  }

  if (parsed.kind === "code") {
    const { error } = await auth.exchangeCodeForSession(parsed.code);
    return finishWithSessionCheck(auth, error);
  }

  if (parsed.kind === "token_hash") {
    const { error } = await auth.verifyOtp({ token_hash: parsed.tokenHash, type: parsed.type as "recovery" });
    return finishWithSessionCheck(auth, error);
  }

  if (parsed.kind === "access_token") {
    const { error } = await auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    return finishWithSessionCheck(auth, error);
  }

  // トークンが URL に無い場合、detectSessionInUrl が既にセッションを確立しているかもしれない
  // （@supabase/ssr のデフォルト挙動）ので、念のため既存セッションの有無を確認する。
  const { data } = await auth.getSession();
  return data.session ? { kind: "ready" } : { kind: "no-token" };
}
