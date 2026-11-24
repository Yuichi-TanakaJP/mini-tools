import { NextResponse, type NextRequest } from "next/server";
import { isSyncConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 の proxy 規約（旧 middleware）。
// 同期に関わるパスだけ Supabase セッションをリフレッシュする。
// 未設定なら何もしない（既存挙動に影響なし）。
export async function proxy(request: NextRequest) {
  const response = isSyncConfigured() ? await updateSession(request) : NextResponse.next();
  if (/^\/tools\/stock-notes\/screening\/?$/.test(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  }
  return response;
}

export const config = {
  matcher: ["/account/:path*", "/api/sync", "/tools/stock-notes/screening"],
};
