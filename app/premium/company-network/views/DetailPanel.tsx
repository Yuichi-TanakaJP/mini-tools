"use client";

import styles from "../CompanyNetwork.module.css";
import { CATEGORY_LABEL, formatAsOf, groupTypeLabel, relationLabel } from "../presentation";
import type { CompanyGroupMembership, CompanyNetworkCompany, CompanyRelationship } from "../types";

type Props = {
  company: CompanyNetworkCompany | null;
  centerCompanyId: string;
  relationships: CompanyRelationship[];
  memberships: CompanyGroupMembership[];
  selectedRelation: CompanyRelationship | null;
  onSelectCompany: (companyId: string) => void;
  onSelectRelation: (relationId: string) => void;
  onMakeCenter: (companyId: string) => void;
};

export default function DetailPanel({ company, centerCompanyId, relationships, memberships, selectedRelation, onSelectCompany, onSelectRelation, onMakeCenter }: Props) {
  if (!company) {
    return <aside className={styles.detailPanel}><p className={styles.empty}>企業を選択すると詳細を表示します。</p></aside>;
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
          <div className={styles.groupList}>{companyMemberships.map((membership) => <article key={membership.membershipId}><strong>{membership.groupName}</strong><span>{groupTypeLabel(membership.groupType)} / {membership.membershipBasis}</span><small>{membership.verificationStatus} · {formatAsOf(membership.sourceAsOf)}</small>{membership.sourceUrl ? <a href={membership.sourceUrl} target="_blank" rel="noreferrer">根拠 ↗</a> : null}</article>)}</div>
        ) : <p className={styles.empty}>現在の条件で確認できるグループ所属はありません。</p>}
      </section>
    </aside>
  );
}
