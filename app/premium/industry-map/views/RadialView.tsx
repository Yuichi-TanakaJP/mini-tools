"use client";

import { useMemo } from "react";
import RadialHierarchyCanvas from "../../shared/radial/RadialHierarchyCanvas";
import type { RadialHierarchyNode } from "../../shared/radial/radial-layout";
import type { MapContext } from "../context";
import type { TreeNode } from "../graph-layout";
import { KIND_COLOR, KIND_LABEL } from "../presentation";

type Props = {
  context: MapContext;
  activeIds: Set<string>;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
};

function adaptTree(item: TreeNode, context: MapContext): RadialHierarchyNode {
  const tone = KIND_COLOR[item.node.kind];
  const companyCount = (context.companyLinksByNode.get(item.node.id) ?? []).length;
  const radius = item.depth === 0 ? 13 : Math.max(4, 10 - item.depth * 2);
  return {
    id: item.node.id,
    label: item.node.displayName,
    title: `${item.node.displayName}（${KIND_LABEL[item.node.kind]}）`,
    tone,
    fill: companyCount > 0 ? tone : "var(--color-bg-card)",
    stroke: tone,
    strokeWidth: 2,
    radius,
    labelSize: 11,
    labelWeight: item.depth === 0 ? 900 : 800,
    linkColor: "var(--rel-hierarchy)",
    linkWidth: 1.2,
    markerColor: item.crossEdges.length > 0 ? "var(--rel-depends)" : null,
    children: item.children.map((child) => adaptTree(child, context)),
  };
}

export default function RadialView({ context, activeIds, selectedId, onSelect }: Props) {
  const roots = useMemo(
    () => context.roots.map((root) => adaptTree(root, context)),
    [context],
  );

  return (
    <RadialHierarchyCanvas
      roots={roots}
      activeIds={activeIds}
      selectedId={selectedId}
      onSelect={onSelect}
      resetKey={context.domain.domain}
      ariaLabel={`${context.domain.label}の放射マップ`}
      viewBoxHalf={500}
      labelPadding={118}
      layoutOptions={{ radiusStep: 100, satelliteOffsetDelta: 0 }}
    />
  );
}
