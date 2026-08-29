"use client";

import { useMemo } from "react";
import styles from "../CompanyNetwork.module.css";
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

function listingLabel(value: string) {
  if (value === "domestic_listed") return "上場";
  if (value === "foreign_listed") return "海外上場";
  if (value === "private") return "非上場";
  return "未確認";
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
  const clusters = useMemo(() => {
    const byClassification = new Map<string, Map<string, CompanyFunctionLink[]>>();
    functions.forEach((link) => {
      const className = link.classificationName ?? "その他";
      const functionsInClass = byClassification.get(className) ?? new Map<string, CompanyFunctionLink[]>();
      functionsInClass.set(link.functionName, [...(functionsInClass.get(link.functionName) ?? []), link]);
      byClassification.set(className, functionsInClass);
    });

    return [...byClassification.entries()]
      .map(([classificationName, functionMap]) => ({
        classificationName,
        functions: [...functionMap.entries()]
          .map(([functionName, links]) => ({ functionName, links }))
          .sort((a, b) => a.functionName.localeCompare(b.functionName, "ja")),
      }))
      .sort((a, b) => a.classificationName.localeCompare(b.classificationName, "ja"));
  }, [functions]);

  const unmapped = companies.filter((company) => !mappedCompanyIds.has(company.id));
  const selectedCompanyId = selection?.kind === "company" ? selection.id : "";

  if (functions.length === 0) {
    return (
      <div className={`${styles.functionView} ${styles.viewFade}`}>
        <p className={styles.seriesIntro}><strong>{groupName}</strong>には所属企業がありますが、事業・機能taxonomyがまだ登録されていません。</p>
      </div>
    );
  }

  return (
    <div className={`${styles.functionView} ${styles.viewFade}`}>
      <div className={styles.viewTools}>
        <span>{groupName}の事業・機能構成</span>
        <span>{mappedCompanyIds.size}/{companies.length}社 · {functions.length}機能リンク</span>
      </div>
      <p className={styles.functionIntro}>企業を単純に並べず、公式情報から確認した「何を担う会社か」でまとめています。濃いバッジは主要機能、薄いバッジは追加機能です。</p>

      <div className={styles.functionClusterGrid}>
        {clusters.map((cluster, clusterIndex) => {
          const classLinks = cluster.functions.flatMap((item) => item.links);
          const classCompanyCount = new Set(classLinks.map((link) => link.companyId)).size;
          return (
            <section key={cluster.classificationName} className={`${styles.functionCluster} ${styles[`functionTone${clusterIndex % 5}`] ?? ""}`}>
              <header className={styles.functionClusterHead}>
                <div><span>FUNCTION CLASS</span><h3>{cluster.classificationName}</h3></div>
                <strong>{classCompanyCount}社</strong>
              </header>

              <div className={styles.functionRows}>
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
                    <div key={item.functionName} className={styles.functionRow}>
                      <div className={styles.functionRowHead}>
                        <strong>{item.functionName}</strong>
                        <span>{visibleLinks.length}社</span>
                      </div>
                      <div className={styles.functionCompanies}>
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
                                className={`${styles.functionCompany} ${link.role === "core" ? styles.functionCompanyCore : styles.functionCompanySupporting} ${selected ? styles.functionCompanySelected : ""}`}
                                onClick={() => onSelectCompany(company.id)}
                              >
                                <strong>{company.name}</strong>
                                <span>{listingLabel(company.listingStatus)}</span>
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
        <section className={styles.unmappedBox}>
          <div><strong>機能未分類</strong><span>{unmapped.length}社</span></div>
          <p>{unmapped.map((company) => company.name).join(" / ")}</p>
        </section>
      ) : null}
    </div>
  );
}
