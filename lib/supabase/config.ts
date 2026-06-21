// lib/supabase/config.ts
// Supabase の公開 env を読む。未設定なら同期機能を無効（503）にするための判定に使う。

export function getSupabaseEnv() {
  // 末尾スラッシュや空白が混ざると認証リクエストのパスが壊れ "invalid path" になるため正規化する。
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "").replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  return { url, anonKey };
}

/** クロスデバイス同期（Supabase）が設定済みか。未設定なら同期は無効。 */
export function isSyncConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}
