import type { DomesticDividendProjection } from "./dividend-income";
import { dividendDisplay } from "./dividend-display";
import type { AnalysisGroup } from "./linked-analysis";
import styles from "./PortfolioAnalysis.module.css";

const yen = (value: number) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);

export default function PortfolioDividendComposition({ groups, projection, dimensionLabel, selectedKey, onSelect }: {
  groups: { group: AnalysisGroup; projection: DomesticDividendProjection | undefined }[];
  projection: DomesticDividendProjection | undefined;
  dimensionLabel: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const total = dividendDisplay(projection);
  const rows = groups.map((item) => ({ ...item, display: dividendDisplay(item.projection) }))
    .sort((a, b) => (b.display.confirmedGross ?? -1) - (a.display.confirmedGross ?? -1));
  return <div aria-label="分類別の予想配当" className={styles.dividendComposition}>
    <div><h3 style={{ margin: 0, fontSize: 16 }}>{dimensionLabel}{dimensionLabel.endsWith("別") ? "" : "別"}の配当構成</h3>
      <p style={{ margin: "6px 0 0", color: "var(--color-text-sub)", fontSize: 12, lineHeight: 1.6 }}>
        {total.confirmedGross === null ? "確認済みの年間予想額がないため、グラフは未表示です。" : <>確認済み予想配当 <strong>{yen(total.confirmedGross)}</strong> の内訳（国内株・税引前）。{total.missingCount > 0 ? `未確認 ${total.missingCount}銘柄は金額・割合に含みません。この表示範囲の年間合計は未確定です。` : ""}{total.confirmedGross === 0 ? "確認済み額は0円のため、構成比はありません。" : "棒の長さ・割合は確認済み額を分母にしています。"}</>}
      </p>
    </div>
    <div className={styles.dividendBars}>
      {rows.map(({ group, projection: item, display }) => {
        const percent = total.confirmedGross !== null && total.confirmedGross > 0 && display.confirmedGross !== null ? display.confirmedGross / total.confirmedGross * 100 : null;
        const caption = item?.status === "no_domestic_stocks" ? "対象国内株なし" : display.confirmedGross === null ? "未確認" : `${display.completeTotal === null ? "確認済み分 " : ""}${yen(display.confirmedGross)}`;
        return <button key={group.key} className={styles.dividendBarButton} type="button" aria-pressed={selectedKey === group.key} onClick={() => onSelect(group.key)}>
          <span className={styles.dividendBarHeading}><strong>{group.label}</strong><span>{caption}{percent !== null ? ` ／ ${percent.toFixed(1)}%` : ""}</span></span>
          {percent !== null ? <span className={styles.dividendTrack} aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></span> : null}
          {display.missingCount > 0 ? <span className={styles.dividendBarNote}>未確認 {display.missingCount}銘柄</span> : null}
        </button>;
      })}
    </div>
  </div>;
}
