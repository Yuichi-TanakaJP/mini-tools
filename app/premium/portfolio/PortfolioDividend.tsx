"use client";

import type { DomesticDividendProjection, DomesticDividendPosition } from "./dividend-income";

function yen(value: number | null, digits = 0): string {
  return value === null ? "—" : new Intl.NumberFormat("ja-JP", {
    style: "currency", currency: "JPY", maximumFractionDigits: digits,
  }).format(value);
}

function number(value: number | null, digits = 2): string {
  return value === null ? "—" : new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: digits,
  }).format(value);
}

function date(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
}

function changeLabel(value: DomesticDividendPosition["changeType"]): string {
  if (value === "increase") return "増配";
  if (value === "decrease") return "減配";
  if (value === "unchanged") return "据置";
  return "比較不可";
}

export default function PortfolioDividend({ projection }: {
  projection: DomesticDividendProjection | undefined;
}) {
  const data = projection;
  const isReady = data?.status === "ready";
  const card = { background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 18 };
  return (
    <section style={{ ...card, display: "grid", gap: 14 }} aria-label="国内株の予想配当">
      <div>
        <h2 style={{ margin: 0, fontSize: 19 }}>国内株の予想配当（税引前・年換算）</h2>
        <p style={{ color: "var(--color-text-sub)", fontSize: 13, margin: "6px 0 0", lineHeight: 1.6 }}>
          登録済み公式保有の国内個別株のみ。ETF・投資信託・MMF・預金利息は含みません。
          実際に入金された配当金ではありません。
        </p>
      </div>
      {!data || data.status === "no_snapshot" ? (
        <p style={{ margin: 0 }}>公式readyスナップショットがないため、配当を計算できません。</p>
      ) : data.status === "no_domestic_stocks" ? (
        <p style={{ margin: 0 }}>対象の国内個別株がありません。配当0円の証明ではありません。</p>
      ) : data.status === "error" ? (
        <p role="status" style={{ margin: 0, color: "var(--color-warning)" }}>
          配当データを読み取れませんでした。0円とは扱いません。保有一覧の表示は継続できます。
        </p>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            保有基準日 {date(data.asOf)} ／ 会社予想の最も新しい確認日 {date(data.latestForecastAsOf)} ／
            対応 {data.coveredStocks}/{data.expectedStocks}銘柄
          </div>
          {!isReady ? (
            <p role="status" style={{ margin: 0, color: "var(--color-warning)" }}>
              一部の予想配当・保有数量・基準日が照合できません。合計金額は未確定として表示しません。
            </p>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {[
              ["年間予想配当", yen(data.projectedAnnualGross), "現在の保有数量 × 会社予想DPS"],
              ["増配 / 減配", isReady ? data.increaseCount + " / " + data.decreaseCount + "銘柄" : "—", "据置 " + data.unchangedCount + " / 比較不可 " + data.notComparableCount],
              ["配当単価変化の寄与", yen(data.comparableRateEffectGross), "比較可能な" + data.comparableCount + "銘柄のみ。買増の効果は含めません"],
              ["直近実績DPS基準", yen(data.priorRunRateGross), "比較不可がある場合、全体値は出しません"],
            ].map(([label, value, note]) => (
              <div key={label} style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12, minWidth: 0 }}>
                <div style={{ color: "var(--color-text-sub)", fontSize: 12 }}>{label}</div>
                <div style={{ fontWeight: 800, fontSize: 20, overflowWrap: "anywhere", marginTop: 5 }}>{value}</div>
                <div style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{note}</div>
              </div>
            ))}
          </div>
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              銘柄別の配当予想を確認（{data.positions.length}件）
            </summary>
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                    {["銘柄", "数量", "直近実績DPS", "会社予想DPS", "年間予想", "増減区分", "寄与額"].map((s) => (
                      <th key={s} scope="col" style={{ padding: "8px 6px" }}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((p) => (
                    <tr key={p.instrumentId} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                        <strong>{p.ticker ?? "不明"}</strong> {p.name ?? ""}
                      </td>
                      <td style={{ padding: "8px 6px" }}>{number(p.quantity)}</td>
                      <td style={{ padding: "8px 6px" }}>{yen(p.actualDps, 2)}</td>
                      <td style={{ padding: "8px 6px" }}>{yen(p.forecastDps, 2)}</td>
                      <td style={{ padding: "8px 6px" }}>{yen(p.annualGross)}</td>
                      <td style={{ padding: "8px 6px" }}>{changeLabel(p.changeType)}</td>
                      <td style={{ padding: "8px 6px" }}>{yen(p.rateEffectGross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "8px 0 0" }}>
              配当単価変化の寄与額と、年間予想配当の前年差は同じではありません。
              実際の受取額・税引後額は別の入金記録が必要です。
            </p>
          </details>
        </>
      )}
    </section>
  );
}
