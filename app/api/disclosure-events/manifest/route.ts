import { NextResponse } from "next/server";
import { loadDisclosureManifest } from "@/app/tools/disclosure-radar/data-loader";

const CACHE_CONTROL = "public, max-age=300";

export async function GET() {
  const manifest = await loadDisclosureManifest();
  if (!manifest) {
    return NextResponse.json(
      { error: "Failed to fetch disclosure events manifest" },
      { status: 502 },
    );
  }
  return NextResponse.json(manifest, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
