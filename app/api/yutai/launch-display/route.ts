import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/market-api";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { parseYutaiLaunchDisplaySnapshot } from "@/app/tools/yutai-dashboard/launch-display";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE = "private, no-store";
const PRIVATE_MONTH_CACHE = "private, max-age=86400";
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

function getRequestedMonth(request: Request) {
  const month = new URL(request.url).searchParams.get("month")?.trim() ?? "";
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
}

function getUpstreamPath(month: string | null) {
  return month ? `/yutai/launch-display/monthly/${month}` : "/yutai/launch-display/latest";
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
    return json({ error: "優待条件APIが設定されていません。" }, 503);
  }

  const requestedMonth = getRequestedMonth(request);
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase}${getUpstreamPath(requestedMonth)}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json({ error: "優待条件APIへ接続できませんでした。" }, 502);
  }

  if (!upstream.ok) {
    if (upstream.status === 404) {
      return json({ error: "優待条件データがまだありません。" }, 404);
    }
    return json(
      {
        error: "優待条件APIからデータを取得できませんでした。",
        upstreamStatus: upstream.status,
      },
      502,
    );
  }

  try {
    const payload: unknown = await upstream.json();
    const snapshot = parseYutaiLaunchDisplaySnapshot(payload);
    const cacheControl = requestedMonth && snapshot?.month === requestedMonth
      ? PRIVATE_MONTH_CACHE
      : PRIVATE_NO_STORE;
    return json(payload, 200, cacheControl);
  } catch {
    return json({ error: "優待条件APIの応答形式が不正です。" }, 502);
  }
}
