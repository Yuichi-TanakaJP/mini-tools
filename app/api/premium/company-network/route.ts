import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { isSyncConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadCompanyGroupScope,
  loadCompanyNetworkScope,
} from "@/app/premium/company-network/data-loader";
import type { CompanyNetworkScopeResult, RelationCategory } from "@/app/premium/company-network/types";

const VALID_CATEGORIES = new Set<RelationCategory>(["capital", "control", "historical"]);

type ListingRow = {
  company_entity_id: string;
  exchange_code: string | null;
  exchange_name: string | null;
  ticker: string | null;
  listing_role: string | null;
  is_preferred: boolean | null;
};

async function enrichListings(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  result: CompanyNetworkScopeResult,
): Promise<CompanyNetworkScopeResult> {
  if (!result.data || result.data.companies.length === 0) return result;

  const companyIds = result.data.companies.map((company) => company.id);
  const listingResult = await supabase
    .from("stock_notes_company_listings")
    .select("company_entity_id,exchange_code,exchange_name,ticker,listing_role,is_preferred")
    .in("company_entity_id", companyIds)
    .is("valid_to", null)
    .order("is_preferred", { ascending: false });

  if (listingResult.error) return result;

  const listingByCompany = new Map<string, ListingRow>();
  for (const row of (listingResult.data ?? []) as ListingRow[]) {
    const current = listingByCompany.get(row.company_entity_id);
    if (!current || row.is_preferred || row.listing_role === "primary") {
      listingByCompany.set(row.company_entity_id, row);
    }
  }

  return {
    ...result,
    data: {
      ...result.data,
      companies: result.data.companies.map((company) => {
        const listing = listingByCompany.get(company.id);
        return {
          ...company,
          ticker: listing?.ticker ?? null,
          exchangeCode: listing?.exchange_code ?? null,
          exchangeName: listing?.exchange_name ?? null,
        };
      }),
    },
  };
}

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

  const enriched = await enrichListings(supabase, result);
  return NextResponse.json(enriched, { status: enriched.status === "error" ? 500 : 200 });
}
