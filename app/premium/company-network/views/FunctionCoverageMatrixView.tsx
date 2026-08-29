"use client";

import { useMemo } from "react";
import styles from "../CompanyNetwork.module.css";
import functionStyles from "../FunctionViews.module.css";
import claudeStyles from "../ClaudeUi.module.css";
import { compareFunction, compareFunctionClass } from "../function-order";
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
  const companiesSorted = useMemo(() => {
    const functionCounts = new Map<string, number>();
    functions.forEach((link) => functionCounts.set(link.companyId, (functionCounts.get(link.companyId) ?? 0) + 1));
    return [...companies].sort((a, b) => {
      if (focusCompanyId) {
        if (a.id === focusCompanyId) return -1;
        if (b.id === focusCompanyId) return 1;
      }
      const countDiff = (functionCounts.get(b.id) ?? 0) - (functionCounts.get(a.id) ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.name.localeCompare(b.name, "ja");
    });
  }, [companies, focusCompanyId, functions]);

  const rows = useMemo(() => {
    const byFunction = new Map<string, CompanyFunctionLink[]>();
    functions.forEach((link) => byFunction.set(link.nodeId, [...(byFunction.get(link.nodeId) ?? []), link]));
    return [...byFunction.values()]
      .map((links) => ({
        functionSlug: links[0].functionSlug,
        functionName: links[0].functionName,
        classificationSlug: links[0].classificationSlug,
        classificationName: links[0].classificationName ?? "その他",
        links,
      }))
      .filter((row) => {
        if (!normalized) return true;
        return [row.functionName, row.classificationName, ...row.links.map((link) => companies.find((company) => company.id === link.companyId)?.name ?? "")]
          .some((value) => value.toLocaleLowerCase("ja").includes(normalized));
      })
      .sort((a, b) => {
        const byClass = compareFunctionClass(a, b);
        return byClass !== 0 ? byClass : compareFunction(a, b);
      });
  }, [companies, functions, normalized]);

  const linkByCell = useMemo(() => {
    const result = new Map<string, CompanyFunctionLink>();
    functions.forEach((link) => result.set(`${link.nodeId}:${link.companyId}`, link));
    return result;
  }, [functions]);

  if (functions.length === 0) {
    return <p className={`${styles.empty} ${styles.viewFade}`}>{groupName}の事業・機能taxonomyはまだ登録されていません。</p>;
  }

  return (
    <div className={`${functionStyles.matrixView} ${claudeStyles.view} ${styles.viewFade}`}>
      <div className={styles.viewTools}>
        <span>{groupName} 機能カバレッジ</span>
        <span>{rows.length}領域 × {companiesSorted.length}社</span>
      </div>
      <div className={`${functionStyles.matrixLegend} ${claudeStyles.legendBar}`}>
        <span><b className={functionStyles.legendCore}>●</b> 主要機能</span>
        <span><b className={functionStyles.legendSupporting}>○</b> 追加機能</span>
        <span>担当機能数が多い企業を左側へ配置</span>
      </div>
      <div className={functionStyles.matrixScrollHint}>← 横スクロールで全社を比較 →</div>
      <div className={`${functionStyles.matrixScroll} ${claudeStyles.matrixScroll}`}>
        <table className={`${functionStyles.matrixTable} ${claudeStyles.matrixTable}`}>
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
              const newClass = previousClass !== row.classificationName;
              return (
                <tr key={`${row.classificationSlug}:${row.functionSlug}`} className={newClass ? functionStyles.matrixClassStart : undefined}>
                  <th className={functionStyles.matrixSticky}>
                    {newClass ? <span className={functionStyles.matrixClass}>{row.classificationName}</span> : null}
                    <strong>{row.functionName}</strong>
                    <small>{new Set(row.links.map((link) => link.companyId)).size}社</small>
                  </th>
                  {companiesSorted.map((company) => {
                    const link = linkByCell.get(`${row.links[0].nodeId}:${company.id}`);
                    return (
                      <td key={company.id} className={focusCompanyId === company.id ? functionStyles.matrixFocusColumn : undefined}>
                        {link ? (
                          <button
                            type="button"
                            className={`${link.role === "core" ? functionStyles.matrixCore : functionStyles.matrixSupporting} ${claudeStyles.matrixCellButton}`}
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
