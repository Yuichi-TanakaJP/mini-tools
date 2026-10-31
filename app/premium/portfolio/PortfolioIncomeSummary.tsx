import type { DomesticDividendProjection } from "./dividend-income";
import { dividendDisplay } from "./dividend-display";
import styles from "./PortfolioAnalysis.module.css";

const yen = (value: number) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);

export default function PortfolioIncomeSummary({ projection, selected, onSelect }: { projection: DomesticDividendProjection | undefined; selected?: boolean; onSelect?: () => void }) {
  const display = dividendDisplay(projection);
  const partial = display.completeTotal === null && display.confirmedGross !== null;
  const primary = display.completeTotal ?? display.confirmedGross;
  const empty = projection?.status === "no_domestic_stocks";
  const note = empty ? "対象国内株なし" : projection?.status === "error" ? "取得失敗・合計未確認"
    : projection?.status === "no_snapshot" || !projection ? "保有・配当データ未取得"
    : display.completeTotal !== null ? `確認済み ${display.confirmedCount}銘柄`
    : display.confirmedGross !== null ? `確認済み ${display.confirmedCount}/${projection?.expectedStocks ?? 0}銘柄 ／ 未確認 ${display.missingCount}銘柄。全体合計は未確定`
    : "合計未確定・確認済み額なし";
  const content = <>
    <span className={styles.summaryLabel}>{partial ? "年間予想配当（確認済み分）" : "年間予想配当（国内株）"}</span>
    <span className={styles.summaryValue}>{primary === null ? "—" : yen(primary)}</span>
    <span className={styles.summaryNote}>{note}<br />国内株・税引前・保有全体 ／ 実際の受取額ではありません</span>
  </>;
  return <section aria-label="保有全体の年間予想配当" style={{ minWidth: 0, display: "grid" }}>
    {onSelect ? <button type="button" className={styles.summaryCard} aria-pressed={selected} onClick={onSelect}>{content}</button> : <div className={styles.summaryCard}>{content}</div>}
  </section>;
}
