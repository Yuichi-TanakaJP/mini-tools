import { NextResponse } from "next/server";
import { loadRankingDayData } from "../../data-loader";

type RouteContext = {
  params: Promise<{
    date: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { date } = await context.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  const dayData = await loadRankingDayData(date);
  if (!dayData) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(dayData, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
