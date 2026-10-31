import type { DomesticDividendProjection } from "./dividend-income";
import { dividendDisplay } from "./dividend-display";

const yen = (value: number) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);

export default function PortfolioIncomeSummary({ projection }: { projection: DomesticDividendProjection | undefined }) {
  const display = dividendDisplay(projection);
  const empty = projection?.status === "no_domestic_stocks";
  const note = empty ? "対象国内株なし" : projection?.status === "error" ? "取得失敗・合計未確認"
    : projection?.status === "no_snapshot" || !projection ? "保有・配当データ未取得"
    : display.completeTotal !== null ? `確認済み ${display.confirmedCount}銘柄`
    : display.confirmedGross !== null ? `確認済み分 ${yen(display.confirmedGross)} ／ 未確認 ${display.missingCount}銘柄`
    : "合計未確定・確認済み額なし";
  return <section aria-label="保有全体の年間予想配当" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 14, minWidth: 0 }}>
    <div style={{ color: "var(--color-text-sub)", fontSize: 12, fontWeight: 700 }}>年間予想配当（国内株）</div>
    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{display.completeTotal === null ? "—" : yen(display.completeTotal)}</div>
    <div style={{ marginTop: 6, fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.6 }}>{note}<br />税引前・保有全体 ／ 実際の受取額ではありません</div>
  </section>;
}
