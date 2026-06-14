import { NextResponse } from "next/server";
import { loadDisclosureEventsByDate } from "@/app/tools/disclosure-radar/data-loader";

const DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD format" },
      { status: 422 },
    );
  }
  const data = await loadDisclosureEventsByDate(date);
  if (!data) {
    return NextResponse.json(
      { error: `Failed to fetch disclosure events: ${date}` },
      { status: 502 },
    );
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
