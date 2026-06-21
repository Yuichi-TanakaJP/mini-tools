// lib/supabase/middleware.ts
// Supabase セッション Cookie をリフレッシュする（@supabase/ssr の定番パターン）。
// middleware.ts から呼ぶ。env 未設定なら何もしない。
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // セッションの有効期限が近ければここでリフレッシュされ、Cookie が更新される。
  await supabase.auth.getUser();

  return response;
}
