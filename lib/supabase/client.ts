// lib/supabase/client.ts
// ブラウザ用 Supabase クライアント（anon キー）。Client Component から使う。
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./config";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error("Supabase env が未設定です（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）。");
  }
  return createBrowserClient(url, anonKey);
}
