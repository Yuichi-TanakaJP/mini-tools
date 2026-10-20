import { getAgeDaysFromDate } from "./freshness";

export const UNVERIFIED_MARKET_SOURCES = new Set(["/ranking/manifest", "/nikkei/manifest", "/topix33/manifest"]);

export function marketDateSummary(dates: string[]) {
  const valid = [...new Set(dates)].filter(date => getAgeDaysFromDate(date, date) !== null).sort().reverse();
  const weekends = valid.filter(date => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()));
  return { weekendCount: weekends.length, latestWeekday: valid.find(date => !weekends.includes(date)) ?? null };
}

export function MarketDateQuality({ rows }: { rows: { name: string; source: string; latest?: string | null; history?: string[]; generatedAt?: string | null }[] }) {
  return <section aria-label="国内相場の日付品質" style={{ padding: 16, marginBottom: 20, border: "1px solid #a16207", borderRadius: 12, background: "#241e12", color: "#fef3c7" }}>
    <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>国内相場：取引日未確認</h2>
    <p style={{ lineHeight: 1.7 }}>保存日やAPI生成時刻だけでは、相場の取引日・欠損の解消・ジョブの正常終了を確認できません。国内3ソースは日付が新しくてもFRESHにせず、原ページの日付証拠が揃うまでUNKNOWNと表示します。</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12 }}>
      {rows.filter(row => UNVERIFIED_MARKET_SOURCES.has(row.source)).map(row => {
        const summary = marketDateSummary(row.history ?? []);
        return <div key={row.source} style={{ border: "1px solid #854d0e", padding: 12, borderRadius: 8, overflowWrap: "anywhere", lineHeight: 1.8 }}>
          <strong>{row.name}：未確認</strong>
          <div>API最新日：{row.latest ?? "取得失敗"}</div>
          <div>API生成時刻：{row.generatedAt ?? "未提供"}</div>
          <div>履歴内の週末：{summary.weekendCount}件</div>
          <div>最新の平日：{summary.latestWeekday ?? "なし"}（祝日未判定）</div>
        </div>;
      })}
    </div>
  </section>;
}
