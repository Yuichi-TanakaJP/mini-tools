"use client";

import { useMemo } from "react";
import styles from "../CompanyNetwork.module.css";
import functionStyles from "../FunctionViews.module.css";
import claudeStyles from "../ClaudeUi.module.css";
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
  const whollyOwnedCount = relationships.filter(
    (relationship) => relationship.relationType === "equity_ownership" && relationship.ownershipPct === 100,
  ).length;
  const functionAreaCount = new Set(functions.map((link) => link.nodeId)).size;

  if (functions.length === 0) {
    return (
      <div className={`${claudeStyles.view} ${styles.viewFade}`}>
        <p className={claudeStyles.compactIntro}><strong>{groupName}</strong>には所属企業がありますが、事業・機能taxonomyがまだ登録されていません。</p>
      </div>
    );
  }

  return (
    <div className={`${claudeStyles.view} ${styles.viewFade}`}>
      <div className={styles.viewTools}>
        <span>{groupName}の事業・機能構成</span>
        <span>{mappedCompanyIds.size}/{companies.length}社 · {functions.length}機能リンク</span>
      </div>
      <p className={claudeStyles.compactIntro}>グループ → 大分類 → 機能領域 → 企業の順でたどれます。複数領域に現れる企業は、複数の公式事業機能を持つことを示します。</p>

      <div className={claudeStyles.summaryStrip} aria-label="構成サマリー">
        <div className={claudeStyles.summaryStat}><strong>{clusters.length}</strong><span>大分類</span></div>
        <div className={claudeStyles.summaryStat}><strong>{functionAreaCount}</strong><span>機能領域</span></div>
        <div className={claudeStyles.summaryStat}><strong>{multiFunctionCompanies}</strong><span>複数機能企業</span></div>
        <div className={claudeStyles.summaryStat}><strong>{whollyOwnedCount}</strong><span>100%出資</span></div>
      </div>

      <div className={claudeStyles.functionTree}>
        <details className={claudeStyles.treeRoot} open>
          <summary className={claudeStyles.treeRootSummary}>
            <span className={claudeStyles.chevron}>▶</span>
            <span className={claudeStyles.treeTitle}>{groupName}</span>
            <span className={claudeStyles.treeMeta}>{mappedCompanyIds.size}社</span>
          </summary>

          {clusters.map((cluster, clusterIndex) => {
            const visibleFunctions = cluster.functions
              .map((item) => ({
                ...item,
                visibleLinks: item.links.filter((link) => {
                  if (focusCompanyId && link.companyId !== focusCompanyId) return false;
                  if (!normalized) return true;
                  const company = companyById.get(link.companyId);
                  return [cluster.classificationName, item.functionName, company?.name ?? ""]
                    .some((value) => value.toLocaleLowerCase("ja").includes(normalized));
                }),
              }))
              .filter((item) => item.visibleLinks.length > 0);

            if (visibleFunctions.length === 0) return null;
            const classLinks = visibleFunctions.flatMap((item) => item.visibleLinks);
            const classCompanyCount = new Set(classLinks.map((link) => link.companyId)).size;
            const toneClass = claudeStyles[`treeTone${clusterIndex % 6}`] ?? "";

            return (
              <details key={cluster.classificationId} className={`${claudeStyles.treeClass} ${toneClass}`} open>
                <summary className={claudeStyles.treeClassSummary}>
                  <span className={claudeStyles.chevron}>▶</span>
                  <span className={claudeStyles.treeTitle}><span className={claudeStyles.classDot} /> {cluster.classificationName}</span>
                  <span className={claudeStyles.treeMeta}>{classCompanyCount}社 · {visibleFunctions.length}領域</span>
                </summary>

                {visibleFunctions.map((item) => {
                  const sortedLinks = [...item.visibleLinks].sort((a, b) => {
                    if (a.role === "core" && b.role !== "core") return -1;
                    if (a.role !== "core" && b.role === "core") return 1;
                    return (companyById.get(a.companyId)?.name ?? "").localeCompare(companyById.get(b.companyId)?.name ?? "", "ja");
                  });
                  const companyCount = new Set(sortedLinks.map((link) => link.companyId)).size;

                  return (
                    <details key={item.functionSlug} className={claudeStyles.treeFunction} open>
                      <summary className={claudeStyles.treeFunctionSummary}>
                        <span className={claudeStyles.chevron}>▶</span>
                        <span className={claudeStyles.treeTitle}>{item.functionName}</span>
                        <span className={claudeStyles.treeMeta}>{companyCount}社</span>
                      </summary>

                      <div className={claudeStyles.companyTreeList}>
                        {sortedLinks.map((link) => {
                          const company = companyById.get(link.companyId);
                          if (!company) return null;
                          const whollyOwnedParent = whollyOwnedBy.get(company.id);
                          const selected = selectedCompanyId === company.id;
                          return (
                            <button
                              key={link.linkId}
                              type="button"
                              className={`${claudeStyles.companyTreeRow} ${selected ? claudeStyles.companyTreeRowSelected : ""}`}
                              onClick={() => onSelectCompany(company.id)}
                            >
                              <span className={`${claudeStyles.roleDot} ${link.role === "core" ? "" : claudeStyles.roleDotSupporting}`} />
                              <span className={claudeStyles.companyTreeName}>{company.name}</span>
                              <span className={claudeStyles.companyTreeMeta}>
                                <span>{listingLabel(company)}</span>
                                {whollyOwnedParent ? <span className={claudeStyles.companyTreeRelation}>{whollyOwnedParent} 100%</span> : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </details>
            );
          })}
        </details>
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
