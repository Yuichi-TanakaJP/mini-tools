import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/market-api";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { parseYutaiStockPriceSnapshot } from "@/app/tools/yutai-dashboard/stock-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE = "private, no-store";
const PRIVATE_MONTH_CACHE = "private, max-age=86400";
const UPSTREAM_PATH = "/yutai/stock-prices/latest";
const UPSTREAM_TIMEOUT_MS = 5_000;

function json(body: unknown, status = 200, cacheControl = PRIVATE_NO_STORE) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": cacheControl,
      Vary: "Cookie",
    },
  });
}

function getScopeMonth(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const scopeMonth = (value as Record<string, unknown>).scope_month;
  return typeof scopeMonth === "string" ? scopeMonth : null;
}

async function isAuthorized() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  return verifyPremiumSession(session);
}

export async function GET(request: Request) {
  if (!(await isAuthorized())) {
    return json(
      { error: "ログインが必要です。/premium/login からログインしてください。" },
      404,
    );
  }

  const apiBase = getApiBaseUrl();
  const apiToken = process.env.MARKET_INFO_API_YUTAI_STOCK_PRICES_TOKEN?.trim();
  if (!apiBase || !apiToken) {
    return json({ error: "優待株価APIが設定されていません。" }, 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase}${UPSTREAM_PATH}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ error: "優待株価APIへ接続できませんでした。" }, 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 404) {
      return json({ error: "優待株価データがまだありません。" }, 404);
    }
    return json(
      {
        error: "優待株価APIからデータを取得できませんでした。",
        upstreamStatus: upstream.status,
      },
      502,
    );
  }

  try {
    const payload: unknown = await upstream.json();
    const requestedMonth = new URL(request.url).searchParams.get("month");
    const cacheControl = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
      && getScopeMonth(payload) === requestedMonth
      && parseYutaiStockPriceSnapshot(payload)
      ? PRIVATE_MONTH_CACHE
      : PRIVATE_NO_STORE;
    return json(payload, 200, cacheControl);
  } catch {
    return json({ error: "優待株価APIの応答形式が不正です。" }, 502);
  }
}
