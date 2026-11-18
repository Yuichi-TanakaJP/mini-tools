"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnnualRow = {
  fiscal_period_end: string;
  original_doc_id: string;
  correction_doc_id: string;
  sales: number | null;
  operating_income: number | null;
  operating_cash_flow: number | null;
};

const metrics = [
  ["sales", "売上高"],
  ["operating_income", "営業損益"],
  ["operating_cash_flow", "営業キャッシュフロー"],
] as const;

const yen = new Intl.NumberFormat("ja-JP");
const cell = { padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" } as const;

export default function AnnualCorrectionPanel({ db }: { db: SupabaseClient }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ code: string; rows: AnnualRow[] } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const ticker = code.trim().toUpperCase();
    setResult(null);
    setError("");
    if (!/^[0-9A-Z]{4}$/.test(ticker)) {
      setError("証券コードを半角4文字で入力してください。");
      return;
    }
    setPending(true);
    try {
      const { data, error: fetchError } = await db.rpc("stock_notes_annual_corrected_financials", {
        p_sec_code: ticker + "0",
      });
      if (fetchError || !Array.isArray(data)) throw new Error("annual financials unavailable");
      setResult({ code: ticker, rows: data });
    } catch {
      setError(ticker + "の年次財務を取得できませんでした。もう一度表示してください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="stock-notes-annual-heading">
      <h2 id="stock-notes-annual-heading">年次財務の訂正値</h2><p>元の有報から変更された値を表示します。— は変更が確認できた値がない欄です。</p>
      <form onSubmit={load}>
        <label>
          証券コード{" "}
          <input value={code} disabled={pending} maxLength={4} onChange={(event) => setCode(event.target.value)} />
        </label>{" "}
        <button type="submit" disabled={pending}>表示</button>
      </form>
      {pending && <p role="status">読み込み中…</p>}
      {error && <p role="alert">{error}</p>}
      {result && result.rows.length === 0 && <p role="status">{result.code}の表示対象となる訂正値はありません。</p>}
      {result && result.rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>{result.code}の訂正後の連結財務（円）</caption>
            <thead>
              <tr>
                <th scope="col">決算期末</th>
                {metrics.map(([key, title]) => <th key={key} scope="col">{title}</th>)}
                <th scope="col">元の有報ID</th>
                <th scope="col">訂正報告書ID</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.fiscal_period_end}>
                  <th scope="row" style={cell}>{row.fiscal_period_end}</th>
                  {metrics.map(([key]) => <td key={key} style={cell}>{row[key] === null ? "—" : yen.format(row[key])}</td>)}
                  <td style={cell}>{row.original_doc_id}</td>
                  <td style={cell}>{row.correction_doc_id}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{result.rows.length}期合計</th>
                {metrics.map(([key]) => {
                  let total = BigInt(0);
                  for (const row of result.rows) {
                    if (row[key] === null || !Number.isSafeInteger(row[key])) {
                      return <td key={key} style={cell}>—</td>;
                    }
                    total += BigInt(row[key]);
                  }
                  return <td key={key} style={cell}>{yen.format(total)}</td>;
                })}
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
