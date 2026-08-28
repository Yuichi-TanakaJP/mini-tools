"use client";

import { useMemo, useState } from "react";
import styles from "../CompanyNetwork.module.css";
import { CATEGORY_LABEL, formatAsOf, relationLabel } from "../presentation";
import type { CompanyRelationship } from "../types";

type SortKey = "source" | "target" | "relation" | "ownership" | "date";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "source", label: "起点企業" },
  { key: "relation", label: "関係" },
  { key: "target", label: "相手企業" },
  { key: "ownership", label: "持株比率" },
  { key: "date", label: "基準日" },
];

type Props = {
  relationships: CompanyRelationship[];
  selectedRelationId: string | null;
  query: string;
  onSelectRelation: (relationId: string) => void;
  onSelectCompany: (companyId: string) => void;
};

export default function TableView({
  relationships,
  selectedRelationId,
  query,
  onSelectRelation,
  onSelectCompany,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("source");
  const [ascending, setAscending] = useState(true);
  const normalized = query.trim().toLocaleLowerCase("ja");

  const visible = useMemo(() => {
    const filtered = relationships.filter((relationship) => {
      if (!normalized) return true;
      return [
        relationship.sourceCompanyName,
        relationship.targetCompanyName,
        relationLabel(relationship.relationType, relationship.ownershipPct),
        relationship.note,
      ].some((value) => value.toLocaleLowerCase("ja").includes(normalized));
    });
    const direction = ascending ? 1 : -1;
    const compare = (a: CompanyRelationship, b: CompanyRelationship) => {
      switch (sortKey) {
        case "target":
          return a.targetCompanyName.localeCompare(b.targetCompanyName, "ja");
        case "relation":
          return relationLabel(a.relationType, a.ownershipPct).localeCompare(relationLabel(b.relationType, b.ownershipPct), "ja");
        case "ownership":
          return (a.ownershipPct ?? -1) - (b.ownershipPct ?? -1);
        case "date":
          return (a.sourceAsOf ?? "").localeCompare(b.sourceAsOf ?? "");
        default:
          return a.sourceCompanyName.localeCompare(b.sourceCompanyName, "ja");
      }
    };
    return [...filtered].sort((a, b) => compare(a, b) * direction || a.relationId.localeCompare(b.relationId));
  }, [ascending, normalized, relationships, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(true);
    }
  };

  if (visible.length === 0) {
    return <p className={`${styles.empty} ${styles.viewFade}`}>条件に一致する企業関係がありません。</p>;
  }

  return (
    <div className={`${styles.tableScroll} ${styles.viewFade}`}>
      <table className={styles.table}>
        <caption>{relationships.length}件の企業関係のうち {visible.length}件を表示</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                className={styles.sortable}
                onClick={() => toggleSort(column.key)}
                aria-sort={sortKey === column.key ? (ascending ? "ascending" : "descending") : "none"}
              >
                {column.label}{sortKey === column.key ? (ascending ? " ▲" : " ▼") : ""}
              </th>
            ))}
            <th>区分</th>
            <th>検証</th>
            <th>根拠</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((relationship) => (
            <tr
              key={relationship.relationId}
              className={selectedRelationId === relationship.relationId ? styles.tableRowSelected : undefined}
              onClick={() => onSelectRelation(relationship.relationId)}
            >
              <td>
                <button type="button" className={styles.tableCompanyButton} onClick={(event) => { event.stopPropagation(); onSelectCompany(relationship.sourceCompanyId); }}>
                  {relationship.sourceCompanyName}
                </button>
              </td>
              <td className={styles.tableRelation}>{relationLabel(relationship.relationType, relationship.ownershipPct)}</td>
              <td>
                <button type="button" className={styles.tableCompanyButton} onClick={(event) => { event.stopPropagation(); onSelectCompany(relationship.targetCompanyId); }}>
                  {relationship.targetCompanyName}
                </button>
              </td>
              <td>{relationship.ownershipPct === null ? "—" : `${relationship.ownershipPct}%`}</td>
              <td>{formatAsOf(relationship.sourceAsOf)}</td>
              <td>{CATEGORY_LABEL[relationship.relationCategory]}</td>
              <td>{relationship.verificationStatus}</td>
              <td className={styles.tableSource}>{relationship.sourceTitle ?? relationship.sourceType ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
