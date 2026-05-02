import { NextResponse } from "next/server";
import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { EconCalendarWeeklyResponse } from "@/app/tools/econ-calendar/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ week_start: string }> }
) {
  const { week_start } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
    return NextResponse.json({ error: "Invalid week_start format" }, { status: 400 });
  }
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return NextResponse.json({ error: "API not configured" }, { status: 503 });
  }
  try {
    const data = await fetchJson<EconCalendarWeeklyResponse>(
      `${apiBase}/econ-calendar/weekly/${week_start}`,
      3600
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch week data" }, { status: 502 });
  }
}
