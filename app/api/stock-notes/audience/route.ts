import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSyncConfigured } from "@/lib/supabase/config";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { loadHoldings, loadWatchCodes, unavailableHoldings, type Audience } from "@/lib/portfolio/holdings";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET() {
  if (!isSyncConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503, headers });
  try {
    const db = await createSupabaseServerClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
    const premium = verifyPremiumSession((await cookies()).get(PREMIUM_COOKIE_NAME)?.value);
    const [holdings, watch] = await Promise.all([
      premium ? loadHoldings(db, user.id).catch(() => unavailableHoldings())
        : Promise.resolve(unavailableHoldings("premium_required")),
      loadWatchCodes(db, user.id).then((codes) => ({ state: "ready" as const, codes }))
        .catch(() => ({ state: "unavailable" as const, codes: [] as string[] })),
    ]);
    return NextResponse.json({ holdings, watch } satisfies Audience, { headers });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  }
}
