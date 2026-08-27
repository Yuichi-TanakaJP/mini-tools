/**
 * 業界マップ（Supabase `stock_notes_taxonomy_*`）の読み取りモデル。
 *
 * DB は snake_case、UI は camelCase で扱う。変換は data-loader に閉じる。
 * このモデルは閲覧専用であり、売買推奨や数値スコアを持たない。
 */

export const INDUSTRY_MAP_MODEL_VERSION = "industry-map.v1" as const;

export type TaxonomyKind = "classification" | "product_segment" | "technology";

export type RelationType =
  | "contains"
  | "part_of"
  | "enables"
  | "used_for"
  | "depends_on"
  | "related_to";

/** 階層の背骨を作る関係。ツリー・放射マップはこれだけを使う。 */
export const HIERARCHY_RELATIONS: readonly RelationType[] = ["contains", "part_of"];

/** 階層をまたぐ関係。ツリーでは辺として描かず、バッジで存在だけ示す。 */
export const CROSS_RELATIONS: readonly RelationType[] = [
  "depends_on",
  "enables",
  "used_for",
  "related_to",
];

export type StrategicRole = "core" | "growth" | "supporting" | "experimental" | "adjacent";

export type ControlType =
  | "owned"
  | "controlled"
  | "partnered"
  | "integrated"
  | "used"
  | "unknown";

export type Confidence = "high" | "medium" | "low";

export type ThemeRelationType =
  | "scope"
  | "focus"
  | "beneficiary_area"
  | "risk_area"
  | "monitoring_axis"
  | "related";

export type IndustryNode = {
  id: string;
  domain: string;
  kind: TaxonomyKind;
  slug: string;
  displayName: string;
  description: string;
  status: "draft" | "active" | "archived";
  /** `metadata.layer`。企業経済圏マップの root / origin / service など。無ければ null。 */
  layer: string | null;
};

export type IndustryEdge = {
  id: string;
  domain: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  note: string;
};

export type IndustryStock = {
  id: string;
  code: string;
  name: string;
  category: string;
};

export type IndustryStockLink = {
  stockId: string;
  nodeId: string;
  strategicRole: StrategicRole;
  controlType: ControlType;
  confidence: Confidence;
  sourceType: string;
  note: string;
};

export type IndustryTheme = {
  id: string;
  slug: string;
  displayName: string;
  status: "draft" | "active" | "archived";
};

export type IndustryThemeLink = {
  themeId: string;
  nodeId: string;
  relationType: ThemeRelationType;
  note: string;
};

/** 1 domain 分の業界マップ。画面はこの単位で切り替える。 */
export type IndustryDomain = {
  domain: string;
  /** ルートノードの表示名。無ければ domain slug をそのまま使う。 */
  label: string;
  /** 階層の起点。複数ありうる。 */
  rootIds: string[];
  nodes: IndustryNode[];
  edges: IndustryEdge[];
  stockLinks: IndustryStockLink[];
  themeLinks: IndustryThemeLink[];
};

export type IndustryMapData = {
  modelVersion: typeof INDUSTRY_MAP_MODEL_VERSION;
  domains: IndustryDomain[];
  stocks: IndustryStock[];
  themes: IndustryTheme[];
};

export type IndustryMapLoadStatus =
  | "ok"
  /** Supabase env が未設定。同期機能そのものが無効。 */
  | "unconfigured"
  /** Supabase セッションが無い。RLS でどのみち 0 件になる。 */
  | "unauthenticated"
  /** 取得は成功したがノードが 0 件。 */
  | "empty"
  /** 取得に失敗した。0 件と区別する。 */
  | "error";

export type IndustryMapLoadResult = {
  status: IndustryMapLoadStatus;
  data: IndustryMapData | null;
  /** 失敗時に画面へ出す説明。成功時は null。 */
  message: string | null;
};

export type ViewMode = "tree" | "radial" | "network" | "matrix" | "table";
