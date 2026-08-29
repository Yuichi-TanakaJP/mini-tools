"use client";

import styles from "../CompanyNetwork.module.css";
import { CATEGORY_LABEL, formatAsOf, groupTypeLabel, relationLabel } from "../presentation";
import type {
  CompanyGroupMembership,
  CompanyNetworkCompany,
  CompanyNetworkGroup,
  CompanyNetworkNodeSelection,
  CompanyRelationship,
} from "../types";

type Props = {
  groups: CompanyNetworkGroup[];
  companies: CompanyNetworkCompany[];
  selection: CompanyNetworkNodeSelection | null;
  centerCompanyId: string;
  relationships: CompanyRelationship[];
  memberships: CompanyGroupMembership[];
  selectedRelation: CompanyRelationship | null;
  onSelectCompany: (companyId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectRelation: (relationId: string) => void;
  onMakeCenter: (companyId: string) => void;
};

export default function DetailPanel({
  groups,
  companies,
  selection,
  centerCompanyId,
  relationships,
  memberships,
  selectedRelation,
  onSelectCompany,
  onSelectGroup,
  onSelectRelation,
  onMakeCenter,
}: Props) {
  const company = selection?.kind === "company"
    ? companies.find((item) => item.id === selection.id) ?? null
    : null;
  const group = selection?.kind === "group"
    ? groups.find((item) => item.id === selection.id) ?? null
    : null;

  if (selection?.kind === "group" && group) {
    const groupMemberships = memberships
      .filter((membership) => membership.groupId === group.id)
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"));
    const evidence = groupMemberships.find((membership) => membership.sourceUrl || membership.sourceTitle) ?? groupMemberships[0] ?? null;

    return (
      <aside className={styles.detailPanel}>
        <section className={styles.detailSection}>
          <span className={styles.detailKicker}>SELECTED GROUP</span>
          <h2>{group.name}</h2>
          <div className={styles.badges}>
            <span>{groupTypeLabel(group.groupType)}</span>
            <span>所属 {groupMemberships.length}社</span>
          </div>
        </section>

        <section className={styles.detailSection}>
          <div className={styles.detailSectionHead}>
            <h3>所属企業</h3>
            <span>{groupMemberships.length}社</span>
          </div>
          {groupMemberships.length > 0 ? (
            <div className={styles.detailRelations}>
              {groupMemberships.map((membership) => (
                <button
                  type="button"
                  key={membership.membershipId}
                  className={styles.detailRelationButton}
                  onClick={() => onSelectCompany(membership.companyId)}
                >
                  <strong>{membership.companyName}</strong>
                  <span>{membership.membershipRole} · {membership.membershipBasis}</span>
                  <small>{membership.verificationStatus} · {formatAsOf(membership.sourceAsOf)}</small>
                </button>
              ))}
            </div>
          ) : <p className={styles.empty}>現在の条件で表示できる所属企業はありません。</p>}
        </section>

        {evidence ? (
          <section className={styles.detailSection}>
            <div className={styles.detailSectionHead}><h3>所属の根拠</h3><span>{evidence.confidence}</span></div>
            <dl className={styles.detailList}>
              <div><dt>basis</dt><dd>{evidence.membershipBasis}</dd></div>
              <div><dt>基準日</dt><dd>{formatAsOf(evidence.sourceAsOf)}</dd></div>
              <div><dt>source type</dt><dd>{evidence.sourceType ?? "—"}</dd></div>
            </dl>
            {evidence.note ? <p className={styles.detailNote}>{evidence.note}</p> : null}
            {evidence.sourceUrl ? <a className={styles.sourceLink} href={evidence.sourceUrl} target="_blank" rel="noreferrer">{evidence.sourceTitle ?? "根拠を開く"} ↗</a> : null}
          </section>
        ) : null}
      </aside>
    );
  }

  if (!company) {
    return <aside className={styles.detailPanel}><p className={styles.empty}>企業または企業グループを選択すると詳細を表示します。</p></aside>;
  }

  const related = relationships.filter((relationship) => relationship.sourceCompanyId === company.id || relationship.targetCompanyId === company.id);
  const companyMemberships = memberships.filter((membership) => membership.companyId === company.id);
  const isCenter = company.id === centerCompanyId;

  return (
    <aside className={styles.detailPanel}>
      <section className={styles.detailSection}>
        <span className={styles.detailKicker}>{isCenter ? "CENTER COMPANY" : "SELECTED COMPANY"}</span>
        <h2>{company.name}</h2>
        <div className={styles.badges}>
          <span>{company.listingStatus || "上場区分未確認"}</span>
          {company.countryCode ? <span>{company.countryCode}</span> : null}
          <span>{company.status}</span>
        </div>
        {!isCenter ? <button type="button" className={styles.smallButton} onClick={() => onMakeCenter(company.id)}>この企業を中心に見る</button> : null}
      </section>

      {selectedRelation ? (
        <section className={styles.detailSection}>
          <div className={styles.detailSectionHead}><h3>選択中の企業関係</h3><span>{CATEGORY_LABEL[selectedRelation.relationCategory]}</span></div>
          <div className={styles.relationDirection}>
            <button type="button" onClick={() => onSelectCompany(selectedRelation.sourceCompanyId)}>{selectedRelation.sourceCompanyName}</button><span>→</span><button type="button" onClick={() => onSelectCompany(selectedRelation.targetCompanyId)}>{selectedRelation.targetCompanyName}</button>
          </div>
          <strong className={styles.relationTitle}>{relationLabel(selectedRelation.relationType, selectedRelation.ownershipPct)}</strong>
          <div className={styles.badges}>
            <span>{selectedRelation.verificationStatus}</span><span>confidence {selectedRelation.confidence}</span>{selectedRelation.isConsolidated !== null ? <span>{selectedRelation.isConsolidated ? "連結" : "非連結"}</span> : null}
          </div>
          <dl className={styles.detailList}>
            <div><dt>議決権</dt><dd>{selectedRelation.votingRightsPct === null ? "—" : `${selectedRelation.votingRightsPct}%`}</dd></div>
            <div><dt>基準日</dt><dd>{formatAsOf(selectedRelation.sourceAsOf)}</dd></div>
            <div><dt>確認日</dt><dd>{formatAsOf(selectedRelation.checkedAt)}</dd></div>
            <div><dt>source type</dt><dd>{selectedRelation.sourceType ?? "—"}</dd></div>
          </dl>
          {selectedRelation.note ? <p className={styles.detailNote}>{selectedRelation.note}</p> : null}
          {selectedRelation.sourceUrl ? <a className={styles.sourceLink} href={selectedRelation.sourceUrl} target="_blank" rel="noreferrer">{selectedRelation.sourceTitle ?? "根拠を開く"} ↗</a> : null}
        </section>
      ) : null}

      <section className={styles.detailSection}>
        <div className={styles.detailSectionHead}><h3>接続する企業関係</h3><span>{related.length}件</span></div>
        {related.length > 0 ? (
          <div className={styles.detailRelations}>
            {related.map((relationship) => {
              const outbound = relationship.sourceCompanyId === company.id;
              const otherId = outbound ? relationship.targetCompanyId : relationship.sourceCompanyId;
              const otherName = outbound ? relationship.targetCompanyName : relationship.sourceCompanyName;
              return <div key={relationship.relationId} className={styles.detailRelationButton}>
                <button type="button" onClick={() => onSelectCompany(otherId)}><span>{outbound ? "→" : "←"} {otherName}</span></button>
                <button type="button" onClick={() => onSelectRelation(relationship.relationId)}><strong>{relationLabel(relationship.relationType, relationship.ownershipPct)}</strong><small>{relationship.verificationStatus} · {formatAsOf(relationship.sourceAsOf)}</small></button>
              </div>;
            })}
          </div>
        ) : <p className={styles.empty}>現在の条件で接続する企業関係はありません。</p>}
      </section>

      <section className={styles.detailSection}>
        <div className={styles.detailSectionHead}><h3>企業グループ所属</h3><span>{companyMemberships.length}件</span></div>
        {companyMemberships.length > 0 ? (
          <div className={styles.groupList}>
            {companyMemberships.map((membership) => (
              <article key={membership.membershipId}>
                <button
                  type="button"
                  onClick={() => onSelectGroup(membership.groupId)}
                  style={{ display: "grid", gap: 3, width: "100%", border: 0, padding: 0, background: "transparent", color: "inherit", textAlign: "left", font: "inherit", cursor: "pointer" }}
                >
                  <strong>{membership.groupName}</strong>
                  <span>{groupTypeLabel(membership.groupType)} / {membership.membershipBasis}</span>
                  <small>{membership.verificationStatus} · {formatAsOf(membership.sourceAsOf)}</small>
                </button>
                {membership.sourceUrl ? <a href={membership.sourceUrl} target="_blank" rel="noreferrer">根拠 ↗</a> : null}
              </article>
            ))}
          </div>
        ) : <p className={styles.empty}>現在の条件で確認できるグループ所属はありません。</p>}
      </section>
    </aside>
  );
}
