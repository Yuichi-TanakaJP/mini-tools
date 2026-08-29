"use client";

import { useEffect, useMemo, useState } from "react";
import { buildMapContext, selectActiveIds } from "../../industry-map/context";
import type {
  IndustryCompanyLink,
  IndustryDomain,
  IndustryEdge,
  IndustryNode,
  TaxonomyKind,
} from "../../industry-map/types";
import IndustryRadialView from "../../industry-map/views/RadialView";
import styles from "../CompanyNetwork.module.css";
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

const ALL_KINDS = new Set<TaxonomyKind>([
  "classification",
  "product_segment",
  "technology",
]);

function presentationCompanyId(link: CompanyFunctionLink) {
  // 同一企業が複数機能を担う場合も、各機能クラスターに1つずつ表示する。
  return `company-function:${link.linkId}`;
}

function functionNodeId(link: CompanyFunctionLink) {
  return `function:${link.nodeId}`;
}

function classificationNodeId(link: CompanyFunctionLink) {
  return `classification:${link.classificationId ?? link.classificationSlug ?? "other"}`;
}

function companyLinkForRadial(
  link: CompanyFunctionLink,
  company: CompanyNetworkCompany,
  nodeId: string,
): IndustryCompanyLink {
  return {
    linkId: `radial:${link.linkId}`,
    companyId: company.id,
    companyName: company.name,
    companySlug: company.id,
    companyStatus: company.status,
    countryCode: company.countryCode,
    listingStatus: company.listingStatus,
    nodeId,
    strategicRole: link.role === "core" ? "core" : "supporting",
    controlType: "unknown",
    confidence: link.confidence,
    sourceType: link.sourceType ?? "company_function",
    note: link.note,
    asOf: link.asOf,
    stockId: null,
    stockCode: company.ticker ?? null,
    stockName: company.name,
  };
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
    const nodes = new Map<string, IndustryNode>();
    const edges = new Map<string, IndustryEdge>();
    const companyLinks: IndustryCompanyLink[] = [];
    const presentationToCompany = new Map<string, string>();
    const presentationsByCompany = new Map<string, string[]>();
    const rootIds = new Set<string>();

    for (const link of functions) {
      const company = companyById.get(link.companyId);
      if (!company) continue;

      const classId = classificationNodeId(link);
      const fnId = functionNodeId(link);
      const companyNodeId = presentationCompanyId(link);
      rootIds.add(classId);

      if (!nodes.has(classId)) {
        nodes.set(classId, {
          id: classId,
          domain: "company-functions",
          kind: "classification",
          slug: link.classificationSlug ?? classId,
          displayName: link.classificationName ?? "その他",
          description: `${groupName}の事業・機能大分類`,
          status: "active",
          layer: "function_class",
        });
      }

      if (!nodes.has(fnId)) {
        nodes.set(fnId, {
          id: fnId,
          domain: "company-functions",
          kind: "product_segment",
          slug: link.functionSlug,
          displayName: link.functionName,
          description: `${groupName}の機能領域`,
          status: "active",
          layer: "function",
        });
      }

      nodes.set(companyNodeId, {
        id: companyNodeId,
        domain: "company-functions",
        kind: "technology",
        slug: company.id,
        displayName: company.name,
        description: `${link.role === "core" ? "主要機能" : "追加機能"}: ${link.functionName}`,
        status: "active",
        layer: "company",
      });

      const classEdgeId = `${classId}->${fnId}`;
      if (!edges.has(classEdgeId)) {
        edges.set(classEdgeId, {
          id: classEdgeId,
          domain: "company-functions",
          sourceId: classId,
          targetId: fnId,
          relationType: "contains",
          note: "企業グループの事業・機能taxonomy",
        });
      }

      const companyEdgeId = `${fnId}->${companyNodeId}`;
      edges.set(companyEdgeId, {
        id: companyEdgeId,
        domain: "company-functions",
        sourceId: fnId,
        targetId: companyNodeId,
        relationType: "contains",
        note: link.role === "core" ? "主要機能" : "追加機能",
      });

      presentationToCompany.set(companyNodeId, company.id);
      presentationsByCompany.set(company.id, [
        ...(presentationsByCompany.get(company.id) ?? []),
        companyNodeId,
      ]);
      companyLinks.push(companyLinkForRadial(link, company, companyNodeId));
    }

    const domain: IndustryDomain = {
      domain: `company-functions-${groupName}`,
      label: `${groupName} 事業・機能`,
      rootIds: [...rootIds],
      nodes: [...nodes.values()],
      edges: [...edges.values()],
      companyLinks,
      themeLinks: [],
    };

    return {
      context: buildMapContext(domain, []),
      presentationToCompany,
      presentationsByCompany,
    };
  }, [companyById, functions, groupName]);

  const externallySelectedCompanyId =
    selection?.kind === "company" ? selection.id : focusCompanyId;
  const firstSelectedPresentation = externallySelectedCompanyId
    ? adapted.presentationsByCompany.get(externallySelectedCompanyId)?.[0] ?? null
    : null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(firstSelectedPresentation);

  useEffect(() => {
    setSelectedNodeId(firstSelectedPresentation);
  }, [firstSelectedPresentation]);

  const activeIds = useMemo(() => {
    const base = selectActiveIds(adapted.context, ALL_KINDS, query);
    if (!focusCompanyId || query.trim()) return base;

    const focused = new Set<string>();
    for (const nodeId of adapted.presentationsByCompany.get(focusCompanyId) ?? []) {
      focused.add(nodeId);
      let parent = adapted.context.parentOf.get(nodeId);
      while (parent) {
        focused.add(parent);
        parent = adapted.context.parentOf.get(parent);
      }
    }
    return focused.size > 0 ? focused : base;
  }, [adapted, focusCompanyId, query]);

  if (functions.length === 0 || adapted.context.domain.nodes.length === 0) {
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
        <span>{adapted.context.domain.rootIds.length}分類 · {functions.length}機能リンク</span>
      </div>
      <p className={styles.hint}>
        Claude Code版の放射ビューと同じ描画・配置・pan/zoomを使い、大分類 → 機能領域 → 企業を複数クラスターで表示しています。同じ企業が複数機能を担う場合は複数箇所に現れます。
      </p>
      <IndustryRadialView
        context={adapted.context}
        activeIds={activeIds}
        selectedId={selectedNodeId}
        onSelect={(nodeId) => {
          setSelectedNodeId(nodeId);
          const companyId = adapted.presentationToCompany.get(nodeId);
          if (companyId) onSelectCompany(companyId);
        }}
      />
    </div>
  );
}
