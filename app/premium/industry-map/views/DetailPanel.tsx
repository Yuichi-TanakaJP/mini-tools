"use client";

import styles from "../IndustryMap.module.css";
import { otherEndOf, type MapContext } from "../context";
import {
  CONFIDENCE_LABEL,
  CONTROL_LABEL,
  KIND_COLOR,
  KIND_LABEL,
  RELATION_COLOR,
  RELATION_LABEL,
  ROLE_COLOR,
  ROLE_LABEL,
  THEME_RELATION_COLOR,
  THEME_RELATION_LABEL,
  companyStatusLabel,
  formatAsOf,
  listingLabel,
} from "../presentation";

type Props = {
  context: MapContext;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
};

export default function DetailPanel({ context, selectedId, onSelect }: Props) {
  const node = selectedId ? context.nodeById.get(selectedId) : undefined;

  if (!node) {
    return (
      <aside className={styles.detail}>
        <div className={styles.detailHead}>
          <h2 className={styles.detailTitle}>領域を選ぶ</h2>
        </div>
        <p className={styles.detailBody}>
          図や表の項目を選ぶと、その領域の定義、上下関係、横断する関係、紐づく銘柄とテーマをここに出します。
        </p>
        <p className={styles.note}>
          この画面は閲覧専用です。内容の追加・修正は ChatGPT との対話から Supabase へ保存します。
        </p>
      </aside>
    );
  }

  const path: string[] = [];
  let cursor = context.parentOf.get(node.id);
  while (cursor) {
    const parent = context.nodeById.get(cursor);
    if (!parent) break;
    path.unshift(parent.displayName);
    cursor = context.parentOf.get(cursor);
  }

  const children = (context.childrenOf.get(node.id) ?? [])
    .map((childId) => context.nodeById.get(childId))
    .filter((child): child is NonNullable<typeof child> => Boolean(child));
  const crossEdges = context.crossEdgesByNode.get(node.id) ?? [];
  const companyLinks = context.companyLinksByNode.get(node.id) ?? [];
  const themeLinks = context.themeLinksByNode.get(node.id) ?? [];

  return (
    <aside className={styles.detail} key={node.id}>
      <div className={styles.detailHead}>
        <span className={styles.detailKind} style={{ color: KIND_COLOR[node.kind] }}>
          <span className={styles.kindDot} style={{ background: KIND_COLOR[node.kind] }} />
          {KIND_LABEL[node.kind]}
          {node.layer ? ` · ${node.layer}` : ""}
          {node.status !== "active" ? ` · ${node.status}` : ""}
        </span>
        <h2 className={styles.detailTitle}>{node.displayName}</h2>
        <span className={styles.detailSlug}>{node.slug}</span>
        {path.length > 0 ? (
          <span className={styles.detailSlug}>{path.join(" › ")}</span>
        ) : null}
      </div>

      {node.description ? <p className={styles.detailBody}>{node.description}</p> : null}

      {children.length > 0 ? (
        <section className={styles.detailSection}>
          <span className={styles.detailSectionTitle}>下位領域 {children.length}</span>
          <ul className={styles.detailList}>
            {children.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  className={`${styles.detailItem} ${styles.detailItemLink}`}
                  onClick={() => onSelect(child.id)}
                >
                  <span
                    className={styles.kindDot}
                    style={{ background: KIND_COLOR[child.kind] }}
                  />
                  <span className={styles.detailItemMain}>{child.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {crossEdges.length > 0 ? (
        <section className={styles.detailSection}>
          <span className={styles.detailSectionTitle}>横断する関係 {crossEdges.length}</span>
          <ul className={styles.detailList}>
            {crossEdges.map((edge) => {
              const otherId = otherEndOf(edge, node.id);
              const other = context.nodeById.get(otherId);
              const outgoing = edge.sourceId === node.id;
              return (
                <li key={edge.id}>
                  <button
                    type="button"
                    className={`${styles.detailItem} ${styles.detailItemLink}`}
                    onClick={() => onSelect(otherId)}
                  >
                    <span
                      className={styles.relTag}
                      style={{ background: RELATION_COLOR[edge.relationType] }}
                    >
                      {outgoing ? "→" : "←"} {RELATION_LABEL[edge.relationType]}
                    </span>
                    <span className={styles.detailItemMain}>
                      {other?.displayName ?? otherId}
                      {edge.note ? (
                        <span className={styles.detailItemNote}>{edge.note}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {companyLinks.length > 0 ? (
        <section className={styles.detailSection}>
          <span className={styles.detailSectionTitle}>紐づく企業 {companyLinks.length}</span>
          <ul className={styles.detailList}>
            {companyLinks.map((link) => (
              <li key={link.linkId} className={styles.detailItem}>
                <span
                  className={styles.relTag}
                  style={{ background: ROLE_COLOR[link.strategicRole] }}
                >
                  {ROLE_LABEL[link.strategicRole]}
                </span>
                <span className={styles.detailItemMain}>
                  {link.companyName}
                  {link.stockCode ? (
                    <span className={`${styles.badge} ${styles.badgeStock}`}>
                      {link.stockCode}
                    </span>
                  ) : null}
                  {link.companyStatus === "draft" ? (
                    <span className={`${styles.badge} ${styles.badgeMuted}`}>
                      {companyStatusLabel(link.companyStatus)}
                    </span>
                  ) : null}
                  <span className={styles.detailItemNote}>
                    {[
                      CONTROL_LABEL[link.controlType],
                      CONFIDENCE_LABEL[link.confidence],
                      // 銘柄名が企業名と同じときは繰り返さない。
                      link.stockCode
                        ? link.stockName && link.stockName !== link.companyName
                          ? link.stockName
                          : null
                        : listingLabel(link.listingStatus),
                      link.countryCode,
                      link.asOf ? formatAsOf(link.asOf) : null,
                      link.note || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            紐付けは事実の整理であり、売買の推奨ではありません。銘柄コードのない企業は売買対象として扱えません。
          </p>
        </section>
      ) : null}

      {themeLinks.length > 0 ? (
        <section className={styles.detailSection}>
          <span className={styles.detailSectionTitle}>紐づくテーマ {themeLinks.length}</span>
          <ul className={styles.detailList}>
            {themeLinks.map((link) => {
              const theme = context.themeById.get(link.themeId);
              return (
                <li key={`${link.themeId}-${link.nodeId}`} className={styles.detailItem}>
                  <span
                    className={styles.relTag}
                    style={{ background: THEME_RELATION_COLOR[link.relationType] }}
                  >
                    {THEME_RELATION_LABEL[link.relationType]}
                  </span>
                  <span className={styles.detailItemMain}>
                    {theme?.displayName ?? link.themeId}
                    {link.note ? <span className={styles.detailItemNote}>{link.note}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
