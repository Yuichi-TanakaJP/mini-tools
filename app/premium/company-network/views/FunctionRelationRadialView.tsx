"use client";

import { useEffect, useMemo, useState } from "react";
import RadialHierarchyCanvas from "../../shared/radial/RadialHierarchyCanvas";
import type { RadialHierarchyNode } from "../../shared/radial/radial-layout";
import styles from "../CompanyNetwork.module.css";
import { compareFunction, compareFunctionClass } from "../function-order";
import type {
  CompanyFunctionLink,
  CompanyNetworkCompany,
  CompanyNetworkNodeSelection,
} from "../types";

type Props = {
  groupName: string;
  companies: CompanyNetworkCompany[];
  functions: CompanyFunctionLink[];
  selection: CompanyNetworkNodeSelection | null;
  focusCompanyId: string;
  query: string;
  onSelectCompany: (companyId: string) => void;
};

const CLASS_TONES = ["#2563eb", "#0f9f8f", "#7c3aed", "#d97706", "#64748b", "#be123c"] as const;

function presentationCompanyId(link: CompanyFunctionLink) {
  return `company-function:${link.linkId}`;
}

function functionNodeId(link: CompanyFunctionLink) {
  return `function:${link.nodeId}`;
}

function classificationNodeId(link: CompanyFunctionLink) {
  return `classification:${link.classificationId ?? link.classificationSlug ?? "other"}`;
}

function collectParentMap(roots: RadialHierarchyNode[]) {
  const parentOf = new Map<string, string>();
  const walk = (node: RadialHierarchyNode) => {
    node.children.forEach((child) => {
      parentOf.set(child.id, node.id);
      walk(child);
    });
  };
  roots.forEach(walk);
  return parentOf;
}

function withAncestors(ids: Iterable<string>, parentOf: Map<string, string>) {
  const result = new Set<string>();
  for (const id of ids) {
    result.add(id);
    let parent = parentOf.get(id);
    while (parent && !result.has(parent)) {
      result.add(parent);
      parent = parentOf.get(parent);
    }
  }
  return result;
}

export default function FunctionRelationRadialView({
  groupName,
  companies,
  functions,
  selection,
  focusCompanyId,
  query,
  onSelectCompany,
}: Props) {
  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

  const adapted = useMemo(() => {
    const byClass = new Map<string, CompanyFunctionLink[]>();
    functions.forEach((link) => {
      const key = link.classificationId ?? link.classificationSlug ?? "other";
      byClass.set(key, [...(byClass.get(key) ?? []), link]);
    });

    const classGroups = [...byClass.entries()]
      .map(([key, links]) => ({
        key,
        classificationSlug: links[0]?.classificationSlug ?? null,
        classificationName: links[0]?.classificationName ?? "その他",
        links,
      }))
      .sort(compareFunctionClass);

    const presentationToCompany = new Map<string, string>();
    const presentationsByCompany = new Map<string, string[]>();

    const roots: RadialHierarchyNode[] = classGroups.map((group, classIndex) => {
      const tone = CLASS_TONES[classIndex % CLASS_TONES.length];
      const byFunction = new Map<string, CompanyFunctionLink[]>();
      group.links.forEach((link) => {
        byFunction.set(link.nodeId, [...(byFunction.get(link.nodeId) ?? []), link]);
      });

      const functionGroups = [...byFunction.values()]
        .map((links) => ({
          functionSlug: links[0].functionSlug,
          functionName: links[0].functionName,
          links,
        }))
        .sort(compareFunction);

      return {
        id: classificationNodeId(group.links[0]),
        label: group.classificationName,
        title: `${group.classificationName}（事業・機能の大分類）`,
        tone,
        fill: tone,
        stroke: tone,
        strokeWidth: 2.4,
        radius: 14,
        labelSize: 12,
        labelWeight: 900,
        linkColor: tone,
        linkWidth: 1.7,
        children: functionGroups.map((fnGroup) => ({
          id: functionNodeId(fnGroup.links[0]),
          label: fnGroup.functionName,
          title: `${fnGroup.functionName}（機能領域）`,
          tone,
          fill: "var(--color-bg-card)",
          stroke: tone,
          strokeWidth: 2,
          radius: 8.5,
          labelSize: 10.5,
          labelWeight: 850,
          linkColor: tone,
          linkWidth: 1.25,
          children: [...fnGroup.links]
            .sort((a, b) => {
              if (a.role === "core" && b.role !== "core") return -1;
              if (a.role !== "core" && b.role === "core") return 1;
              return (companyById.get(a.companyId)?.name ?? "").localeCompare(
                companyById.get(b.companyId)?.name ?? "",
                "ja",
              );
            })
            .flatMap((link): RadialHierarchyNode[] => {
              const company = companyById.get(link.companyId);
              if (!company) return [];
              const nodeId = presentationCompanyId(link);
              presentationToCompany.set(nodeId, company.id);
              presentationsByCompany.set(company.id, [
                ...(presentationsByCompany.get(company.id) ?? []),
                nodeId,
              ]);
              const core = link.role === "core";
              return [{
                id: nodeId,
                label: company.name,
                title: `${company.name} — ${core ? "主要機能" : "追加機能"}: ${fnGroup.functionName}`,
                tone,
                fill: "var(--color-bg-card)",
                stroke: core ? tone : "#94a3b8",
                strokeWidth: core ? 1.6 : 1.15,
                radius: core ? 5.4 : 4.5,
                labelSize: 9.4,
                labelWeight: core ? 800 : 650,
                linkColor: core ? tone : "#cbd5e1",
                linkWidth: core ? 1 : 0.8,
                children: [],
              }];
            }),
        })),
      };
    });

    const parentOf = collectParentMap(roots);
    const allIds = new Set<string>();
    const labelById = new Map<string, string>();
    const walk = (node: RadialHierarchyNode) => {
      allIds.add(node.id);
      labelById.set(node.id, node.label);
      node.children.forEach(walk);
    };
    roots.forEach(walk);

    return {
      roots,
      parentOf,
      allIds,
      labelById,
      presentationToCompany,
      presentationsByCompany,
    };
  }, [companyById, functions]);

  const externallySelectedCompanyId = selection?.kind === "company" ? selection.id : focusCompanyId;
  const firstSelectedPresentation = externallySelectedCompanyId
    ? adapted.presentationsByCompany.get(externallySelectedCompanyId)?.[0] ?? null
    : null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(firstSelectedPresentation);

  useEffect(() => {
    setSelectedNodeId(firstSelectedPresentation);
  }, [firstSelectedPresentation]);

  const activeIds = useMemo(() => {
    if (focusCompanyId && !query.trim()) {
      const ids = adapted.presentationsByCompany.get(focusCompanyId) ?? [];
      return ids.length > 0 ? withAncestors(ids, adapted.parentOf) : adapted.allIds;
    }

    const needle = query.trim().toLocaleLowerCase("ja");
    if (!needle) return adapted.allIds;
    const matches = [...adapted.labelById.entries()]
      .filter(([, label]) => label.toLocaleLowerCase("ja").includes(needle))
      .map(([id]) => id);
    return withAncestors(matches, adapted.parentOf);
  }, [adapted, focusCompanyId, query]);

  if (functions.length === 0 || adapted.roots.length === 0) {
    return (
      <p className={styles.empty}>
        <strong>{groupName}</strong>には事業・機能taxonomyがまだ登録されていません。
      </p>
    );
  }

  return (
    <div className={styles.viewFade}>
      <div className={styles.viewTools}>
        <span>{groupName}の事業・機能関係</span>
        <span>{adapted.roots.length}分類 · {functions.length}機能リンク</span>
      </div>
      <p className={styles.hint}>
        色の大きな点が大分類、白抜きの中点が機能領域、小さな点が企業です。構成ツリーと同じ分類順・色で、役割のまとまりを空間的に見ます。
      </p>
      <RadialHierarchyCanvas
        roots={adapted.roots}
        activeIds={activeIds}
        selectedId={selectedNodeId}
        resetKey={`${groupName}|functional-radial`}
        ariaLabel={`${groupName}の事業・機能放射マップ`}
        viewBoxHalf={460}
        labelPadding={88}
        layoutOptions={{ radiusStep: 104, satelliteOffsetDelta: -1 }}
        onSelect={(nodeId) => {
          setSelectedNodeId(nodeId);
          const companyId = adapted.presentationToCompany.get(nodeId);
          if (companyId) onSelectCompany(companyId);
        }}
      />
    </div>
  );
}
