import { NextResponse } from "next/server";
import { isSyncConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// クロスデバイス同期 API（Phase 1）。
// 設計: docs/plans/phase1-cross-device-sync-plan.md
// - 未設定（Supabase env なし）なら 503
// - 未ログインなら 401
// - データは RLS により自分の行だけが対象（user_id = auth.uid()）

type SyncItem = { key: string; value: unknown; updatedAt: string };

type ToolDataRow = { key: string; value: unknown; updated_at: string };

function rowToItem(row: ToolDataRow): SyncItem {
  return { key: row.key, value: row.value, updatedAt: row.updated_at };
}

// GET /api/sync : 自分の全データを返す（復元用）
export async function GET() {
  if (!isSyncConfigured()) {
    return NextResponse.json({ error: "sync is not configured" }, { status: 503 });
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("tool_data")
    .select("key, value, updated_at")
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map(rowToItem);
  return NextResponse.json({ items });
}

// POST /api/sync : items を upsert（保存用）。updatedAt の新しい方を採用（last-write-wins）
export async function POST(request: Request) {
  if (!isSyncConfigured()) {
    return NextResponse.json({ error: "sync is not configured" }, { status: 503 });
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { items?: SyncItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const incoming = Array.isArray(body.items) ? body.items : [];
  const valid = incoming.filter(
    (it) => it && typeof it.key === "string" && typeof it.updatedAt === "string",
  );

  // 既存の updatedAt を引いて、より新しいものだけ upsert する。
  const keys = valid.map((it) => it.key);
  const existing = new Map<string, string>();
  if (keys.length > 0) {
    const { data: rows, error } = await supabase
      .from("tool_data")
      .select("key, updated_at")
      .eq("user_id", user.id)
      .in("key", keys);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const row of rows ?? []) {
      existing.set(row.key, row.updated_at);
    }
  }

  const toUpsert = valid
    .filter((it) => {
      const prev = existing.get(it.key);
      return !prev || new Date(it.updatedAt).getTime() > new Date(prev).getTime();
    })
    .map((it) => ({
      user_id: user.id,
      key: it.key,
      value: it.value,
      updated_at: it.updatedAt,
    }));

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("tool_data")
      .upsert(toUpsert, { onConflict: "user_id,key" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // マージ後の確定値（全件）を返す。クライアントはこれで LocalStorage を更新する。
  const { data: after, error: afterError } = await supabase
    .from("tool_data")
    .select("key, value, updated_at")
    .eq("user_id", user.id);
  if (afterError) {
    return NextResponse.json({ error: afterError.message }, { status: 500 });
  }

  const items = (after ?? []).map(rowToItem);
  return NextResponse.json({ items });
}
