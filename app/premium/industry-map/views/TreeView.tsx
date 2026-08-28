"use client";

import { useMemo } from "react";
import styles from "../IndustryMap.module.css";
import type { MapContext } from "../context";
import type { TreeNode } from "../graph-layout";
import { KIND_COLOR, KIND_LABEL } from "../presentation";

type Props = {
  context: MapContext;
  activeIds: Set<string>;
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
};

function descendantCount(item: TreeNode): number {
  return item.children.reduce((total, child) => total + 1 + descendantCount(child), 0);
}

/** 展開状態に沿って、実際に描く行だけを上から順に並べる。 */
function visibleRows(roots: TreeNode[], expandedIds: Set<string>): TreeNode[] {
  const rows: TreeNode[] = [];
  const walk = (item: TreeNode) => {
    rows.push(item);
    if (item.children.length > 0 && expandedIds.has(item.node.id)) {
      item.children.forEach(walk);
    }
  };
  roots.forEach(walk);
  return rows;
}

export default function TreeView({
  context,
  activeIds,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: Props) {
  const rows = useMemo(
    () => visibleRows(context.roots, expandedIds),
    [context.roots, expandedIds],
  );

  const renderRow = (item: TreeNode, rowIndex: number) => {
    const { node } = item;
    const hasChildren = item.children.length > 0;
    const expanded = expandedIds.has(node.id);
    const companyLinks = context.companyLinksByNode.get(node.id) ?? [];
    const crossCount = item.crossEdges.length;
    // 階層に接続していない単独ノード。多数の根がある domain でのみ区別に意味がある。
    const unattached = item.depth === 0 && !hasChildren && context.roots.length > 1;
    // 段差は 1 階層 10px。深さ 5 でもモバイル幅を圧迫しない。
    const indent = item.depth * 10;
    const delay = Math.min(rowIndex, 40) * 12;

    return (
      <div key={node.id}>
        <button
          type="button"
          className={[
            styles.treeRow,
            selectedId === node.id ? styles.treeRowSelected : "",
            activeIds.has(node.id) ? "" : styles.treeRowDim,
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ marginLeft: indent, animationDelay: `${delay}ms` }}
          aria-expanded={hasChildren ? expanded : undefined}
          onClick={() => {
            onSelect(node.id);
            if (hasChildren) onToggle(node.id);
          }}
        >
          <span
            className={[
              styles.treeCaret,
              expanded ? styles.treeCaretOpen : "",
              hasChildren ? "" : styles.treeCaretLeaf,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden
          >
            {hasChildren ? "▶" : "•"}
          </span>
          <span
            className={styles.kindDot}
            style={{ background: KIND_COLOR[node.kind] }}
            title={KIND_LABEL[node.kind]}
          />
          <span className={styles.treeLabel}>{node.displayName}</span>
          {node.layer ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>{node.layer}</span>
          ) : null}
          {unattached ? (
            <span
              className={`${styles.badge} ${styles.badgeMuted}`}
              title="上位・下位の階層がまだ登録されていない領域です"
            >
              階層未接続
            </span>
          ) : null}
          {companyLinks.length > 0 ? (
            <span className={`${styles.badge} ${styles.badgeStock}`}>
              企業 {companyLinks.length}
            </span>
          ) : null}
          {crossCount > 0 ? (
            <span
              className={`${styles.badge} ${styles.badgeCross}`}
              title="この図では線を引いていない横断関係があります"
            >
              関係 {crossCount}
            </span>
          ) : null}
          {hasChildren ? (
            <span className={styles.treeCount}>{descendantCount(item)}</span>
          ) : null}
        </button>
      </div>
    );
  };

  return <div className={`${styles.tree} ${styles.viewFade}`}>{rows.map(renderRow)}</div>;
}
