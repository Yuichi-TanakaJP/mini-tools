import type { Metadata } from "next";
import Link from "@/components/navigation/Link";
import { DEBT_LABELS, loadScreening, PAGE_SIZE, SCREEN_PATH, screenHref, type ScreenFilters } from "./data";
import styles from "./screening.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "FCF・開示負債 | 銘柄分析ダッシュボード",
  robots: { index: false, follow: false },
};

const money = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 6 });

function FilterForm({ filters }: { filters: ScreenFilters }) {
  return (
    <form action={SCREEN_PATH} method="get" className={styles.filters}>
      <label>
        FCF下限（百万円）
        <input name="minFcf" inputMode="decimal" maxLength={17} defaultValue={filters.minFcf} />
      </label>
      <label>
        開示負債上限（百万円）
        <input name="maxDebt" inputMode="decimal" maxLength={16} defaultValue={filters.maxDebt} />
      </label>
      <button type="submit">絞り込む</button>
      <Link href="/tools/stock-notes/screening" prefetch={false}>条件をクリア</Link>
    </form>
  );
}

export default async function ScreeningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadScreening(await searchParams);
  return (
    <main className={styles.main}>
      <Link href="/tools/stock-notes" prefetch={false}>← 銘柄分析ダッシュボード</Link>
      <header>
        <h1>FCF・開示負債</h1>
        <p>同じEDINET年次提出から確認できたFCFと、借入・社債・リースの開示残高を比較します。</p>
      </header>
      {result.state === "unauthorized" ? (
        <p>銘柄を確認するには <Link href="/account">ログイン</Link>してください。</p>
      ) : result.state === "unavailable" ? (
        <p role="status">この環境ではスクリーニングを利用できません。</p>
      ) : "filters" in result ? (
        <>
          <FilterForm key={screenHref(result.filters, "")} filters={result.filters} />
          {result.state === "invalid" ? (
            <p role="alert">
              金額は整数9桁、小数6桁以内で入力してください。開示負債上限は0以上です。
              ページ指定が無効な場合は条件をクリアしてください。
            </p>
          ) : result.state === "failed" ? (
            <p role="alert">
              データを取得できませんでした。 <a href={screenHref(result.filters)}>再読み込み</a>
            </p>
          ) : result.rows.length === 0 ? (
            <p role="status">
              {result.filters.minFcf || result.filters.maxDebt || result.filters.after
                ? "この条件で表示できる銘柄はありません。"
                : "表示できる銘柄はありません。"}
            </p>
          ) : (
            <>
              <p className={styles.summary}>証券コード順 · {result.rows.length}銘柄を表示 · 1ページ{PAGE_SIZE}件</p>
              <div className={styles.tableWrap} role="region" aria-label="財務スクリーニング結果" tabIndex={0}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">証券コード</th>
                      <th scope="col">期末</th>
                      <th scope="col">FCF（百万円）</th>
                      <th scope="col">開示負債（百万円）</th>
                      <th scope="col">負債の根拠</th>
                      <th scope="col">EDINET書類</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.jpx_code}>
                        <th scope="row">{row.jpx_code}</th>
                        <td>{row.period_end}</td>
                        <td className={styles.numeric}>{money.format(row.fcf_jpy_million)}</td>
                        <td className={styles.numeric}>{money.format(row.disclosed_debt_jpy_million)}</td>
                        <td>{DEBT_LABELS[row.debt_basis]}</td>
                        <td>{row.edinet_doc_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {result.state === "ready" && (result.filters.after || result.next) && (
            <nav className={styles.navigation} aria-label="結果のページ送り">
              {result.filters.after && <Link href={screenHref(result.filters, "")} prefetch={false}>先頭へ</Link>}
              {result.next && <Link href={screenHref(result.filters, result.next)} prefetch={false}>次のページ</Link>}
            </nav>
          )}
        </>
      ) : null}
    </main>
  );
}
