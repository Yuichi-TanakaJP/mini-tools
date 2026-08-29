import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { isSyncConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadCompanyGroupScope,
  loadCompanyNetworkScope,
} from "@/app/premium/company-network/data-loader";
import type { RelationCategory } from "@/app/premium/company-network/types";

const VALID_CATEGORIES = new Set<RelationCategory>(["capital", "control", "historical"]);

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) {
    return NextResponse.json({ status: "unauthenticated", data: null, message: "Premium認証が必要です。" }, { status: 401 });
  }
  if (!isSyncConfigured()) {
    return NextResponse.json({ status: "unconfigured", data: null, message: "Supabase連携が未設定です。" }, { status: 503 });
  }

  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId")?.trim() ?? "";
  const companyId = url.searchParams.get("companyId")?.trim() ?? "";
  const hops = url.searchParams.get("hops") === "1" ? 1 : 2;
  const verifiedOnly = url.searchParams.get("verifiedOnly") !== "false";
  const includeGroups = url.searchParams.get("includeGroups") !== "false";
  const categories = (url.searchParams.get("categories") ?? "capital,control,historical")
    .split(",")
    .filter((value): value is RelationCategory => VALID_CATEGORIES.has(value as RelationCategory));

  if (!groupId && !companyId) {
    return NextResponse.json({ status: "error", data: null, message: "groupIdまたはcompanyIdが必要です。" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: "unauthenticated", data: null, message: "Supabaseにログインしてください。" }, { status: 401 });
  }

  const result = groupId
    ? await loadCompanyGroupScope(supabase, {
        groupId,
        verifiedOnly,
        categories,
      })
    : await loadCompanyNetworkScope(supabase, {
        companyId,
        hops,
        verifiedOnly,
        categories,
        includeGroups,
      });

  return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 });
}
