/**
 * MiniToolsが依存するTheme Viewerの安定した読み取りモデル。
 *
 * stock-notesのDB行や編集APIの型をこの画面へ持ち込まない。Viewer APIの
 * versioned read modelだけを境界にし、snake_caseの既存APIから移行しやすいように
 * loader側でcamelCaseへ正規化する。
 */

export const THEME_VIEWER_CONTRACT_VERSION = "theme-viewer.v1" as const;

export type ThemeViewerContractVersion = typeof THEME_VIEWER_CONTRACT_VERSION;
export type ThemeStatus = "draft" | "active" | "archived";
export type ThemeConfidence = "high" | "medium" | "low";
export type ThemeDataState = "present" | "empty" | "missing";

export type ThemeProvenance = {
  source: string | null;
  asOf: string | null;
  confidence: ThemeConfidence | null;
};

export type ThemeSectionKey =
  | "overview"
  | "thesis"
  | "analysisHistory"
  | "evidence"
  | "directLinks"
  | "taxonomyMap"
  | "metrics"
  | "openActions";

export type ThemeSectionAvailability = {
  state: ThemeDataState;
  count: number;
};

export type ThemeListItem = {
  id: string;
  slug: string;
  displayName: string;
  status: ThemeStatus;
  summary: string | null;
  asOf: string | null;
  source: string | null;
  confidence: ThemeConfidence | null;
  updatedAt: string | null;
  analysisCount: number | null;
  openActionCount: number | null;
};

export type ThemeListData = {
  contractVersion: ThemeViewerContractVersion;
  source: string | null;
  asOf: string | null;
  themes: ThemeListItem[];
};

export type ThemeRecord = {
  id: string;
  slug: string;
  displayName: string;
  status: ThemeStatus;
  summary: string | null;
  definition: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  archivedAt: string | null;
  provenance: ThemeProvenance;
};

export type ThemeThesis = {
  id: string;
  versionNumber: number | null;
  status: string;
  definition: string | null;
  structuralHypothesis: string | null;
  confidence: ThemeConfidence | null;
  lenses: string[];
  risks: string[];
  falsificationConditions: string[];
  nextChecks: string[];
  asOf: string | null;
  source: string | null;
  basedOnAnalysisId: string | null;
};

export type ThemeAnalysis = {
  id: string;
  analysisType: string;
  conclusion: string | null;
  evidence: string | null;
  concerns: string | null;
  body: string | null;
  source: string | null;
  sourceUrl: string | null;
  asOf: string | null;
  confidence: ThemeConfidence | null;
  createdAt: string | null;
};

export type ThemeEvidence = {
  id: string;
  analysisId: string | null;
  thesisId: string | null;
  evidenceType: string;
  claimKind: string;
  stance: string;
  claim: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceAsOf: string | null;
  checkedAt: string | null;
  confidence: ThemeConfidence | null;
  verificationStatus: string | null;
};

export type ThemeDirectLink = {
  id: string;
  targetType: string;
  targetId: string | null;
  displayName: string;
  relationType: string;
  relationNote: string | null;
  url: string | null;
  status: string;
  contributionStage: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceAsOf: string | null;
  checkedAt: string | null;
  confidence: ThemeConfidence | null;
};

export type ThemeTaxonomyNode = {
  id: string;
  domain: string;
  kind: string;
  slug: string;
  displayName: string;
  description: string | null;
  status: string | null;
};

export type ThemeTaxonomyEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  relationNote: string | null;
};

export type ThemeTaxonomyLink = {
  id: string;
  nodeId: string;
  relationType: string;
  relationNote: string | null;
};

export type ThemeStockTaxonomyLink = {
  id: string;
  stockId: string;
  nodeId: string;
  strategicRole: string | null;
  controlType: string | null;
  relationNote: string | null;
  source: string | null;
  confidence: ThemeConfidence | null;
  asOf: string | null;
  validFrom: string | null;
  validTo: string | null;
};

export type ThemeTaxonomyMap = {
  nodes: ThemeTaxonomyNode[];
  edges: ThemeTaxonomyEdge[];
  themeLinks: ThemeTaxonomyLink[];
  stockLinks: ThemeStockTaxonomyLink[];
};

export type ThemeMetricDefinition = {
  id: string;
  metricKey: string;
  displayName: string;
  scope: string;
  appliesToStockId: string | null;
  unit: string | null;
  definition: string | null;
  versionNumber: number | null;
  isActive: boolean | null;
};

export type ThemeMetricSnapshot = {
  id: string;
  asOf: string | null;
  periodLabel: string | null;
  snapshotKind: string | null;
  note: string | null;
};

export type ThemeMetricValue = {
  id: string;
  snapshotId: string;
  metricId: string;
  stockId: string;
  value: number | null;
  evidenceId: string | null;
  calculationNote: string | null;
};

export type ThemeMetrics = {
  definitions: ThemeMetricDefinition[];
  snapshots: ThemeMetricSnapshot[];
  values: ThemeMetricValue[];
};

export type ThemeOpenAction = {
  id: string;
  actionType: string;
  title: string;
  detail: string | null;
  triggerCondition: string | null;
  dueDate: string | null;
  status: string;
  basedOnAnalysisId: string | null;
  basedOnThesisId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ThemeDetailData = {
  contractVersion: ThemeViewerContractVersion;
  source: string | null;
  asOf: string | null;
  theme: ThemeRecord;
  currentThesis: ThemeThesis | null;
  analysisHistory: ThemeAnalysis[];
  evidence: ThemeEvidence[];
  directLinks: ThemeDirectLink[];
  taxonomyMap: ThemeTaxonomyMap;
  metrics: ThemeMetrics;
  openActions: ThemeOpenAction[];
  availability: Record<ThemeSectionKey, ThemeSectionAvailability>;
};

export type ThemeViewerErrorStatus =
  | "not_configured"
  | "unauthorized"
  | "upstream_error"
  | "not_found"
  | "invalid_response";

export type ThemeViewerError = {
  status: ThemeViewerErrorStatus;
  message: string;
  httpStatus: number | null;
};

export type ThemeListLoadResult =
  | { status: "ok"; data: ThemeListData }
  | { status: "empty"; data: ThemeListData }
  | ThemeViewerError;

export type ThemeDetailLoadResult =
  | { status: "ok"; data: ThemeDetailData }
  | { status: "empty" }
  | ThemeViewerError;
