import { NextResponse, type NextRequest } from "next/server";
import { isSyncConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 の proxy 規約（旧 middleware）。
// 同期に関わるパスだけ Supabase セッションをリフレッシュする。
// 未設定なら何もしない（既存挙動に影響なし）。
export async function proxy(request: NextRequest) {
  if (!isSyncConfigured()) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: ["/account/:path*", "/api/sync"],
};
