import { foreignRowAmount, incomeNumber, summarizeForeignIncome, type ForeignIncomeProjection } from "./foreign-income";
import styles from "./PortfolioAnalysis.module.css";

const yen = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
const native = (value: number | string | null, currency: string | null) => incomeNumber(value) === null ? "—" : `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(Number(value))} ${currency ?? ""}`;
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(new Date(value)) : "—";
const reasons: Record<string, string> = {
  share_basis_unverified: "保有基準日の株数基準が未確認",
  overlapping_scopes: "登録保有と外部参照の重複確認が必要", currency_missing: "原通貨が未確認", income_missing: "配当・分配金の根拠未登録", income_evidence_invalid: "配当・分配金の出典条件が未確認", policy_evidence_invalid: "無配方針の再確認が必要", ttm_evidence_invalid: "過去12か月の分配根拠が未確認",
  observation_missing: "配当・分配金の根拠未登録", income_observation_missing: "配当・分配金の根拠未登録", quantity_missing: "保有数量が未確認", invalid_quantity: "保有数量が未確認", fx_missing: "為替情報が未確認", invalid_fx: "為替情報が未確認", fx_future: "保有基準日より後の為替", unsupported_income_basis: "年間参考額の根拠が未確認", source_future: "保有基準日より後の出典", observation_stale: "配当情報の再確認が必要", fx_stale: "為替情報の再確認が必要",
};
export default function PortfolioForeignIncome({ projection, view, scopeLabel }: { projection: ForeignIncomeProjection | undefined; view: "graph" | "list"; scopeLabel: string }) {
  const summary = summarizeForeignIncome(projection);
  const rows = projection?.rows ?? [];
  const max = Math.max(0, ...rows.map((row) => foreignRowAmount(row) ?? 0));
  const state = !projection || projection.status === "no_snapshot" ? "保有・配当データは未取得です。" : projection.status === "missing" ? "外国株・ETFの配当表示は準備中です。金額は未確認です。" : projection.status === "error" ? "外国株・ETFの配当データの取得に失敗しました。金額は未確認です。" : projection.status === "incomplete" ? "保有と配当データが一致しないため、金額の表示を保留しています。" : projection.status === "empty" ? "この範囲に対象の外国株・ETFはありません。" : null;
  return <section aria-label="外国株・ETFの参考年間インカム" className={styles.foreignIncome}>
    <h3 style={{ margin: 0, fontSize: 17 }}>外国株・ETFの参考年間インカム</h3>
    <p className={styles.foreignNote}>表示範囲：{scopeLabel}。該当する登録保有・外部参照を含みます。外部参照の業種等は未分類です。MMF・税引後額・実際の受取額は含みません。</p>
    {state ? <p role="status">{state}</p> : <>
      <p style={{ margin: "8px 0" }}>円換算参考額：<strong>{yen(summary.partial)}</strong>{summary.missing ? ` ／ 未確認 ${summary.missing}件を除く` : ""}</p>
      <p className={styles.foreignNote}>ETFは過去12か月の分配実績に基づく参考額、無配は公表方針に基づく見込みです。将来の支払額を保証する予想ではありません。為替は保有基準日時点の登録値です。</p>
      {view === "graph" ? <div style={{ display: "grid", gap: 14 }}>{rows.map((row) => {
        const amount = foreignRowAmount(row);
        return <div key={row.position_id}>
          <div className={styles.dividendBarHeading}><strong>{row.ticker} {row.instrument_name}</strong><strong>{yen(amount)}</strong></div>
          {amount !== null ? <div className={styles.dividendTrack} role="img" aria-label={`${row.ticker}の円換算参考額 ${yen(amount)}`} style={{ marginTop: 6 }}><span style={{ width: `${max > 0 ? amount / max * 100 : 0}%` }} /></div> : null}
          <div className={styles.foreignNote}>{row.portfolio_scope === "external_reference" ? "外部参照" : "登録保有"} ／ {amount === null ? reasons[row.exclusion_reason ?? ""] ?? "配当・為替・数量の確認待ち" : row.income_basis === "no_dividend_policy" ? "公表無配方針に基づく見込み0" : "過去12か月分配実績ベース"} ／ {native(row.native_annual_income, row.native_currency)} ／ 為替日 {date(row.fx_as_of)}</div>
        </div>;
      })}</div> : <div className={styles.foreignTableScroll} tabIndex={0} aria-label="外国株・ETFインカム一覧（横スクロール）"><table className={styles.foreignTable}>
        <thead><tr>{["商品・範囲", "参考額の根拠", "原通貨額", "円換算参考額", "換算レート・基準日", "出典・確認状態"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.position_id}>
          <td><strong>{row.ticker}</strong><br />{row.instrument_name}<br />{row.portfolio_scope === "external_reference" ? "外部参照" : "登録保有"}</td>
          <td>{row.income_basis === "no_dividend_policy" ? "公表無配方針に基づく見込み0" : row.income_basis === "trailing_12_months" ? <>過去12か月分配実績<br />{date(row.period_start)}〜{date(row.period_end)}</> : "未確認"}</td>
          <td>{foreignRowAmount(row) === null ? "—" : native(row.native_annual_income, row.native_currency)}</td><td>{yen(foreignRowAmount(row))}</td>
          <td>{incomeNumber(row.fx_rate) === null ? "—" : `1 ${row.native_currency} = ${row.fx_rate}円`}<br />{date(row.fx_as_of)}<br /><span className={styles.foreignNote}>{row.fx_source}</span></td>
          <td>{foreignRowAmount(row) === null ? reasons[row.exclusion_reason ?? ""] ?? "配当・為替・数量の確認待ち" : "確認済み参考額"}<br />{row.source_url && /^https?:\/\//.test(row.source_url) ? <a href={row.source_url} target="_blank" rel="noopener noreferrer">{row.source_title ?? "出典"}</a> : row.source_title}<br />{date(row.source_as_of)}</td>
        </tr>)}</tbody>
      </table></div>}
    </>}
  </section>;
}
