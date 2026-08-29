"use client";

import { useMemo } from "react";
import styles from "../CompanyNetwork.module.css";
import { relationLabel } from "../presentation";
import type { CompanyNetworkCompany, CompanyRelationship } from "../types";

const SERIES_TYPES = new Set(["equity_ownership", "parent_of", "controls", "equity_method_investment"]);

type TreeRow = {
  relationship: CompanyRelationship;
  depth: number;
};

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

  const forest = useMemo(() => {
    const children = new Map<string, CompanyRelationship[]>();
    const sourceIds = new Set<string>();
    const targetIds = new Set<string>();
    seriesRelationships.forEach((relationship) => {
      sourceIds.add(relationship.sourceCompanyId);
      targetIds.add(relationship.targetCompanyId);
      children.set(relationship.sourceCompanyId, [...(children.get(relationship.sourceCompanyId) ?? []), relationship]);
    });
    const roots = [...sourceIds].filter((id) => !targetIds.has(id));
    const rootIds = roots.length > 0 ? roots : [...sourceIds].slice(0, 1);
    const used = new Set<string>();

    const walk = (companyId: string, depth: number, path: Set<string>, rows: TreeRow[]) => {
      for (const relationship of children.get(companyId) ?? []) {
        if (used.has(relationship.relationId)) continue;
        used.add(relationship.relationId);
        rows.push({ relationship, depth });
        if (!path.has(relationship.targetCompanyId)) {
          walk(relationship.targetCompanyId, depth + 1, new Set([...path, relationship.targetCompanyId]), rows);
        }
      }
    };

    const trees = rootIds.map((rootId) => {
      const rows: TreeRow[] = [];
      walk(rootId, 1, new Set([rootId]), rows);
      return { rootId, rows };
    });

    const leftovers = seriesRelationships.filter((relationship) => !used.has(relationship.relationId));
    if (leftovers.length > 0) {
      const rows = leftovers.map((relationship) => ({ relationship, depth: 1 }));
      trees.push({ rootId: leftovers[0].sourceCompanyId, rows });
    }
    return trees;
  }, [seriesRelationships]);

  if (seriesRelationships.length === 0) {
    return (
      <div className={`${styles.seriesView} ${styles.viewFade}`}>
        <p className={styles.seriesIntro}><strong>{groupName}</strong>の所属企業は確認済みですが、グループ内の資本・支配関係はまだ登録されていません。表示不具合ではなく、企業間relationのデータが未登録です。</p>
      </div>
    );
  }

  return (
    <div className={`${styles.seriesView} ${styles.viewFade}`}>
      <p className={styles.seriesIntro}><strong>{groupName}</strong>内で確認済みの出資・親会社・支配・持分法関係を、グループ全体の系列として表示します。グループ所属そのものは親子関係として扱いません。</p>
      {forest.map((tree, treeIndex) => {
        const root = companyById.get(tree.rootId);
        if (!root) return null;
        return (
          <section key={`${tree.rootId}:${treeIndex}`} className={styles.seriesSection}>
            <button type="button" className={styles.seriesCenter} onClick={() => onSelectCompany(root.id)}>
              <span>ROOT</span><strong>{root.name}</strong><small>確認済み資本構造の起点</small>
            </button>
            <div className={styles.seriesRows}>
              {tree.rows.map(({ relationship, depth }) => {
                const target = companyById.get(relationship.targetCompanyId);
                if (!target) return null;
                const dimmed = normalized.length > 0 && ![relationship.sourceCompanyName, relationship.targetCompanyName]
                  .some((value) => value.toLocaleLowerCase("ja").includes(normalized));
                return (
                  <div key={relationship.relationId} className={`${styles.seriesRow} ${dimmed ? styles.seriesRowDim : ""}`} style={{ marginLeft: Math.min(depth - 1, 4) * 18 }}>
                    <button type="button" className={styles.seriesCompany} onClick={() => onSelectCompany(target.id)} aria-pressed={selectedCompanyId === target.id}>
                      <span className={styles.seriesDepth}>L{depth}</span><strong>{target.name}</strong>
                    </button>
                    <button type="button" className={`${styles.seriesRelation} ${selectedRelationId === relationship.relationId ? styles.seriesRelationActive : ""}`} onClick={() => onSelectRelation(relationship.relationId)}>
                      <span>{relationship.sourceCompanyName} → {relationship.targetCompanyName}</span>
                      <strong>{relationLabel(relationship.relationType, relationship.ownershipPct)}</strong>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}