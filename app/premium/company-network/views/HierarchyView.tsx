"use client";

import { useMemo } from "react";
import styles from "../CompanyNetwork.module.css";
import { buildSeriesRows, type SeriesRow } from "../graph-layout";
import { relationLabel } from "../presentation";
import type { CompanyNetworkCompany, CompanyRelationship } from "../types";

type Props = {
  companies: CompanyNetworkCompany[];
  relationships: CompanyRelationship[];
  selectedCompanyId: string;
  selectedRelationId: string | null;
  hops: 1 | 2;
  query: string;
  onSelectCompany: (companyId: string) => void;
  onSelectRelation: (relationId: string) => void;
};

function Row({
  row,
  selectedRelationId,
  query,
  onSelectCompany,
  onSelectRelation,
}: {
  row: SeriesRow;
  selectedRelationId: string | null;
  query: string;
  onSelectCompany: (companyId: string) => void;
  onSelectRelation: (relationId: string) => void;
}) {
  const normalized = query.trim().toLocaleLowerCase("ja");
  const dimmed = normalized.length > 0 && !row.companyName.toLocaleLowerCase("ja").includes(normalized);
  const relationship = row.relationship;
  return (
    <div
      className={`${styles.seriesRow} ${dimmed ? styles.seriesRowDim : ""}`}
      style={{ marginLeft: Math.min(row.depth - 1, 3) * 18 }}
    >
      <button type="button" className={styles.seriesCompany} onClick={() => onSelectCompany(row.companyId)}>
        <span className={styles.seriesDepth}>L{row.depth}</span>
        <strong>{row.companyName}</strong>
        {row.cycle ? <span className={styles.warningBadge}>循環</span> : null}
      </button>
      {relationship ? (
        <button
          type="button"
          className={`${styles.seriesRelation} ${selectedRelationId === relationship.relationId ? styles.seriesRelationActive : ""}`}
          onClick={() => onSelectRelation(relationship.relationId)}
          title={`${relationship.sourceCompanyName} → ${relationship.targetCompanyName}`}
        >
          {relationship.sourceCompanyName} → {relationship.targetCompanyName}
          <span>{relationLabel(relationship.relationType, relationship.ownershipPct)}</span>
        </button>
      ) : null}
    </div>
  );
}

export default function HierarchyView({
  companies,
  relationships,
  selectedCompanyId,
  selectedRelationId,
  hops,
  query,
  onSelectCompany,
  onSelectRelation,
}: Props) {
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const series = useMemo(
    () => selectedCompany
      ? buildSeriesRows({
          selectedCompanyId,
          selectedCompanyName: selectedCompany.name,
          relationships,
          maxDepth: hops,
        })
      : null,
    [hops, relationships, selectedCompany, selectedCompanyId],
  );

  if (!selectedCompany || !series) {
    return <p className={styles.empty}>中心企業を選択してください。</p>;
  }

  return (
    <div className={`${styles.seriesView} ${styles.viewFade}`}>
      <p className={styles.seriesIntro}>
        系列ビューは <strong>出資・親会社・支配・持分法</strong> だけを方向付きで表示します。
        企業グループ所属や歴史的系譜は親子関係と同一視しないため、ここには混ぜません。
      </p>

      <section className={styles.seriesSection}>
        <div className={styles.seriesSectionHead}>
          <div>
            <span className={styles.seriesKicker}>UPSTREAM</span>
            <h3>上位・出資元・支配元</h3>
          </div>
          <span>{series.upstream.length}件</span>
        </div>
        {series.upstream.length > 0 ? (
          <div className={styles.seriesRows}>
            {[...series.upstream].reverse().map((row) => (
              <Row
                key={`up:${row.relationship?.relationId}:${row.companyId}:${row.depth}`}
                row={row}
                selectedRelationId={selectedRelationId}
                query={query}
                onSelectCompany={onSelectCompany}
                onSelectRelation={onSelectRelation}
              />
            ))}
          </div>
        ) : <p className={styles.empty}>この範囲で確認済みの上位関係はありません。</p>}
      </section>

      <div className={styles.seriesCenter}>
        <span>中心企業</span>
        <strong>{selectedCompany.name}</strong>
        <small>{selectedCompany.listingStatus || "上場区分未確認"}</small>
      </div>

      <section className={styles.seriesSection}>
        <div className={styles.seriesSectionHead}>
          <div>
            <span className={styles.seriesKicker}>DOWNSTREAM</span>
            <h3>下位・出資先・支配先</h3>
          </div>
          <span>{series.downstream.length}件</span>
        </div>
        {series.downstream.length > 0 ? (
          <div className={styles.seriesRows}>
            {series.downstream.map((row) => (
              <Row
                key={`down:${row.relationship?.relationId}:${row.companyId}:${row.depth}`}
                row={row}
                selectedRelationId={selectedRelationId}
                query={query}
                onSelectCompany={onSelectCompany}
                onSelectRelation={onSelectRelation}
              />
            ))}
          </div>
        ) : <p className={styles.empty}>この範囲で確認済みの下位関係はありません。</p>}
      </section>
    </div>
  );
}
