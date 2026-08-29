"use client";

import { useMemo } from "react";
import styles from "../CompanyNetwork.module.css";
import { formatAsOf, groupTypeLabel } from "../presentation";
import type {
  CompanyGroupMembership,
  CompanyNetworkCompany,
  CompanyNetworkGroup,
  CompanyNetworkNodeSelection,
  CompanyRelationship,
} from "../types";

type Props = {
  group: CompanyNetworkGroup;
  companies: CompanyNetworkCompany[];
  memberships: CompanyGroupMembership[];
  relationships: CompanyRelationship[];
  selection: CompanyNetworkNodeSelection | null;
  query: string;
  onSelectCompany: (companyId: string) => void;
};

export default function GroupTableView({
  group,
  companies,
  memberships,
  relationships,
  selection,
  query,
  onSelectCompany,
}: Props) {
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const relationCountByCompany = useMemo(() => {
    const counts = new Map<string, number>();
    relationships.forEach((relationship) => {
      counts.set(relationship.sourceCompanyId, (counts.get(relationship.sourceCompanyId) ?? 0) + 1);
      counts.set(relationship.targetCompanyId, (counts.get(relationship.targetCompanyId) ?? 0) + 1);
    });
    return counts;
  }, [relationships]);
  const normalized = query.trim().toLocaleLowerCase("ja");
  const visible = useMemo(
    () => memberships
      .filter((membership) => membership.groupId === group.id)
      .filter((membership) => {
        if (!normalized) return true;
        return [membership.companyName, membership.membershipRole, membership.membershipBasis]
          .some((value) => value.toLocaleLowerCase("ja").includes(normalized));
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja")),
    [group.id, memberships, normalized],
  );

  if (visible.length === 0) {
    return <p className={`${styles.empty} ${styles.viewFade}`}>条件に一致するグループ所属企業がありません。</p>;
  }

  return (
    <div className={`${styles.tableScroll} ${styles.viewFade}`}>
      <table className={styles.table}>
        <caption>{group.name}（{groupTypeLabel(group.groupType)}）の所属 {visible.length}社を表示</caption>
        <thead>
          <tr>
            <th>企業</th>
            <th>上場区分</th>
            <th>role</th>
            <th>membership basis</th>
            <th>グループ内関係</th>
            <th>検証</th>
            <th>基準日</th>
            <th>根拠</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((membership) => {
            const company = companyById.get(membership.companyId);
            const selected = selection?.kind === "company" && selection.id === membership.companyId;
            return (
              <tr
                key={membership.membershipId}
                className={selected ? styles.tableRowSelected : undefined}
                onClick={() => onSelectCompany(membership.companyId)}
              >
                <td>
                  <button type="button" className={styles.tableCompanyButton} onClick={(event) => { event.stopPropagation(); onSelectCompany(membership.companyId); }}>
                    {membership.companyName}
                  </button>
                </td>
                <td>{company?.listingStatus || "—"}</td>
                <td>{membership.membershipRole || "—"}</td>
                <td>{membership.membershipBasis || "—"}</td>
                <td>{relationCountByCompany.get(membership.companyId) ?? 0}件</td>
                <td>{membership.verificationStatus}</td>
                <td>{formatAsOf(membership.sourceAsOf)}</td>
                <td className={styles.tableSource}>{membership.sourceTitle ?? membership.sourceType ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
