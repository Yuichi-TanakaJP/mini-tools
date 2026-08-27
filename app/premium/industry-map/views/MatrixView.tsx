"use client";

import { useMemo } from "react";
import styles from "../IndustryMap.module.css";
import type { MapContext } from "../context";
import {
  CONTROL_LABEL,
  KIND_COLOR,
  KIND_LABEL,
  ROLE_COLOR,
  ROLE_LABEL,
  THEME_RELATION_COLOR,
  THEME_RELATION_LABEL,
} from "../presentation";
import type { IndustryNode } from "../types";

type Props = {
  context: MapContext;
  activeIds: Set<string>;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
};

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

export default function MatrixView({ context, activeIds, selectedId, onSelect }: Props) {
  const rows = useMemo(() => orderedNodes(context), [context]);

  const stocks = useMemo(() => {
    const ids = new Set(context.domain.stockLinks.map((link) => link.stockId));
    return [...context.stockById.values()]
      .filter((stock) => ids.has(stock.id))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [context.domain.stockLinks, context.stockById]);

  const themes = useMemo(() => {
    const ids = new Set(context.domain.themeLinks.map((link) => link.themeId));
    return [...context.themeById.values()]
      .filter((theme) => ids.has(theme.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
  }, [context.domain.themeLinks, context.themeById]);

  const stockRows = rows.filter(
    (node) => activeIds.has(node.id) && (context.stockLinksByNode.get(node.id) ?? []).length > 0,
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
        <h3 className={styles.detailSectionTitle}>保有・監視銘柄 × 領域</h3>
        <p className={styles.matrixIntro}>
          色は戦略上の位置づけ、記号は関与の仕方です。空白は「その銘柄がこの領域に紐づいていない」ことだけを表し、
          優劣や売買の判断は含みません。
        </p>
        {stocks.length === 0 || stockRows.length === 0 ? (
          <p className={styles.detailEmpty}>
            この業界マップに紐づいた銘柄はまだありません。
          </p>
        ) : (
          <div className={styles.matrixScroll}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th className={`${styles.matrixCorner}`}>領域</th>
                  {stocks.map((stock) => (
                    <th key={stock.id} className={styles.matrixColHead} scope="col">
                      <div>{stock.code}</div>
                      <div style={{ fontWeight: 700, opacity: 0.72 }}>{stock.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stockRows.map((node) => {
                  const links = context.stockLinksByNode.get(node.id) ?? [];
                  const byStock = new Map(links.map((link) => [link.stockId, link]));
                  return (
                    <tr
                      key={node.id}
                      className={`${styles.matrixRow} ${
                        selectedId === node.id ? styles.tableRowSelected : ""
                      }`}
                    >
                      {renderRowHead(node)}
                      {stocks.map((stock) => {
                        const link = byStock.get(stock.id);
                        return (
                          <td key={stock.id} className={styles.matrixCell}>
                            {link ? (
                              <span
                                className={styles.matrixMark}
                                style={{ background: ROLE_COLOR[link.strategicRole] }}
                                title={`${ROLE_LABEL[link.strategicRole]} / ${
                                  CONTROL_LABEL[link.controlType]
                                }`}
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
      </section>

      <p className={styles.note} style={{ marginTop: 14 }}>
        種別: {KIND_LABEL.classification} / {KIND_LABEL.product_segment} / {KIND_LABEL.technology}
      </p>
    </div>
  );
}
