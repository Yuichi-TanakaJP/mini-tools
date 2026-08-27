"use client";

import { useMemo, useState } from "react";
import styles from "../IndustryMap.module.css";
import type { MapContext } from "../context";
import { flattenTree } from "../graph-layout";
import { KIND_COLOR, KIND_LABEL } from "../presentation";
import type { IndustryNode } from "../types";

type Props = {
  context: MapContext;
  activeIds: Set<string>;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
};

type SortKey = "name" | "kind" | "depth" | "stocks" | "relations";

type TableRow = {
  node: IndustryNode;
  depth: number;
  parentName: string;
  stockCount: number;
  relationCount: number;
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "領域" },
  { key: "kind", label: "種別" },
  { key: "depth", label: "階層" },
  { key: "stocks", label: "銘柄" },
  { key: "relations", label: "横断関係" },
];

export default function TableView({ context, activeIds, selectedId, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("depth");
  const [ascending, setAscending] = useState(true);

  const rows = useMemo<TableRow[]>(() => {
    const depthById = new Map(
      flattenTree(context.roots).map((item) => [item.node.id, item.depth]),
    );
    return context.domain.nodes.map((node) => {
      const parentId = context.parentOf.get(node.id);
      return {
        node,
        depth: depthById.get(node.id) ?? 0,
        parentName: parentId ? (context.nodeById.get(parentId)?.displayName ?? "—") : "—",
        stockCount: (context.stockLinksByNode.get(node.id) ?? []).length,
        relationCount: (context.crossEdgesByNode.get(node.id) ?? []).length,
      };
    });
  }, [context]);

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => activeIds.has(row.node.id));
    const direction = ascending ? 1 : -1;
    const compare = (a: TableRow, b: TableRow) => {
      switch (sortKey) {
        case "kind":
          return KIND_LABEL[a.node.kind].localeCompare(KIND_LABEL[b.node.kind], "ja");
        case "depth":
          return a.depth - b.depth;
        case "stocks":
          return a.stockCount - b.stockCount;
        case "relations":
          return a.relationCount - b.relationCount;
        default:
          return a.node.displayName.localeCompare(b.node.displayName, "ja");
      }
    };
    // 同値のときは表示名で安定させる。
    return [...filtered].sort(
      (a, b) =>
        compare(a, b) * direction || a.node.displayName.localeCompare(b.node.displayName, "ja"),
    );
  }, [rows, activeIds, sortKey, ascending]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAscending((current) => !current);
    else {
      setSortKey(key);
      setAscending(true);
    }
  };

  if (visible.length === 0) {
    return (
      <p className={`${styles.detailEmpty} ${styles.viewFade}`}>
        条件に一致する領域がありません。検索語や種別フィルタを見直してください。
      </p>
    );
  }

  return (
    <div className={`${styles.canvasScroll} ${styles.viewFade}`}>
      <table className={styles.table}>
        <caption className={styles.matrixIntro} style={{ captionSide: "top", textAlign: "left" }}>
          {context.domain.label} の全 {context.domain.nodes.length} 領域のうち {visible.length} 件
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                className={styles.tableSortable}
                onClick={() => toggleSort(column.key)}
                aria-sort={
                  sortKey === column.key ? (ascending ? "ascending" : "descending") : "none"
                }
              >
                {column.label}
                {sortKey === column.key ? (ascending ? " ▲" : " ▼") : ""}
              </th>
            ))}
            <th>親</th>
            <th>説明</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr
              key={row.node.id}
              className={`${styles.tableRow} ${
                selectedId === row.node.id ? styles.tableRowSelected : ""
              }`}
              onClick={() => onSelect(row.node.id)}
            >
              <td className={styles.tableName}>
                <span
                  className={styles.kindDot}
                  style={{ background: KIND_COLOR[row.node.kind], display: "inline-block" }}
                />{" "}
                {row.node.displayName}
              </td>
              <td>{KIND_LABEL[row.node.kind]}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>L{row.depth}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>
                {row.stockCount > 0 ? row.stockCount : "—"}
              </td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>
                {row.relationCount > 0 ? row.relationCount : "—"}
              </td>
              <td>{row.parentName}</td>
              <td className={styles.tableDesc}>{row.node.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
