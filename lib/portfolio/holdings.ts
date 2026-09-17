import type { SupabaseClient } from "@supabase/supabase-js";

export type Holding = { code: string; name: string; tab: "holding"; quantity?: number | null };
export type HoldingsState = "ready" | "no_portfolio" | "no_snapshot" | "premium_required" | "unavailable";
export type HoldingsResult = {
  holdings: Holding[];
  updatedAt: string | null;
  state: HoldingsState;
  snapshotId: string | null;
};
export type Audience = {
  holdings: HoldingsResult;
  watch: { state: "ready" | "unavailable"; codes: string[] };
};
export const unavailableHoldings = (state: HoldingsState = "unavailable"): HoldingsResult =>
  ({ holdings: [], updatedAt: null, state, snapshotId: null });

export function isAudience(value: unknown): value is Audience {
  if (!value || typeof value !== "object") return false;
  const { holdings: h, watch: w } = value as Audience;
  return !!h && !!w && ["ready", "no_portfolio", "no_snapshot", "premium_required", "unavailable"].includes(h.state)
    && Array.isArray(h.holdings) && h.holdings.every((row) => row && typeof row.code === "string" && domesticCode(row.code) === row.code && typeof row.name === "string" && row.tab === "holding")
    && (h.state === "ready" ? typeof h.snapshotId === "string" && typeof h.updatedAt === "string" && Number.isFinite(Date.parse(h.updatedAt)) : h.holdings.length === 0)
    && ["ready", "unavailable"].includes(w.state) && Array.isArray(w.codes)
    && w.codes.every((code) => typeof code === "string" && domesticCode(code) === code);
}

export const domesticCode = (value: string): string | null => {
  const code = value.normalize("NFKC").trim().toUpperCase();
  return /^[0-9][0-9A-Z][0-9][0-9A-Z]$/.test(code) ? code : null;
};

// Shared by the Portfolio page and the lightweight audience endpoint. No source_type
// filter: a manual official snapshot can be newer than a broker CSV.
export async function selectPortfolio(db: SupabaseClient) {
  const { data, error } = await db.from("stock_notes_portfolios")
    .select("id, name, base_currency").order("is_default", { ascending: false })
    .order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(1)
    .maybeSingle<{ id: string; name: string; base_currency: string }>();
  if (error) throw error;
  return data;
}

export async function selectReadySnapshot(db: SupabaseClient, portfolioId: string) {
  const { data, error } = await db.from("stock_notes_portfolio_snapshots")
    .select("id, as_of, status, source_type, imported_at, portfolio_scope, note")
    .eq("portfolio_id", portfolioId).or("portfolio_scope.eq.official,portfolio_scope.is.null")
    .eq("status", "ready").order("as_of", { ascending: false })
    .order("imported_at", { ascending: false }).order("id", { ascending: false }).limit(1)
    .maybeSingle<{ id: string; as_of: string; status: string; source_type: string; imported_at: string; portfolio_scope: string | null; note: string | null }>();
  if (error) throw error;
  return data;
}

// Request a bounded page at a time, including when PostgREST applies a row cap.
export async function loadHoldings(db: SupabaseClient, userId: string): Promise<HoldingsResult> {
  const portfolio = await selectPortfolio(db);
  if (!portfolio) return unavailableHoldings("no_portfolio");
  const snapshot = await selectReadySnapshot(db, portfolio.id);
  if (!snapshot) return unavailableHoldings("no_snapshot");
  const instruments = new Map<string, { asset_type: string; identifier: string; name: string }>();
  for (let offset = 0; ;) {
    const { data, error } = await db.from("stock_notes_portfolio_instruments")
      .select("id, asset_type, identifier, name").eq("user_id", userId).order("id")
      .range(offset, offset + 499);
    if (error || !data) throw error ?? new Error("Missing instruments");
    for (const row of data) instruments.set(row.id, row);
    if (data.length === 0) break;
    offset += data.length;
  }
  const held = new Map<string, Holding>();
  for (let offset = 0; ;) {
    const { data, error } = await db.from("stock_notes_portfolio_positions")
      .select("id, instrument_id, quantity").eq("user_id", userId)
      .eq("portfolio_id", portfolio.id).eq("snapshot_id", snapshot.id).order("id")
      .range(offset, offset + 499);
    if (error || !data) throw error ?? new Error("Missing positions");
    for (const row of data) {
      const instrument = instruments.get(row.instrument_id);
      if (!instrument) throw new Error("Missing instrument reference");
      if (instrument.asset_type !== "domestic_stock") continue;
      const code = domesticCode(instrument.identifier);
      const quantity = row.quantity == null ? NaN : Number(row.quantity);
      if (!code || !Number.isFinite(quantity)) throw new Error("Invalid domestic holding");
      if (quantity > 0) held.set(code, { code, name: instrument.name, tab: "holding" });
    }
    if (data.length === 0) break;
    offset += data.length;
  }
  // An import during pagination must not be silently presented as the current snapshot.
  if ((await selectReadySnapshot(db, portfolio.id))?.id !== snapshot.id) throw new Error("Snapshot changed; retry");
  return { state: "ready", snapshotId: snapshot.id, updatedAt: snapshot.as_of, holdings: [...held.values()] };
}

export async function loadWatchCodes(db: SupabaseClient, userId: string): Promise<string[]> {
  const codes = new Set<string>();
  for (let offset = 0; ;) {
    const { data, error } = await db.from("stock_notes_stocks").select("id, code")
      .eq("user_id", userId).eq("category", "watch").order("id").range(offset, offset + 499);
    if (error || !data) throw error ?? new Error("Missing watch list");
    for (const row of data) { const code = domesticCode(row.code); if (code) codes.add(code); }
    if (data.length === 0) break;
    offset += data.length;
  }
  return [...codes];
}

export function holdingsLabel(value: HoldingsResult): string {
  switch (value.state) {
    case "ready": return `Portfolio保有 ${value.holdings.length}銘柄（基準日 ${value.updatedAt?.slice(0, 10)}）`;
    case "premium_required": return "保有の確認にはPremiumログインが必要です。";
    case "no_portfolio": return "Portfolioが未登録です。";
    case "no_snapshot": return "有効な保有スナップショットがありません。";
    default: return "Portfolio保有を取得できませんでした。保有なしとは判定していません。";
  }
}
