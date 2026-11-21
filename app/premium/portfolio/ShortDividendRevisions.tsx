import type { SupabaseClient } from "@supabase/supabase-js";

type Revision = {
  id: string;
  ticker: string;
  fiscal_period_start: string;
  fiscal_period_end: string;
  published_on: string;
  previous_published_on: string;
  forecast_dps: string;
  previous_forecast_dps: string;
  revision_delta_dps: string | null;
};

export type ShortDividendRevisionData =
  | { status: "ready"; rows: Revision[] }
  | { status: "unavailable" };

export async function loadShortDividendRevisions(
  db: SupabaseClient,
  userId: string,
): Promise<ShortDividendRevisionData> {
  const { data, error } = await db.from("stock_notes_short_dividend_forecast_revisions_v1")
    .select("id,ticker,fiscal_period_start,fiscal_period_end,published_on,previous_published_on,forecast_dps,previous_forecast_dps,revision_delta_dps")
    .eq("user_id", userId).order("published_on", { ascending: false })
    .order("id", { ascending: true }).limit(20).returns<Revision[]>();
  return error || !data ? { status: "unavailable" } : { status: "ready", rows: data };
}

function deltaLabel(value: string | null): string {
  if (value === null) return "増減は比較保留";
  if (Number(value) === 0) return "据え置き";
  if (value.startsWith("-")) return `${value.slice(1)}円減`;
  return `${value}円増`;
}

export default function ShortDividendRevisions({ data }: { data: ShortDividendRevisionData }) {
  return (
    <section aria-labelledby="short-dividend-revisions" style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 18 }}>
      <h2 id="short-dividend-revisions" style={{ marginTop: 0, fontSize: 19 }}>短期決算の配当予想の改訂</h2>
      {data.status === "unavailable" ? <p role="status">配当予想の改訂履歴を取得できませんでした。</p> :
        data.rows.length === 0 ? <p>短期決算の改訂履歴はありません。</p> : (
          <ul style={{ display: "grid", gap: 12, paddingLeft: 20 }}>
            {data.rows.map((row) => (
              <li key={row.id}>
                <strong>{row.ticker}　{row.previous_forecast_dps}円 → {row.forecast_dps}円（{deltaLabel(row.revision_delta_dps)}）</strong>
                <div>公表日 {row.previous_published_on} → {row.published_on}</div>
                <div>対象期間 {row.fiscal_period_start}〜{row.fiscal_period_end} ／ 1株あたりの会社予想</div>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
