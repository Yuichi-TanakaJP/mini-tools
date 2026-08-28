import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INDUSTRY_MAP_MODEL_VERSION,
  type ControlType,
  type Confidence,
  type IndustryDomain,
  type IndustryEdge,
  type IndustryMapData,
  type IndustryMapLoadResult,
  type IndustryCompanyLink,
  type IndustryNode,
  type IndustryTheme,
  type IndustryThemeLink,
  type RelationType,
  type StrategicRole,
  type TaxonomyKind,
  type ThemeRelationType,
} from "./types";

/**
 * 業界マップは Supabase を RLS 経由で直接読む。
 * Server Component からだけ呼び出すこと。
 *
 * stock-notes の Viewer API を使わない理由は
 * docs/decision-log/2026-08-28-industry-map-view-selection.md を参照。
 */

const ROW_LIMIT = 2000;

const KINDS: readonly string[] = ["classification", "product_segment", "technology"];
const RELATIONS: readonly string[] = [
  "contains",
  "part_of",
  "enables",
  "used_for",
  "depends_on",
  "related_to",
];
const ROLES: readonly string[] = ["core", "growth", "supporting", "experimental", "adjacent"];
const CONTROLS: readonly string[] = [
  "owned",
  "controlled",
  "partnered",
  "integrated",
  "used",
  "unknown",
];
const CONFIDENCES: readonly string[] = ["high", "medium", "low"];
const THEME_RELATIONS: readonly string[] = [
  "scope",
  "focus",
  "beneficiary_area",
  "risk_area",
  "monitoring_axis",
  "related",
];
const STATUSES: readonly string[] = ["draft", "active", "archived"];

type Row = Record<string, unknown>;

export type RawIndustryMap = {
  nodes: Row[];
  edges: Row[];
  companyLinks: Row[];
  themeLinks: Row[];
  themes: Row[];
};

function str(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nonEmpty(row: Row, key: string): string | null {
  const value = str(row, key).trim();
  return value.length > 0 ? value : null;
}

function oneOf<T extends string>(row: Row, key: string, allowed: readonly string[]): T | null {
  const value = str(row, key);
  return allowed.includes(value) ? (value as T) : null;
}

/** `metadata` は jsonb。`layer` だけを読む。形が違えば null にする。 */
function readLayer(row: Row): string | null {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const layer = (metadata as Row).layer;
  return typeof layer === "string" && layer.trim().length > 0 ? layer : null;
}

function parseNode(row: Row): IndustryNode | null {
  const id = nonEmpty(row, "id");
  const domain = nonEmpty(row, "domain");
  const displayName = nonEmpty(row, "display_name");
  const kind = oneOf<TaxonomyKind>(row, "kind", KINDS);
  const status = oneOf<IndustryNode["status"]>(row, "status", STATUSES);
  if (!id || !domain || !displayName || !kind || !status) return null;

  return {
    id,
    domain,
    kind,
    slug: str(row, "slug"),
    displayName,
    description: str(row, "description"),
    status,
    layer: readLayer(row),
  };
}

function parseEdge(row: Row): IndustryEdge | null {
  const id = nonEmpty(row, "id");
  const domain = nonEmpty(row, "domain");
  const sourceId = nonEmpty(row, "source_node_id");
  const targetId = nonEmpty(row, "target_node_id");
  const relationType = oneOf<RelationType>(row, "relation_type", RELATIONS);
  if (!id || !domain || !sourceId || !targetId || !relationType) return null;
  if (sourceId === targetId) return null;

  return { id, domain, sourceId, targetId, relationType, note: str(row, "relation_note") };
}

function parseCompanyLink(row: Row): IndustryCompanyLink | null {
  const linkId = nonEmpty(row, "company_taxonomy_link_id");
  const companyId = nonEmpty(row, "company_entity_id");
  const companyName = nonEmpty(row, "company_name");
  const nodeId = nonEmpty(row, "node_id");
  const strategicRole = oneOf<StrategicRole>(row, "strategic_role", ROLES);
  const controlType = oneOf<ControlType>(row, "control_type", CONTROLS);
  const confidence = oneOf<Confidence>(row, "confidence", CONFIDENCES);
  if (!linkId || !companyId || !companyName || !nodeId) return null;
  if (!strategicRole || !controlType || !confidence) return null;

  return {
    linkId,
    companyId,
    companyName,
    companySlug: str(row, "company_slug"),
    // status / listing / country は Supabase 側で値が増えうるので検証しない。
    companyStatus: str(row, "company_status"),
    countryCode: nonEmpty(row, "country_code"),
    listingStatus: str(row, "listing_status"),
    nodeId,
    strategicRole,
    controlType,
    confidence,
    sourceType: str(row, "source_type"),
    note: str(row, "relation_note"),
    asOf: nonEmpty(row, "as_of"),
    stockId: nonEmpty(row, "stock_id"),
    stockCode: nonEmpty(row, "stock_code"),
    stockName: nonEmpty(row, "stock_name"),
  };
}

function parseThemeLink(row: Row): IndustryThemeLink | null {
  const themeId = nonEmpty(row, "theme_id");
  const nodeId = nonEmpty(row, "node_id");
  const relationType = oneOf<ThemeRelationType>(row, "relation_type", THEME_RELATIONS);
  if (!themeId || !nodeId || !relationType) return null;

  return { themeId, nodeId, relationType, note: str(row, "relation_note") };
}

function parseTheme(row: Row): IndustryTheme | null {
  const id = nonEmpty(row, "id");
  const displayName = nonEmpty(row, "display_name");
  const status = oneOf<IndustryTheme["status"]>(row, "status", STATUSES);
  if (!id || !displayName || !status) return null;
  return { id, slug: str(row, "slug"), displayName, status };
}

/**
 * 階層の起点を求める。
 * `contains` は 親→子、`part_of` は 子→親 なので、
 * 「`contains` で指されず、`part_of` を出していない」ノードが起点になる。
 */
function findRootIds(nodes: IndustryNode[], edges: IndustryEdge[]): string[] {
  const hasParent = new Set<string>();
  for (const edge of edges) {
    if (edge.relationType === "contains") hasParent.add(edge.targetId);
    if (edge.relationType === "part_of") hasParent.add(edge.sourceId);
  }

  const roots = nodes.filter((node) => !hasParent.has(node.id)).map((node) => node.id);
  // 全ノードが親を持つ（循環している）場合でも画面を空にしない。
  return roots.length > 0 ? roots : nodes.slice(0, 1).map((node) => node.id);
}

/** domain のラベルは、階層の起点になっている classification の表示名を使う。 */
function domainLabel(domain: string, nodes: IndustryNode[], rootIds: string[]): string {
  const rootSet = new Set(rootIds);
  const root =
    nodes.find((node) => rootSet.has(node.id) && node.kind === "classification") ??
    nodes.find((node) => rootSet.has(node.id));
  return root?.displayName ?? domain;
}

/** 行の集合から domain 単位のマップを組み立てる。副作用のない純関数。 */
export function buildIndustryMap(raw: RawIndustryMap): IndustryMapData {
  const nodes = raw.nodes.map(parseNode).filter((node): node is IndustryNode => node !== null);
  const edges = raw.edges.map(parseEdge).filter((edge): edge is IndustryEdge => edge !== null);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const companyLinks = raw.companyLinks
    .map(parseCompanyLink)
    .filter((link): link is IndustryCompanyLink => link !== null && nodeById.has(link.nodeId));
  const themeLinks = raw.themeLinks
    .map(parseThemeLink)
    .filter((link): link is IndustryThemeLink => link !== null && nodeById.has(link.nodeId));

  const domainNames = [...new Set(nodes.map((node) => node.domain))];
  const domains: IndustryDomain[] = domainNames.map((domain) => {
    const domainNodes = nodes.filter((node) => node.domain === domain);
    const domainNodeIds = new Set(domainNodes.map((node) => node.id));
    // domain 列ではなく実ノードの所属で絞る。両端が domain 内にある辺だけを採る。
    const domainEdges = edges.filter(
      (edge) => domainNodeIds.has(edge.sourceId) && domainNodeIds.has(edge.targetId),
    );
    const rootIds = findRootIds(domainNodes, domainEdges);

    return {
      domain,
      label: domainLabel(domain, domainNodes, rootIds),
      rootIds,
      nodes: domainNodes,
      edges: domainEdges,
      companyLinks: companyLinks.filter((link) => domainNodeIds.has(link.nodeId)),
      themeLinks: themeLinks.filter((link) => domainNodeIds.has(link.nodeId)),
    };
  });

  // ノード数の多い domain を先に出す。同数なら表示名で安定させる。
  domains.sort((a, b) => b.nodes.length - a.nodes.length || a.label.localeCompare(b.label, "ja"));

  const usedThemeIds = new Set(themeLinks.map((link) => link.themeId));

  return {
    modelVersion: INDUSTRY_MAP_MODEL_VERSION,
    domains,
    themes: raw.themes
      .map(parseTheme)
      .filter((theme): theme is IndustryTheme => theme !== null && usedThemeIds.has(theme.id)),
    companyLayerFailed: false,
  };
}

export function industryMapUnconfigured(): IndustryMapLoadResult {
  return {
    status: "unconfigured",
    data: null,
    message: "Supabase 連携が未設定のため業界マップを取得できません。",
  };
}

export function industryMapAuthRequired(): IndustryMapLoadResult {
  return {
    status: "unauthenticated",
    data: null,
    message: "Supabase にログインすると、保存済みの業界マップを表示します。",
  };
}

type TableQuery = {
  table: string;
  columns: string;
  orderBy: string;
  /** 有効期間が切れていない行だけを見る。履歴行は現時点では扱わない。 */
  currentOnly?: boolean;
  /**
   * 取得に失敗しても画面全体を失敗にしない層。
   * リポジトリ外（Supabase 側）で管理されている対象に使う。
   */
  optional?: boolean;
};

const QUERIES: Record<keyof RawIndustryMap, TableQuery> = {
  nodes: {
    table: "stock_notes_taxonomy_nodes",
    columns: "id,domain,kind,slug,display_name,description,status,metadata,created_at",
    orderBy: "created_at",
  },
  edges: {
    table: "stock_notes_taxonomy_edges",
    columns: "id,domain,source_node_id,target_node_id,relation_type,relation_note,created_at",
    orderBy: "created_at",
  },
  /*
   * 企業レイヤーは Supabase 側で用意された業界マップ専用ビューから読む。
   * 上場銘柄に限らない企業（非上場・海外を含む）を扱えるのはこの経路だけ。
   */
  companyLinks: {
    table: "stock_notes_industry_map_company_links_v1",
    columns:
      "company_taxonomy_link_id,company_entity_id,company_name,company_slug,company_status," +
      "country_code,listing_status,node_id,strategic_role,control_type,confidence," +
      "source_type,relation_note,as_of,stock_id,stock_code,stock_name,valid_to",
    orderBy: "company_name",
    currentOnly: true,
    optional: true,
  },
  themeLinks: {
    table: "stock_notes_theme_taxonomy_links",
    columns: "theme_id,node_id,relation_type,relation_note,created_at",
    orderBy: "created_at",
  },
  themes: {
    table: "stock_notes_themes",
    columns: "id,slug,display_name,status",
    orderBy: "display_name",
  },
};

export async function loadIndustryMap(
  supabase: SupabaseClient,
): Promise<IndustryMapLoadResult> {
  const keys = Object.keys(QUERIES) as (keyof RawIndustryMap)[];

  const results = await Promise.all(
    keys.map(async (key) => {
      const query = QUERIES[key];
      let builder = supabase.from(query.table).select(query.columns);
      if (query.currentOnly) builder = builder.is("valid_to", null);
      return builder.order(query.orderBy, { ascending: true }).limit(ROW_LIMIT);
    }),
  );

  const raw = {} as RawIndustryMap;
  let companyLayerFailed = false;
  for (const [index, key] of keys.entries()) {
    const query = QUERIES[key];
    const result = results[index];
    if (result.error) {
      if (!query.optional) {
        // 取得失敗を 0 件として表示しない。
        return {
          status: "error",
          data: null,
          message: `業界マップの取得に失敗しました（${query.table}）。`,
        };
      }
      // 任意の層は空で続行し、画面側で「0件」と区別して知らせる。
      companyLayerFailed = true;
      raw[key] = [];
      continue;
    }
    raw[key] = (result.data ?? []) as unknown as Row[];
  }

  const data = { ...buildIndustryMap(raw), companyLayerFailed };
  if (data.domains.length === 0) {
    return {
      status: "empty",
      data,
      message: "保存済みの業界マップがまだありません。",
    };
  }

  return { status: "ok", data, message: null };
}
