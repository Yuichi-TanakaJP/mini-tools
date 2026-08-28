"use client";

import { useMemo } from "react";
import styles from "../IndustryMap.module.css";
import type { MapContext } from "../context";
import {
  CONFIDENCE_LABEL,
  CONTROL_LABEL,
  KIND_COLOR,
  KIND_LABEL,
  ROLE_COLOR,
  ROLE_LABEL,
  THEME_RELATION_COLOR,
  THEME_RELATION_LABEL,
  companyStatusLabel,
  isListed,
  listingLabel,
} from "../presentation";
import type { IndustryCompanyLink, IndustryNode } from "../types";

type Props = {
  context: MapContext;
  activeIds: Set<string>;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  /** 企業レイヤーだけ取得に失敗した場合。0件と区別して知らせる。 */
  companyLayerFailed: boolean;
};

/** 列に出す企業。名前順にして、domain を切り替えても並びが安定するようにする。 */
type CompanyColumn = {
  id: string;
  name: string;
  status: string;
  listingStatus: string;
  countryCode: string | null;
  stockCode: string | null;
};

function companyColumns(links: IndustryCompanyLink[]): CompanyColumn[] {
  const byId = new Map<string, CompanyColumn>();
  for (const link of links) {
    if (byId.has(link.companyId)) continue;
    byId.set(link.companyId, {
      id: link.companyId,
      name: link.companyName,
      status: link.companyStatus,
      listingStatus: link.listingStatus,
      countryCode: link.countryCode,
      stockCode: link.stockCode,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

/** 行の並びは階層の出現順に合わせる。ツリーと見比べたときに対応が取れる。 */
function orderedNodes(context: MapContext): IndustryNode[] {
  const ordered: IndustryNode[] = [];
  const walkId = (nodeId: string) => {
    const node = context.nodeById.get(nodeId);
    if (node) ordered.push(node);
    for (const childId of context.childrenOf.get(nodeId) ?? []) walkId(childId);
  };
  for (const root of context.roots) walkId(root.node.id);

  const seen = new Set(ordered.map((node) => node.id));
  for (const node of context.domain.nodes) {
    if (!seen.has(node.id)) ordered.push(node);
  }
  return ordered;
}

export default function MatrixView({
  context,
  activeIds,
  selectedId,
  onSelect,
  companyLayerFailed,
}: Props) {
  const rows = useMemo(() => orderedNodes(context), [context]);

  const companies = useMemo(
    () => companyColumns(context.domain.companyLinks),
    [context.domain.companyLinks],
  );

  const themes = useMemo(() => {
    const ids = new Set(context.domain.themeLinks.map((link) => link.themeId));
    return [...context.themeById.values()]
      .filter((theme) => ids.has(theme.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
  }, [context.domain.themeLinks, context.themeById]);

  const companyRows = rows.filter(
    (node) => activeIds.has(node.id) && (context.companyLinksByNode.get(node.id) ?? []).length > 0,
  );
  const themeRows = rows.filter(
    (node) => activeIds.has(node.id) && (context.themeLinksByNode.get(node.id) ?? []).length > 0,
  );

  const renderRowHead = (node: IndustryNode) => (
    <th scope="row" className={styles.matrixRowHead}>
      <button
        type="button"
        className={styles.matrixRowHeadInner}
        style={{ border: 0, background: "transparent", font: "inherit", cursor: "pointer" }}
        onClick={() => onSelect(node.id)}
      >
        <span className={styles.kindDot} style={{ background: KIND_COLOR[node.kind] }} />
        <span className={styles.matrixRowLabel}>{node.displayName}</span>
      </button>
    </th>
  );

  return (
    <div className={styles.viewFade}>
      <section>
        <h3 className={styles.detailSectionTitle}>企業 × 領域</h3>
        <p className={styles.matrixIntro}>
          色は戦略上の位置づけ、ツールチップが関与の仕方と確度です。上場企業は銘柄コードを添えます。
          空白は「その企業がこの領域に紐づいていない」ことだけを表し、優劣や売買の判断は含みません。
        </p>
        {companyLayerFailed ? (
          <p className={styles.matrixFailed}>
            企業データを取得できませんでした。0件ではなく取得失敗です。
          </p>
        ) : companies.length === 0 || companyRows.length === 0 ? (
          <p className={styles.detailEmpty}>この業界マップに紐づいた企業はまだありません。</p>
        ) : (
          <div className={styles.matrixScroll}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th className={styles.matrixCorner}>領域</th>
                  {companies.map((company) => (
                    <th key={company.id} className={styles.matrixColHead} scope="col">
                      <div>{company.name}</div>
                      <div className={styles.matrixColMeta}>
                        {company.stockCode
                          ? company.stockCode
                          : listingLabel(company.listingStatus)}
                        {company.countryCode ? ` · ${company.countryCode}` : ""}
                        {company.status === "draft" ? " · 下書き" : ""}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companyRows.map((node) => {
                  const links = context.companyLinksByNode.get(node.id) ?? [];
                  const byCompany = new Map(links.map((link) => [link.companyId, link]));
                  return (
                    <tr
                      key={node.id}
                      className={`${styles.matrixRow} ${
                        selectedId === node.id ? styles.tableRowSelected : ""
                      }`}
                    >
                      {renderRowHead(node)}
                      {companies.map((company) => {
                        const link = byCompany.get(company.id);
                        return (
                          <td key={company.id} className={styles.matrixCell}>
                            {link ? (
                              <span
                                className={styles.matrixMark}
                                style={{ background: ROLE_COLOR[link.strategicRole] }}
                                title={`${ROLE_LABEL[link.strategicRole]} / ${
                                  CONTROL_LABEL[link.controlType]
                                } / ${CONFIDENCE_LABEL[link.confidence]}`}
                              >
                                {ROLE_LABEL[link.strategicRole]}
                              </span>
                            ) : (
                              <span className={styles.matrixEmpty} aria-label="紐付けなし" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {companies.length > 1 ? (
          <span className={styles.matrixScrollHint}>← 横にスクロールすると残りの企業を見られます</span>
        ) : null}
        <div className={styles.legend}>
          {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((role) => (
            <span key={role} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ background: ROLE_COLOR[role], height: 8, borderRadius: 3 }}
              />
              {ROLE_LABEL[role]}
            </span>
          ))}
        </div>
        {companies.some((company) => !isListed(company.listingStatus)) ? (
          <p className={styles.note}>
            上場が確認できていない企業も含みます。銘柄コードのない企業は売買対象として扱えません。
          </p>
        ) : null}
      </section>

      <section style={{ marginTop: 22 }}>
        <h3 className={styles.detailSectionTitle}>テーマ × 領域</h3>
        <p className={styles.matrixIntro}>
          テーマが、この業界のどこを対象範囲・注目点・監視軸として見ているかです。
        </p>
        {themes.length === 0 || themeRows.length === 0 ? (
          <p className={styles.detailEmpty}>
            この業界マップに紐づいたテーマはまだありません。
          </p>
        ) : (
          <div className={styles.matrixScroll}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th className={styles.matrixCorner}>領域</th>
                  {themes.map((theme) => (
                    <th key={theme.id} className={styles.matrixColHead} scope="col">
                      {theme.displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {themeRows.map((node) => {
                  const links = context.themeLinksByNode.get(node.id) ?? [];
                  const byTheme = new Map(links.map((link) => [link.themeId, link]));
                  return (
                    <tr
                      key={node.id}
                      className={`${styles.matrixRow} ${
                        selectedId === node.id ? styles.tableRowSelected : ""
                      }`}
                    >
                      {renderRowHead(node)}
                      {themes.map((theme) => {
                        const link = byTheme.get(theme.id);
                        return (
                          <td key={theme.id} className={styles.matrixCell}>
                            {link ? (
                              <span
                                className={styles.matrixMark}
                                style={{
                                  background: THEME_RELATION_COLOR[link.relationType],
                                  width: 56,
                                }}
                                title={THEME_RELATION_LABEL[link.relationType]}
                              >
                                {THEME_RELATION_LABEL[link.relationType]}
                              </span>
                            ) : (
                              <span className={styles.matrixEmpty} aria-label="紐付けなし" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {themes.length > 1 ? (
          <span className={styles.matrixScrollHint}>← 横にスクロールすると残りのテーマを見られます</span>
        ) : null}
      </section>

      <p className={styles.note} style={{ marginTop: 14 }}>
        種別: {KIND_LABEL.classification} / {KIND_LABEL.product_segment} / {KIND_LABEL.technology}
      </p>
    </div>
  );
}
