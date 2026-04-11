import { NextResponse } from "next/server";

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_CONTROL_HEADER = "public, max-age=300, s-maxage=300";

type RouteContext = {
  params: Promise<{
    date: string;
  }>;
};

export function buildDateDataRoute<T>(
  loader: (date: string) => Promise<T | null>,
) {
  return async function GET(_request: Request, context: RouteContext) {
    const { date } = await context.params;

    if (!DATE_PARAM_RE.test(date)) {
      return NextResponse.json({ error: "invalid date" }, { status: 400 });
    }

    const dayData = await loader(date);
    if (!dayData) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json(dayData, {
      headers: {
        "Cache-Control": CACHE_CONTROL_HEADER,
      },
    });
  };
}
