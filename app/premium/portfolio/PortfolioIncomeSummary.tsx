import { summarizeForeignIncome, type ForeignIncomeProjection } from "./foreign-income";
import type { DomesticDividendProjection } from "./dividend-income";
import { dividendCoverageNote, dividendDisplay } from "./dividend-display";
import styles from "./PortfolioAnalysis.module.css";

const yen = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
type IncomeProps = { projection: DomesticDividendProjection | undefined; foreignIncome?: ForeignIncomeProjection };
function incomeAmounts({ projection, foreignIncome }: IncomeProps) {
  const display = dividendDisplay(projection);
  const domestic = projection?.status === "no_domestic_stocks" && foreignIncome ? 0 : display.completeTotal ?? display.confirmedGross;
  const foreign = summarizeForeignIncome(foreignIncome);
  const noTargets = projection?.status === "no_domestic_stocks" && foreignIncome?.status === "empty";
  const sum = noTargets ? null : foreignIncome ? domestic !== null && foreign.partial !== null ? domestic + foreign.partial : null : domestic;
  return { display, domestic, foreign, total: sum !== null && Number.isFinite(sum) ? sum : null };
}

export default function PortfolioIncomeSummary({ projection, foreignIncome, selected, onSelect }: IncomeProps & { selected?: boolean; onSelect?: () => void }) {
  const { total } = incomeAmounts({ projection, foreignIncome });
  const content = <>
    <span className={styles.summaryLabel}>年間配当見込み</span>
    <span className={styles.summaryValue}>{yen(total)}</span>
  </>;
  return <section aria-label="保有全体の年間予想配当" style={{ minWidth: 0, display: "grid" }}>
    {onSelect ? <button type="button" className={styles.summaryCard} aria-pressed={selected} onClick={onSelect}>{content}</button> : <div className={styles.summaryCard}>{content}</div>}
  </section>;
}

/** Explanations live below the whole card row, outside every selection button. */
export function PortfolioIncomeNotes({ projection, foreignIncome }: IncomeProps) {
  const { display, domestic, foreign } = incomeAmounts({ projection, foreignIncome });
  const coverage = dividendCoverageNote(display);
  const foreignMissing = foreignIncome && foreign.missing > 0 ? `海外未確認 ${foreign.missing}件` : "";
  const unavailable = foreignIncome && !["loaded", "empty"].includes(foreignIncome.status) ? "海外分は取得・確認待ち。" : "";
  if (projection?.status === "no_domestic_stocks" && foreignIncome?.status === "empty") return <p aria-label="配当の補足" className={styles.summaryNote}>配当集計の対象となる株式・ETFはありません。MMFは対象外です。</p>;
  return <div aria-label="配当の補足" style={{ marginTop: 10, color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.7 }}>
    <p style={{ margin: 0 }}>国内株予想 {yen(domestic)} ＋ 外国株・ETF参考 {yen(foreign.partial)}。税引前。</p>
    <p style={{ margin: 0 }}>外国ETFは過去12か月実績。{[coverage, foreignMissing].filter(Boolean).join(" ／ ")}{coverage || foreignMissing ? "は含みません。" : ""}{unavailable}MMFは対象外です。</p>
  </div>;
}
