import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;
const MAX_ROWS = 100_000;

/** Exact counts and stable ordering prevent a server row cap from becoming a complete snapshot. */
export async function readCompleteRows<T extends { id: string }>(
  supabase: SupabaseClient, table: string, columns: string, openOnly = false,
): Promise<T[]> {
  const rows: T[] = [];
  const ids = new Set<string>();
  let total: number | null = null;
  do {
    let query = supabase.from(table).select(columns, { count: "exact" }).order("id", { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (openOnly) query = query.eq("status", "open");
    const { data, error, count } = await query.returns<T[]>();
    if (error) throw error;
    if (!Array.isArray(data) || !Number.isSafeInteger(count) || count === null || count < 0 || count > MAX_ROWS ||
      (total !== null && count !== total)) throw new Error("一覧の完全性を確認できません。再取得してください。");
    total = count;
    if ((data.length === 0 && rows.length < total) || rows.length + data.length > total || data.length > PAGE_SIZE) {
      throw new Error("一覧が途中で切れています。再取得してください。");
    }
    for (const row of data) {
      if (!row || typeof row.id !== "string" || ids.has(row.id)) throw new Error("一覧の重複を検出しました。再取得してください。");
      ids.add(row.id);
      rows.push(row);
    }
  } while (rows.length < total);
  return rows;
}
