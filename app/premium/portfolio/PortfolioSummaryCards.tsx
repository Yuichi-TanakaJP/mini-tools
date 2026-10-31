import { summarizePortfolioValuation } from "./valuation-summary";
import { emptyExternalAssets } from "./external-assets";
import { selectDividendProjection } from "./linked-analysis";
import { summarizeAssetCategory, type SummaryTarget } from "./summary-selection";
import PortfolioIncomeSummary from "./PortfolioIncomeSummary";
import type { PortfolioData } from "./types";
import styles from "./PortfolioAnalysis.module.css";

const yen = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);

export default function PortfolioSummaryCards({ data, active, onSelect }: { data: PortfolioData; active: SummaryTarget; onSelect: (target: SummaryTarget) => void }) {
  const external = data.externalAssets ?? emptyExternalAssets();
  const valuation = summarizePortfolioValuation(data.positions, external);
  const externalUnavailable = external.status === "error" || external.status === "loading";
  const equity = summarizeAssetCategory(data.positions, ["domestic_stock", "foreign_stock"], Boolean(data.currentSnapshot));
  const funds = summarizeAssetCategory(data.positions, ["investment_fund"], Boolean(data.currentSnapshot));
  const wholeDividend = selectDividendProjection(data.domesticDividends, data.positions, data.positions);
  const note = (item: typeof equity, scope: string) => !data.currentSnapshot ? "保有データ未取込" : `${scope} ／ ${item.instrumentCount}商品${item.missingCount ? ` ／ 評価額未取得 ${item.missingCount}件を除く` : ""}`;
  return <div role="group" aria-label="表示する内容" className={styles.summaryGrid}>
    <button type="button" className={styles.summaryCard} aria-pressed={active === "assets"} onClick={() => onSelect("assets")}>
      <span className={styles.summaryLabel}>総資産評価額{externalUnavailable || valuation.missingMarketValueCount ? "（取得分）" : ""}</span><span className={styles.summaryValue}>{yen(valuation.totalMarketValue)}</span>
      <span className={styles.summaryNote}>全体を見る ／ {externalUnavailable ? "外部参照は未取得・登録保有分のみ" : "登録保有＋外部参照"}{valuation.missingMarketValueCount ? ` ／ 評価未取得 ${valuation.missingMarketValueCount}件を除く` : ""}</span>
    </button>
    <PortfolioIncomeSummary projection={wholeDividend} selected={active === "dividends"} onSelect={() => onSelect("dividends")} />
    <button type="button" className={styles.summaryCard} aria-pressed={active === "equity"} onClick={() => onSelect("equity")}>
      <span className={styles.summaryLabel}>個別株の評価額{equity.missingCount ? "（評価取得分）" : ""}</span><span className={styles.summaryValue}>{yen(equity.amount)}</span><span className={styles.summaryNote}>{note(equity, "登録保有の国内・海外株")}</span>
    </button>
    <button type="button" className={styles.summaryCard} aria-pressed={active === "funds"} onClick={() => onSelect("funds")} disabled={funds.positionCount === 0}>
      <span className={styles.summaryLabel}>投資信託の評価額{funds.missingCount ? "（評価取得分）" : ""}</span><span className={styles.summaryValue}>{yen(funds.amount)}</span><span className={styles.summaryNote}>{note(funds, "登録保有の投資信託")}{data.currentSnapshot && funds.positionCount === 0 ? " ／ 対象なし" : ""}</span>
    </button>
  </div>;
}
