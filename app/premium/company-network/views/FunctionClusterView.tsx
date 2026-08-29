"use client";

import { useMemo } from "react";
import styles from "../CompanyNetwork.module.css";
import functionStyles from "../FunctionViews.module.css";
import { compareFunction, compareFunctionClass } from "../function-order";
import type {
  CompanyFunctionLink,
  CompanyNetworkCompany,
  CompanyNetworkNodeSelection,
  CompanyRelationship,
} from "../types";

type Props = {
  groupName: string;
  companies: CompanyNetworkCompany[];
  functions: CompanyFunctionLink[];
  relationships: CompanyRelationship[];
  selection: CompanyNetworkNodeSelection | null;
  focusCompanyId: string;
  query: string;
  onSelectCompany: (companyId: string) => void;
};

function listingLabel(company: CompanyNetworkCompany) {
  const ticker = company.ticker ? ` ${company.ticker}` : "";
  if (company.listingStatus === "domestic_listed") return `上場${ticker}`;
  if (company.listingStatus === "foreign_listed") return `海外上場${ticker}`;
  if (company.listingStatus === "private") return "非上場";
  return "上場区分未確認";
}

export default function FunctionClusterView({
  groupName,
  companies,
  functions,
  relationships,
  selection,
  focusCompanyId,
  query,
  onSelectCompany,
}: Props) {
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const normalized = query.trim().toLocaleLowerCase("ja");

  const whollyOwnedBy = useMemo(() => {
    const result = new Map<string, string>();
    relationships.forEach((relationship) => {
      if (relationship.relationType === "equity_ownership" && relationship.ownershipPct === 100) {
        result.set(relationship.targetCompanyId, relationship.sourceCompanyName);
      }
    });
    return result;
  }, [relationships]);

  const mappedCompanyIds = useMemo(() => new Set(functions.map((link) => link.companyId)), [functions]);
  const multiFunctionCompanies = useMemo(() => {
    const counts = new Map<string, number>();
    functions.forEach((link) => counts.set(link.companyId, (counts.get(link.companyId) ?? 0) + 1));
    return [...counts.values()].filter((count) => count > 1).length;
  }, [functions]);

  const clusters = useMemo(() => {
    const byClassification = new Map<string, { slug: string | null; links: CompanyFunctionLink[] }>();
    functions.forEach((link) => {
      const key = link.classificationId ?? "other";
      const current = byClassification.get(key) ?? { slug: link.classificationSlug, links: [] };
      current.links.push(link);
      byClassification.set(key, current);
    });

    return [...byClassification.entries()]
      .map(([classificationId, value]) => {
        const functionMap = new Map<string, CompanyFunctionLink[]>();
        value.links.forEach((link) => functionMap.set(link.nodeId, [...(functionMap.get(link.nodeId) ?? []), link]));
        const first = value.links[0];
        return {
          classificationId,
          classificationSlug: value.slug,
          classificationName: first?.classificationName ?? "その他",
          functions: [...functionMap.values()]
            .map((links) => ({ functionSlug: links[0].functionSlug, functionName: links[0].functionName, links }))
            .sort(compareFunction),
        };
      })
      .sort(compareFunctionClass);
  }, [functions]);

  const unmapped = companies.filter((company) => !mappedCompanyIds.has(company.id));
  const selectedCompanyId = selection?.kind === "company" ? selection.id : "";

  if (functions.length === 0) {
    return (
      <div className={`${functionStyles.functionView} ${styles.viewFade}`}>
        <p className={styles.seriesIntro}><strong>{groupName}</strong>には所属企業がありますが、事業・機能taxonomyがまだ登録されていません。</p>
      </div>
    );
  }

  return (
    <div className={`${functionStyles.functionView} ${styles.viewFade}`}>
      <div className={styles.viewTools}>
        <span>{groupName}の事業・機能構成</span>
        <span>{mappedCompanyIds.size}/{companies.length}社 · {functions.length}機能リンク</span>
      </div>
      <p className={functionStyles.functionIntro}>企業名簿ではなく「何を担う会社か」で整理しています。同じ会社が複数領域に現れる場合、それは複数の公式事業機能を持つことを示します。</p>
      <div className={functionStyles.functionSummary}>
        <div><strong>{clusters.length}</strong><span>大分類</span></div>
        <div><strong>{new Set(functions.map((link) => link.nodeId)).size}</strong><span>機能領域</span></div>
        <div><strong>{multiFunctionCompanies}</strong><span>複数機能を担う企業</span></div>
        <div><strong>{relationships.filter((relationship) => relationship.relationType === "equity_ownership" && relationship.ownershipPct === 100).length}</strong><span>100%出資関係</span></div>
      </div>

      <div className={functionStyles.functionClusterGrid}>
        {clusters.map((cluster, clusterIndex) => {
          const classLinks = cluster.functions.flatMap((item) => item.links);
          const classCompanyCount = new Set(classLinks.map((link) => link.companyId)).size;
          const coreCount = classLinks.filter((link) => link.role === "core").length;
          const toneClass = functionStyles[`functionTone${clusterIndex % 6}`] ?? "";
          return (
            <section key={cluster.classificationId} className={`${functionStyles.functionCluster} ${toneClass}`}>
              <header className={functionStyles.functionClusterHead}>
                <div><span>FUNCTION CLASS</span><h3>{cluster.classificationName}</h3><small>{cluster.functions.length}領域 · 主要機能 {coreCount}件</small></div>
                <strong>{classCompanyCount}社</strong>
              </header>

              <div className={functionStyles.functionRows}>
                {cluster.functions.map((item) => {
                  const visibleLinks = item.links.filter((link) => {
                    if (focusCompanyId && link.companyId !== focusCompanyId) return false;
                    if (!normalized) return true;
                    const company = companyById.get(link.companyId);
                    return [cluster.classificationName, item.functionName, company?.name ?? ""]
                      .some((value) => value.toLocaleLowerCase("ja").includes(normalized));
                  });
                  if (visibleLinks.length === 0) return null;
                  return (
                    <div key={item.functionSlug} className={functionStyles.functionRow}>
                      <div className={functionStyles.functionRowHead}>
                        <strong>{item.functionName}</strong>
                        <span>{new Set(visibleLinks.map((link) => link.companyId)).size}社</span>
                      </div>
                      <div className={functionStyles.functionCompanies}>
                        {visibleLinks
                          .sort((a, b) => {
                            if (a.role === "core" && b.role !== "core") return -1;
                            if (a.role !== "core" && b.role === "core") return 1;
                            return (companyById.get(a.companyId)?.name ?? "").localeCompare(companyById.get(b.companyId)?.name ?? "", "ja");
                          })
                          .map((link) => {
                            const company = companyById.get(link.companyId);
                            if (!company) return null;
                            const whollyOwnedParent = whollyOwnedBy.get(company.id);
                            const selected = selectedCompanyId === company.id;
                            return (
                              <button
                                key={link.linkId}
                                type="button"
                                className={`${functionStyles.functionCompany} ${link.role === "core" ? functionStyles.functionCompanyCore : functionStyles.functionCompanySupporting} ${selected ? functionStyles.functionCompanySelected : ""}`}
                                onClick={() => onSelectCompany(company.id)}
                              >
                                <strong>{company.name}</strong>
                                <span>{link.role === "core" ? "主要機能" : "追加機能"}</span>
                                <small>{listingLabel(company)}</small>
                                {whollyOwnedParent ? <small>{whollyOwnedParent} 100%出資</small> : null}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {unmapped.length > 0 ? (
        <section className={functionStyles.unmappedBox}>
          <div><strong>機能未分類</strong><span>{unmapped.length}社</span></div>
          <p>{unmapped.map((company) => company.name).join(" / ")}</p>
        </section>
      ) : null}
    </div>
  );
}
