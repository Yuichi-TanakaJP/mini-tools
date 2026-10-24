import { NextResponse } from "next/server";
import { loadInvestorFlowPageData } from "../data-loader";
import { acceptInvestorFlowUpdate } from "../live-data";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const start = params.get("start") ?? undefined;
  const end = params.get("end") ?? undefined;
  const headers = { "Cache-Control": "no-store" };
  if (Boolean(start) !== Boolean(end) || [start, end].some(value => value && !/^\d{4}-\d{2}-\d{2}$/.test(value))) return NextResponse.json({ error: "invalid week" }, { status: 400, headers });
  try {
    const data = await loadInvestorFlowPageData(start, end);
    acceptInvestorFlowUpdate({ ...data, payload: null }, data, start, end);
    // Only the selector window is needed for each background update.
    const display = { ...data,
      manifest: data.manifest ? { ...data.manifest, weeks: data.manifest.weeks.slice(0, 12) } : null,
      analysisManifest: data.analysisManifest ? { ...data.analysisManifest, weeks: data.analysisManifest.weeks.slice(0, 13) } : null,
    };
    return NextResponse.json(display, { headers });
  } catch {
    return NextResponse.json({ error: "公開データを確認できません。自動で再試行します。" }, { status: 503, headers });
  }
}
