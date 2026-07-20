import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/market-api";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_CACHE_CONTROL = "private, no-store";
const UPSTREAM_PATH = "/yutai/stock-prices/latest";
const UPSTREAM_TIMEOUT_MS = 5_000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": PRIVATE_CACHE_CONTROL },
  });
}

async function isAuthorized() {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  return verifyPremiumSession(session);
}

export async function GET() {
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
    return json(await upstream.json());
  } catch {
    return json({ error: "優待株価APIの応答形式が不正です。" }, 502);
  }
}
