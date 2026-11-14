import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSyncConfigured } from "@/lib/supabase/config";
import { parseStockNotesDelta, type StockNotesManifest } from "@/app/tools/stock-notes/delta";

export const runtime = "nodejs";
const CACHE_CONTROL = "private, no-store";
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": CACHE_CONTROL } });
}
function parseKnownManifest(value: unknown): StockNotesManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).length > 2_000) return {};
  const manifest: StockNotesManifest = {};
  for (const [id, revision] of Object.entries(value)) {
    if (!id.length || id.length > 128 || typeof revision !== "string" || !revision.length || revision.length > 256) return {};
    manifest[id] = revision;
  }
  return manifest;
}
export async function POST(request: Request) {
  if (!isSyncConfigured()) return json({ error: "Supabase env is not configured" }, 503);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const knownManifest = parseKnownManifest(typeof body === "object" && body !== null && "knownManifest" in body ? body.knownManifest : null);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  try {
    // A single stable SQL function builds all four tables under one database snapshot.
    const result = await supabase.rpc("get_stock_notes_delta", { p_known_manifest: knownManifest });
    if (result.error) throw result.error;
    return json(parseStockNotesDelta(result.data));
  } catch (error) {
    console.error("[stock-notes/delta] failed to read atomic delta", error);
    return json({ error: "銘柄差分を取得できませんでした。" }, 502);
  }
}
