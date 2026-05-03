import { NextResponse } from "next/server";
import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { EconCalendarManifest } from "@/app/tools/econ-calendar/types";

export const revalidate = 300;

export async function GET() {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return NextResponse.json({ error: "API not configured" }, { status: 503 });
  }
  try {
    const data = await fetchJson<EconCalendarManifest>(
      `${apiBase}/econ-calendar/weekly/manifest`,
      300
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch manifest" }, { status: 502 });
  }
}
