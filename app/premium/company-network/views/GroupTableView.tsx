"use client";

import { useMemo, useState } from "react";
import styles from "../CompanyNetwork.module.css";
import { formatAsOf, relationLabel } from "../presentation";
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
  selectedRelationId: string | null;
  focusCompanyId: string;
  query: string;
  onSelectCompany: (companyId: string) => void;
  onSelectRelation: (relationId: string) => void;
};

type TableMode = "companies" | "relations";

function listingLabel(value: string) {
  if (value === "domestic_listed") return "上場";
  if (value === "foreign_listed") return "海外上場";
  if (value === "private") return "非上場";
  return "未確認";
}

function relationSentence(relationship: CompanyRelationship, companyId: string) {
  const inbound = relationship.targetCompanyId === companyId;
  const other = inbound ? relationship.sourceCompanyName : relationship.targetCompanyName;
  if (relationship.relationType === "equity_ownership") {
    const pct = relationship.ownershipPct === null ? "" : `${relationship.ownershipPct}%`;
    return inbound ? `${other}が${pct}出資` : `${other}へ${pct}出資`;
  }
  if (relationship.relationType === "parent_of") return inbound ? `${other}が親会社` : `${other}の親会社`;
  if (relationship.relationType === "controls") return inbound ? `${other}が支配` : `${other}を支配`;
  if (relationship.relationType === "equity_method_investment") return inbound ? `${other}の持分法対象` : `${other}へ持分法投資`;
  return `${other}と${relationLabel(relationship.relationType, relationship.ownershipPct)}`;
}

export default function GroupTableView({
  group,
  companies,
  memberships,
  relationships,
  selection,
  selectedRelationId,
  focusCompanyId,
  query,
  onSelectCompany,
  onSelectRelation,
}: Props) {
  const [mode, setMode] = useState<TableMode>("companies");
  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const relationshipsByCompany = useMemo(() => {
    const result = new Map<string, CompanyRelationship[]>();
    relationships.forEach((relationship) => {
      result.set(relationship.sourceCompanyId, [...(result.get(relationship.sourceCompanyId) ?? []), relationship]);
      result.set(relationship.targetCompanyId, [...(result.get(relationship.targetCompanyId) ?? []), relationship]);
    });
    return result;
  }, [relationships]);
  const normalized = query.trim().toLocaleLowerCase("ja");

  const visibleMemberships = useMemo(
    () => memberships
      .filter((membership) => membership.groupId === group.id)
      .filter((membership) => {
        const companyRelations = relationshipsByCompany.get(membership.companyId) ?? [];
        const searchable = [
          membership.companyName,
          listingLabel(companyById.get(membership.companyId)?.listingStatus ?? ""),
          ...companyRelations.map((relationship) => relationSentence(relationship, membership.companyId)),
        ].join(" ").toLocaleLowerCase("ja");
        return !normalized || searchable.includes(normalized);
      })
      .sort((a, b) => {
        if (focusCompanyId) {
          if (a.companyId === focusCompanyId) return -1;
          if (b.companyId === focusCompanyId) return 1;
        }
        return a.companyName.localeCompare(b.companyName, "ja");
      }),
    [companyById, focusCompanyId, group.id, memberships, normalized, relationshipsByCompany],
  );

  const visibleRelationships = useMemo(
    () => relationships.filter((relationship) => {
      if (focusCompanyId && relationship.sourceCompanyId !== focusCompanyId && relationship.targetCompanyId !== focusCompanyId) return false;
      if (!normalized) return true;
      return [relationship.sourceCompanyName, relationship.targetCompanyName, relationLabel(relationship.relationType, relationship.ownershipPct)]
        .some((value) => value.toLocaleLowerCase("ja").includes(normalized));
    }),
    [focusCompanyId, normalized, relationships],
  );

  return (
    <div className={styles.viewFade}>
      <div className={styles.viewTools}>
        <div className={styles.hopControl} aria-label="表の内容">
          <button type="button" className={mode === "companies" ? styles.toggleOn : styles.toggle} onClick={() => setMode("companies")}>企業一覧</button>
          <button type="button" className={mode === "relations" ? styles.toggleOn : styles.toggle} onClick={() => setMode("relations")}>企業間関係</button>
        </div>
        <span>{group.name}</span>
      </div>

      {mode === "companies" ? (
        visibleMemberships.length === 0 ? <p className={styles.empty}>条件に一致する所属企業がありません。</p> : (
          <div className={styles.tableScroll}>
            <table className={styles.table} style={{ minWidth: 720 }}>
              <caption>所属 {visibleMemberships.length}社。DB内部コードではなく、判断に使う情報だけを表示しています。</caption>
              <thead>
                <tr>
                  <th>企業</th>
                  <th>上場</th>
                  <th>グループ内の主な関係</th>
                  <th>基準日</th>
                  <th>根拠</th>
                </tr>
              </thead>
              <tbody>
                {visibleMemberships.map((membership) => {
                  const company = companyById.get(membership.companyId);
                  const companyRelations = relationshipsByCompany.get(membership.companyId) ?? [];
                  const selected = selection?.kind === "company" && selection.id === membership.companyId;
                  const summary = companyRelations.length === 0
                    ? "企業間関係は未登録"
                    : companyRelations.slice(0, 2).map((relationship) => relationSentence(relationship, membership.companyId)).join(" / ") + (companyRelations.length > 2 ? ` ほか${companyRelations.length - 2}件` : "");
                  return (
                    <tr key={membership.membershipId} className={selected || focusCompanyId === membership.companyId ? styles.tableRowSelected : undefined} onClick={() => onSelectCompany(membership.companyId)}>
                      <td><button type="button" className={styles.tableCompanyButton} onClick={(event) => { event.stopPropagation(); onSelectCompany(membership.companyId); }}>{membership.companyName}</button></td>
                      <td>{listingLabel(company?.listingStatus ?? "")}</td>
                      <td className={styles.tableRelation}>{summary}</td>
                      <td>{formatAsOf(membership.sourceAsOf)}</td>
                      <td className={styles.tableSource}>
                        {membership.sourceUrl ? <a className={styles.sourceLink} href={membership.sourceUrl} target="_blank" rel="noreferrer">公式根拠</a> : membership.sourceTitle ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : visibleRelationships.length === 0 ? (
        <p className={styles.empty}>{group.name}内の確認済み企業間関係は現在登録されていません。所属企業データとは別レイヤーです。</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table} style={{ minWidth: 760 }}>
            <caption>{visibleRelationships.length}件の企業間関係を表示</caption>
            <thead><tr><th>起点企業</th><th>関係</th><th>相手企業</th><th>比率</th><th>基準日</th><th>根拠</th></tr></thead>
            <tbody>
              {visibleRelationships.map((relationship) => (
                <tr key={relationship.relationId} className={selectedRelationId === relationship.relationId ? styles.tableRowSelected : undefined} onClick={() => onSelectRelation(relationship.relationId)}>
                  <td><button type="button" className={styles.tableCompanyButton} onClick={(event) => { event.stopPropagation(); onSelectCompany(relationship.sourceCompanyId); }}>{relationship.sourceCompanyName}</button></td>
                  <td className={styles.tableRelation}>{relationLabel(relationship.relationType, null)}</td>
                  <td><button type="button" className={styles.tableCompanyButton} onClick={(event) => { event.stopPropagation(); onSelectCompany(relationship.targetCompanyId); }}>{relationship.targetCompanyName}</button></td>
                  <td>{relationship.ownershipPct === null ? "—" : `${relationship.ownershipPct}%`}</td>
                  <td>{formatAsOf(relationship.sourceAsOf)}</td>
                  <td className={styles.tableSource}>{relationship.sourceUrl ? <a className={styles.sourceLink} href={relationship.sourceUrl} target="_blank" rel="noreferrer">公式根拠</a> : relationship.sourceTitle ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}