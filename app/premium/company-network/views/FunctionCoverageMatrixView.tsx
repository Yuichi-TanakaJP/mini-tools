"use client";

import { useMemo } from "react";
import styles from "../CompanyNetwork.module.css";
import functionStyles from "../FunctionViews.module.css";
import type { CompanyFunctionLink, CompanyNetworkCompany } from "../types";

type Props = {
  groupName: string;
  companies: CompanyNetworkCompany[];
  functions: CompanyFunctionLink[];
  focusCompanyId: string;
  query: string;
  onSelectCompany: (companyId: string) => void;
};

export default function FunctionCoverageMatrixView({
  groupName,
  companies,
  functions,
  focusCompanyId,
  query,
  onSelectCompany,
}: Props) {
  const normalized = query.trim().toLocaleLowerCase("ja");
  const companiesSorted = useMemo(
    () => [...companies].sort((a, b) => {
      if (focusCompanyId) {
        if (a.id === focusCompanyId) return -1;
        if (b.id === focusCompanyId) return 1;
      }
      return a.name.localeCompare(b.name, "ja");
    }),
    [companies, focusCompanyId],
  );

  const rows = useMemo(() => {
    const byFunction = new Map<string, CompanyFunctionLink[]>();
    functions.forEach((link) => byFunction.set(link.functionName, [...(byFunction.get(link.functionName) ?? []), link]));
    return [...byFunction.entries()]
      .map(([functionName, links]) => ({
        functionName,
        classificationName: links[0]?.classificationName ?? "その他",
        links,
      }))
      .filter((row) => {
        if (!normalized) return true;
        return [row.functionName, row.classificationName, ...row.links.map((link) => companies.find((company) => company.id === link.companyId)?.name ?? "")]
          .some((value) => value.toLocaleLowerCase("ja").includes(normalized));
      })
      .sort((a, b) => {
        const byClass = a.classificationName.localeCompare(b.classificationName, "ja");
        return byClass !== 0 ? byClass : a.functionName.localeCompare(b.functionName, "ja");
      });
  }, [companies, functions, normalized]);

  const linkByCell = useMemo(() => {
    const result = new Map<string, CompanyFunctionLink>();
    functions.forEach((link) => result.set(`${link.functionName}:${link.companyId}`, link));
    return result;
  }, [functions]);

  if (functions.length === 0) {
    return <p className={`${styles.empty} ${styles.viewFade}`}>{groupName}の事業・機能taxonomyはまだ登録されていません。</p>;
  }

  return (
    <div className={`${functionStyles.matrixView} ${styles.viewFade}`}>
      <div className={styles.viewTools}>
        <span>{groupName} 機能カバレッジ</span>
        <span>{rows.length}領域 × {companiesSorted.length}社</span>
      </div>
      <p className={functionStyles.functionIntro}>行は事業・機能、列は企業です。●は主要機能、○は追加機能。横にスクロールするとグループ内の重なりと空白を比較できます。</p>
      <div className={functionStyles.matrixScroll}>
        <table className={functionStyles.matrixTable}>
          <thead>
            <tr>
              <th className={functionStyles.matrixSticky}>機能</th>
              {companiesSorted.map((company) => (
                <th key={company.id} className={focusCompanyId === company.id ? functionStyles.matrixFocusColumn : undefined}>
                  <button type="button" onClick={() => onSelectCompany(company.id)}>{company.name}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const previousClass = index > 0 ? rows[index - 1].classificationName : null;
              return (
                <tr key={`${row.classificationName}:${row.functionName}`}>
                  <th className={functionStyles.matrixSticky}>
                    {previousClass !== row.classificationName ? <span className={functionStyles.matrixClass}>{row.classificationName}</span> : null}
                    <strong>{row.functionName}</strong>
                  </th>
                  {companiesSorted.map((company) => {
                    const link = linkByCell.get(`${row.functionName}:${company.id}`);
                    return (
                      <td key={company.id} className={focusCompanyId === company.id ? functionStyles.matrixFocusColumn : undefined}>
                        {link ? (
                          <button
                            type="button"
                            className={link.role === "core" ? functionStyles.matrixCore : functionStyles.matrixSupporting}
                            title={`${company.name}: ${row.functionName} (${link.role === "core" ? "主要" : "追加"})`}
                            onClick={() => onSelectCompany(company.id)}
                          >
                            {link.role === "core" ? "●" : "○"}
                          </button>
                        ) : <span className={functionStyles.matrixEmpty}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
