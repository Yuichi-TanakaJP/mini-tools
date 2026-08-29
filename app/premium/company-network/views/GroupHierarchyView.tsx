"use client";

import { useMemo, type ReactNode } from "react";
import styles from "../CompanyNetwork.module.css";
import relationStyles from "../RelationshipViews.module.css";
import claudeStyles from "../ClaudeUi.module.css";
import { relationLabel } from "../presentation";
import type { CompanyNetworkCompany, CompanyRelationship } from "../types";

const SERIES_TYPES = new Set(["equity_ownership", "parent_of", "controls", "equity_method_investment"]);

type Props = {
  groupName: string;
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  query: string;
  selectedCompanyId: string;
  selectedRelationId: string | null;
  onSelectCompany: (companyId: string) => void;
  onSelectRelation: (relationId: string) => void;
};

export default function GroupHierarchyView({
  groupName,
  companies,
  relationships,
  query,
  selectedCompanyId,
  selectedRelationId,
  onSelectCompany,
  onSelectRelation,
}: Props) {
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const normalized = query.trim().toLocaleLowerCase("ja");
  const seriesRelationships = useMemo(
    () => relationships.filter((relationship) => SERIES_TYPES.has(relationship.relationType)),
    [relationships],
  );

  const treeModel = useMemo(() => {
    const children = new Map<string, CompanyRelationship[]>();
    const sourceIds = new Set<string>();
    const targetIds = new Set<string>();

    seriesRelationships.forEach((relationship) => {
      sourceIds.add(relationship.sourceCompanyId);
      targetIds.add(relationship.targetCompanyId);
      children.set(relationship.sourceCompanyId, [...(children.get(relationship.sourceCompanyId) ?? []), relationship]);
    });

    for (const [sourceId, links] of children) {
      children.set(sourceId, [...links].sort((a, b) => a.targetCompanyName.localeCompare(b.targetCompanyName, "ja")));
    }

    const rootIds = [...sourceIds].filter((id) => !targetIds.has(id));
    const visitedRelations = new Set<string>();
    const markReachable = (companyId: string, path: Set<string>) => {
      for (const relationship of children.get(companyId) ?? []) {
        if (visitedRelations.has(relationship.relationId)) continue;
        visitedRelations.add(relationship.relationId);
        if (!path.has(relationship.targetCompanyId)) {
          markReachable(relationship.targetCompanyId, new Set([...path, relationship.targetCompanyId]));
        }
      }
    };

    rootIds.forEach((rootId) => markReachable(rootId, new Set([rootId])));
    seriesRelationships.forEach((relationship) => {
      if (visitedRelations.has(relationship.relationId)) return;
      if (!rootIds.includes(relationship.sourceCompanyId)) rootIds.push(relationship.sourceCompanyId);
      markReachable(relationship.sourceCompanyId, new Set([relationship.sourceCompanyId]));
    });

    return { children, rootIds };
  }, [seriesRelationships]);

  if (seriesRelationships.length === 0) {
    return (
      <div className={`${claudeStyles.view} ${styles.viewFade}`}>
        <p className={`${styles.seriesIntro} ${claudeStyles.hierarchyIntro}`}><strong>{groupName}</strong>の所属企業は確認済みですが、グループ内の資本・支配関係はまだ登録されていません。</p>
      </div>
    );
  }

  const renderChildren = (companyId: string, path: Set<string>): ReactNode => {
    const links = treeModel.children.get(companyId) ?? [];
    if (links.length === 0) return null;

    return (
      <div className={relationStyles.treeChildren}>
        {links.map((relationship) => {
          const target = companyById.get(relationship.targetCompanyId);
          if (!target) return null;
          const cycle = path.has(target.id);
          const dimmed = normalized.length > 0 && ![
            relationship.sourceCompanyName,
            relationship.targetCompanyName,
            relationLabel(relationship.relationType, relationship.ownershipPct),
          ].some((value) => value.toLocaleLowerCase("ja").includes(normalized));
          const selected = selectedCompanyId === target.id;
          const relationSelected = selectedRelationId === relationship.relationId;

          return (
            <div key={relationship.relationId} className={`${relationStyles.treeBranch} ${dimmed ? relationStyles.treeBranchDim : ""}`}>
              <div className={`${relationStyles.treeNode} ${claudeStyles.hierarchyNode} ${selected ? relationStyles.treeNodeSelected : ""}`}>
                <button type="button" className={`${relationStyles.treeCompany} ${claudeStyles.hierarchyCompany}`} onClick={() => onSelectCompany(target.id)} aria-pressed={selected}>
                  <strong>{target.name}</strong>
                </button>
                <button
                  type="button"
                  className={`${relationStyles.treeRelation} ${claudeStyles.hierarchyRelation} ${relationSelected ? relationStyles.treeRelationActive : ""}`}
                  onClick={() => onSelectRelation(relationship.relationId)}
                  aria-pressed={relationSelected}
                >
                  {relationLabel(relationship.relationType, relationship.ownershipPct)}
                </button>
              </div>
              {cycle ? <p className={relationStyles.treeCycle}>循環参照のため、ここで展開を止めています。</p> : renderChildren(target.id, new Set([...path, target.id]))}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`${claudeStyles.view} ${styles.viewFade}`}>
      <p className={`${styles.seriesIntro} ${claudeStyles.hierarchyIntro}`}><strong>{groupName}</strong>内の出資・親会社・支配・持分法関係だけを資本ツリーとして表示します。グループ所属は親子関係に含めません。</p>
      <div className={relationStyles.treeForest}>
        {treeModel.rootIds.map((rootId, treeIndex) => {
          const root = companyById.get(rootId);
          if (!root) return null;
          return (
            <section key={`${rootId}:${treeIndex}`} className={`${relationStyles.treeSection} ${claudeStyles.hierarchySection}`}>
              <button type="button" className={`${relationStyles.treeRoot} ${claudeStyles.hierarchyRoot}`} onClick={() => onSelectCompany(root.id)} aria-pressed={selectedCompanyId === root.id}>
                <span>ROOT</span>
                <strong>{root.name}</strong>
                <small>確認済み資本・支配構造の起点</small>
              </button>
              {renderChildren(root.id, new Set([root.id]))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
