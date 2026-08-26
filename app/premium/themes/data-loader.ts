import type {
  ThemeAnalysis,
  ThemeConfidence,
  ThemeDetailData,
  ThemeDetailLoadResult,
  ThemeDirectLink,
  ThemeEvidence,
  ThemeListData,
  ThemeListItem,
  ThemeListLoadResult,
  ThemeMetricDefinition,
  ThemeMetricSnapshot,
  ThemeMetricValue,
  ThemeMetrics,
  ThemeOpenAction,
  ThemeProvenance,
  ThemeRecord,
  ThemeSectionAvailability,
  ThemeSectionKey,
  ThemeStatus,
  ThemeStockTaxonomyLink,
  ThemeTaxonomyEdge,
  ThemeTaxonomyLink,
  ThemeTaxonomyMap,
  ThemeTaxonomyNode,
  ThemeThesis,
  ThemeViewerError,
  ThemeViewerErrorStatus,
} from "./types";
import { THEME_VIEWER_CONTRACT_VERSION } from "./types";

/**
 * Theme Viewerはstock-notesのDBや編集APIを直接読まない。
 * このloaderはServer Componentからだけ呼び出し、tokenをprops・URL・レスポンスへ
 * 渡さない。ブラウザで使うコンポーネントからimportしないこと。
 */

const API_BASE_ENV = "STOCK_NOTES_API_BASE_URL";
const API_TOKEN_ENV = "STOCK_NOTES_API_TOKEN";
const REQUEST_TIMEOUT_MS = 5_000;

type RawObject = Record<string, unknown>;
type Fetcher = typeof fetch;

type RequestResult =
  | { ok: true; body: unknown }
  | RequestFailure;

type RequestFailure = {
  ok: false;
  status: ThemeViewerErrorStatus;
  message: string;
  httpStatus: number | null;
};

type Field = {
  found: boolean;
  value: unknown;
};

class ThemeViewerResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThemeViewerResponseError";
  }
}

function isObject(value: unknown): value is RawObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: RawObject, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readField(record: RawObject, keys: string[]): Field {
  for (const key of keys) {
    if (hasOwn(record, key)) return { found: true, value: record[key] };
  }
  return { found: false, value: undefined };
}

function requiredObject(value: unknown, label: string): RawObject {
  if (!isObject(value)) throw new ThemeViewerResponseError(`${label} is not an object`);
  return value;
}

function requiredString(record: RawObject, keys: string[], label: string): string {
  const field = readField(record, keys);
  if (typeof field.value !== "string" || field.value.trim().length === 0) {
    throw new ThemeViewerResponseError(`${label} is missing`);
  }
  return field.value;
}

function optionalString(record: RawObject, keys: string[]): string | null {
  const field = readField(record, keys);
  if (field.value === undefined || field.value === null) return null;
  if (typeof field.value !== "string") {
    throw new ThemeViewerResponseError(`${keys[0]} is not a string`);
  }
  return field.value.trim().length > 0 ? field.value : null;
}

function optionalNumber(record: RawObject, keys: string[]): number | null {
  const field = readField(record, keys);
  if (field.value === undefined || field.value === null || field.value === "") return null;
  if (typeof field.value === "number") {
    if (Number.isFinite(field.value)) return field.value;
    throw new ThemeViewerResponseError(`${keys[0]} is not finite`);
  }
  if (typeof field.value === "string" && field.value.trim().length > 0) {
    const parsed = Number(field.value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new ThemeViewerResponseError(`${keys[0]} is not a number`);
}

function optionalBoolean(record: RawObject, keys: string[]): boolean | null {
  const field = readField(record, keys);
  if (field.value === undefined || field.value === null) return null;
  if (typeof field.value === "boolean") return field.value;
  if (field.value === "true") return true;
  if (field.value === "false") return false;
  throw new ThemeViewerResponseError(`${keys[0]} is not a boolean`);
}

function stringArray(record: RawObject, keys: string[]): string[] {
  const field = readField(record, keys);
  if (field.value === undefined || field.value === null) return [];
  if (!Array.isArray(field.value)) {
    throw new ThemeViewerResponseError(`${keys[0]} is not an array`);
  }
  return field.value.filter((value): value is string => typeof value === "string");
}

function objectArray(record: RawObject, keys: string[]): { found: boolean; values: unknown[] } {
  const field = readField(record, keys);
  if (!field.found || field.value === null) return { found: field.found, values: [] };
  if (!Array.isArray(field.value)) {
    throw new ThemeViewerResponseError(`${keys[0]} is not an array`);
  }
  return { found: true, values: field.value };
}

function optionalHttpUrl(record: RawObject, keys: string[]): string | null {
  const value = optionalString(record, keys);
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function optionalConfidence(record: RawObject, keys: string[]): ThemeConfidence | null {
  const value = optionalString(record, keys);
  if (value === null) return null;
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function requiredThemeStatus(record: RawObject): ThemeStatus {
  const value = requiredString(record, ["status"], "status");
  if (value === "draft" || value === "active" || value === "archived") return value;
  throw new ThemeViewerResponseError("status is invalid");
}

function contractVersion(record: RawObject): typeof THEME_VIEWER_CONTRACT_VERSION {
  const field = readField(record, ["schemaVersion", "schema_version", "contractVersion", "contract_version"]);
  if (field.value !== undefined && field.value !== THEME_VIEWER_CONTRACT_VERSION) {
    throw new ThemeViewerResponseError("unsupported viewer contract version");
  }
  return THEME_VIEWER_CONTRACT_VERSION;
}

function topLevelProvenance(record: RawObject): ThemeProvenance {
  return {
    source: optionalString(record, ["source", "sourceSystem", "source_system"]),
    asOf: optionalString(record, ["asOf", "as_of", "generatedAt", "generated_at"]),
    confidence: optionalConfidence(record, ["confidence"]),
  };
}

function provenance(record: RawObject, fallback: ThemeProvenance): ThemeProvenance {
  const nested = readField(record, ["provenance"]);
  const sourceRecord = isObject(nested.value) ? nested.value : record;
  return {
    source: optionalString(sourceRecord, ["source", "sourceSystem", "source_system"]) ?? fallback.source,
    asOf:
      optionalString(sourceRecord, ["asOf", "as_of", "generatedAt", "generated_at"]) ?? fallback.asOf,
    confidence: optionalConfidence(sourceRecord, ["confidence"]) ?? fallback.confidence,
  };
}

function parseListItem(value: unknown, fallback: ThemeProvenance): ThemeListItem {
  const record = requiredObject(value, "theme");
  const itemProvenance = provenance(record, fallback);
  return {
    id: requiredString(record, ["id"], "theme.id"),
    slug: requiredString(record, ["slug"], "theme.slug"),
    displayName: requiredString(record, ["displayName", "display_name"], "theme.displayName"),
    status: requiredThemeStatus(record),
    summary: optionalString(record, ["summary", "overview"]),
    asOf: itemProvenance.asOf,
    source: itemProvenance.source,
    confidence: itemProvenance.confidence,
    updatedAt: optionalString(record, ["updatedAt", "updated_at"]),
    analysisCount: optionalNumber(record, ["analysisCount", "analysis_count"]),
    openActionCount: optionalNumber(record, ["openActionCount", "open_action_count"]),
  };
}

/** Viewer一覧レスポンスをcamelCaseのread modelへ変換する。 */
export function parseThemeListResponse(input: unknown): ThemeListData {
  const root = isObject(input) ? input : {};
  const fallback = topLevelProvenance(root);
  const field = Array.isArray(input)
    ? { found: true, values: input }
    : objectArray(root, ["themes"]);
  if (!field.found) throw new ThemeViewerResponseError("themes is missing");

  return {
    contractVersion: contractVersion(root),
    source: fallback.source,
    asOf: fallback.asOf,
    themes: field.values.map((item) => parseListItem(item, fallback)),
  };
}

function parseThemeRecord(value: unknown, fallback: ThemeProvenance): ThemeRecord {
  const record = requiredObject(value, "theme");
  return {
    id: requiredString(record, ["id"], "theme.id"),
    slug: requiredString(record, ["slug"], "theme.slug"),
    displayName: requiredString(record, ["displayName", "display_name"], "theme.displayName"),
    status: requiredThemeStatus(record),
    summary: optionalString(record, ["summary", "overview"]),
    definition: optionalString(record, ["definition", "themeDefinition", "theme_definition"]),
    createdAt: optionalString(record, ["createdAt", "created_at"]),
    updatedAt: optionalString(record, ["updatedAt", "updated_at"]),
    archivedAt: optionalString(record, ["archivedAt", "archived_at"]),
    provenance: provenance(record, fallback),
  };
}

function parseThesis(value: unknown, fallback: ThemeProvenance): ThemeThesis {
  const record = requiredObject(value, "currentThesis");
  return {
    id: requiredString(record, ["id"], "currentThesis.id"),
    versionNumber: optionalNumber(record, ["versionNumber", "version_number"]),
    status: optionalString(record, ["status"]) ?? "draft",
    definition: optionalString(record, ["definition"]),
    structuralHypothesis: optionalString(record, ["structuralHypothesis", "structural_hypothesis"]),
    confidence:
      optionalConfidence(record, ["confidence"]) ??
      provenance(record, fallback).confidence,
    lenses: stringArray(record, ["lenses"]),
    risks: stringArray(record, ["risks"]),
    falsificationConditions: stringArray(record, ["falsificationConditions", "falsification_conditions"]),
    nextChecks: stringArray(record, ["nextChecks", "next_checks"]),
    asOf: optionalString(record, ["asOf", "as_of"]),
    source: provenance(record, fallback).source,
    basedOnAnalysisId: optionalString(record, ["basedOnAnalysisId", "based_on_analysis_id"]),
  };
}

function parseAnalysis(value: unknown, fallback: ThemeProvenance): ThemeAnalysis {
  const record = requiredObject(value, "analysis");
  const analysisProvenance = provenance(record, fallback);
  return {
    id: requiredString(record, ["id"], "analysis.id"),
    analysisType: optionalString(record, ["analysisType", "analysis_type"]) ?? "other",
    conclusion: optionalString(record, ["conclusion"]),
    evidence: optionalString(record, ["evidence"]),
    concerns: optionalString(record, ["concerns"]),
    body: optionalString(record, ["body", "bodySummary", "body_summary"]),
    source: analysisProvenance.source,
    sourceUrl: optionalHttpUrl(record, ["sourceUrl", "source_url"]),
    asOf:
      optionalString(record, ["asOf", "as_of", "analyzedAt", "analyzed_at"]) ?? analysisProvenance.asOf,
    confidence: optionalConfidence(record, ["confidence"]) ?? fallback.confidence,
    createdAt: optionalString(record, ["createdAt", "created_at"]),
  };
}

function parseEvidence(value: unknown, fallback: ThemeProvenance): ThemeEvidence {
  const record = requiredObject(value, "evidence");
  return {
    id: requiredString(record, ["id"], "evidence.id"),
    analysisId: optionalString(record, ["analysisId", "analysis_id"]),
    thesisId: optionalString(record, ["thesisId", "thesis_id"]),
    evidenceType: optionalString(record, ["evidenceType", "evidence_type"]) ?? "other",
    claimKind: optionalString(record, ["claimKind", "claim_kind"]) ?? "other",
    stance: optionalString(record, ["stance"]) ?? "context",
    claim: optionalString(record, ["claim", "claimSummary", "claim_summary"]),
    sourceTitle: optionalString(record, ["sourceTitle", "source_title"]),
    sourceUrl: optionalHttpUrl(record, ["sourceUrl", "source_url"]),
    sourceType: optionalString(record, ["sourceType", "source_type"]),
    sourceAsOf: optionalString(record, ["sourceAsOf", "source_as_of"]),
    checkedAt: optionalString(record, ["checkedAt", "checked_at"]),
    confidence: optionalConfidence(record, ["confidence"]) ?? fallback.confidence,
    verificationStatus: optionalString(record, ["verificationStatus", "verification_status"]),
  };
}

function parseDirectLink(value: unknown, fallback: ThemeProvenance): ThemeDirectLink {
  const record = requiredObject(value, "directLink");
  return {
    id: requiredString(record, ["id"], "directLink.id"),
    targetType: optionalString(record, ["targetType", "target_type"]) ?? "other",
    targetId: optionalString(record, ["targetId", "target_id", "stockId", "stock_id"]),
    displayName: requiredString(record, ["displayName", "display_name", "label"], "directLink.displayName"),
    relationType: optionalString(record, ["relationType", "relation_type"]) ?? "related",
    relationNote: optionalString(record, ["relationNote", "relation_note"]),
    url: optionalHttpUrl(record, ["url", "targetUrl", "target_url", "href"]),
    status: optionalString(record, ["status"]) ?? "proposed",
    contributionStage: optionalString(record, ["contributionStage", "contribution_stage"]),
    sourceTitle: optionalString(record, ["sourceTitle", "source_title"]),
    sourceUrl: optionalHttpUrl(record, ["sourceUrl", "source_url"]),
    sourceAsOf: optionalString(record, ["sourceAsOf", "source_as_of"]) ?? fallback.asOf,
    checkedAt: optionalString(record, ["checkedAt", "checked_at"]),
    confidence: optionalConfidence(record, ["confidence"]) ?? fallback.confidence,
  };
}

function parseTaxonomyNode(value: unknown): ThemeTaxonomyNode {
  const record = requiredObject(value, "taxonomy node");
  return {
    id: requiredString(record, ["id"], "taxonomyNode.id"),
    domain: optionalString(record, ["domain"]) ?? "unknown",
    kind: optionalString(record, ["kind"]) ?? "unknown",
    slug: requiredString(record, ["slug"], "taxonomyNode.slug"),
    displayName: requiredString(record, ["displayName", "display_name"], "taxonomyNode.displayName"),
    description: optionalString(record, ["description"]),
    status: optionalString(record, ["status"]),
  };
}

function parseTaxonomyEdge(value: unknown): ThemeTaxonomyEdge {
  const record = requiredObject(value, "taxonomy edge");
  return {
    id: requiredString(record, ["id"], "taxonomyEdge.id"),
    sourceNodeId: requiredString(record, ["sourceNodeId", "source_node_id"], "taxonomyEdge.sourceNodeId"),
    targetNodeId: requiredString(record, ["targetNodeId", "target_node_id"], "taxonomyEdge.targetNodeId"),
    relationType: optionalString(record, ["relationType", "relation_type"]) ?? "related_to",
    relationNote: optionalString(record, ["relationNote", "relation_note"]),
  };
}

function parseTaxonomyLink(value: unknown): ThemeTaxonomyLink {
  const record = requiredObject(value, "theme taxonomy link");
  return {
    id: requiredString(record, ["id"], "themeTaxonomyLink.id"),
    nodeId: requiredString(record, ["nodeId", "node_id"], "themeTaxonomyLink.nodeId"),
    relationType: optionalString(record, ["relationType", "relation_type"]) ?? "related",
    relationNote: optionalString(record, ["relationNote", "relation_note"]),
  };
}

function parseStockTaxonomyLink(value: unknown, fallback: ThemeProvenance): ThemeStockTaxonomyLink {
  const record = requiredObject(value, "stock taxonomy link");
  return {
    id: requiredString(record, ["id"], "stockTaxonomyLink.id"),
    stockId: requiredString(record, ["stockId", "stock_id"], "stockTaxonomyLink.stockId"),
    nodeId: requiredString(record, ["nodeId", "node_id"], "stockTaxonomyLink.nodeId"),
    strategicRole: optionalString(record, ["strategicRole", "strategic_role"]),
    controlType: optionalString(record, ["controlType", "control_type"]),
    relationNote: optionalString(record, ["relationNote", "relation_note"]),
    source: optionalString(record, ["source", "sourceType", "source_type"]) ?? fallback.source,
    confidence: optionalConfidence(record, ["confidence"]) ?? fallback.confidence,
    asOf: optionalString(record, ["asOf", "as_of"]) ?? fallback.asOf,
    validFrom: optionalString(record, ["validFrom", "valid_from"]),
    validTo: optionalString(record, ["validTo", "valid_to"]),
  };
}

function parseTaxonomyMap(value: unknown, fallback: ThemeProvenance): ThemeTaxonomyMap {
  if (value === null || value === undefined) {
    return { nodes: [], edges: [], themeLinks: [], stockLinks: [] };
  }
  const record = requiredObject(value, "taxonomyMap");
  const nodes = objectArray(record, ["nodes"]).values.map(parseTaxonomyNode);
  const edges = objectArray(record, ["edges"]).values.map(parseTaxonomyEdge);
  const themeLinks = objectArray(record, ["themeLinks", "theme_links"]).values.map(parseTaxonomyLink);
  const stockLinks = objectArray(record, ["stockLinks", "stock_links"]).values.map((item) =>
    parseStockTaxonomyLink(item, fallback),
  );
  return { nodes, edges, themeLinks, stockLinks };
}

function parseMetricDefinition(value: unknown): ThemeMetricDefinition {
  const record = requiredObject(value, "metric definition");
  return {
    id: requiredString(record, ["id"], "metricDefinition.id"),
    metricKey: requiredString(record, ["metricKey", "metric_key"], "metricDefinition.metricKey"),
    displayName: requiredString(record, ["displayName", "display_name"], "metricDefinition.displayName"),
    scope: optionalString(record, ["scope", "metricScope", "metric_scope"]) ?? "common",
    appliesToStockId: optionalString(record, ["appliesToStockId", "applies_to_stock_id"]),
    unit: optionalString(record, ["unit"]),
    definition: optionalString(record, ["definition"]),
    versionNumber: optionalNumber(record, ["versionNumber", "version_number"]),
    isActive: optionalBoolean(record, ["isActive", "is_active"]),
  };
}

function parseMetricSnapshot(value: unknown): ThemeMetricSnapshot {
  const record = requiredObject(value, "metric snapshot");
  return {
    id: requiredString(record, ["id"], "metricSnapshot.id"),
    asOf: optionalString(record, ["asOf", "as_of"]),
    periodLabel: optionalString(record, ["periodLabel", "period_label"]),
    snapshotKind: optionalString(record, ["snapshotKind", "snapshot_kind"]),
    note: optionalString(record, ["note"]),
  };
}

function parseMetricValue(value: unknown): ThemeMetricValue {
  const record = requiredObject(value, "metric value");
  return {
    id: requiredString(record, ["id"], "metricValue.id"),
    snapshotId: requiredString(record, ["snapshotId", "snapshot_id"], "metricValue.snapshotId"),
    metricId: requiredString(record, ["metricId", "metric_id"], "metricValue.metricId"),
    stockId: requiredString(record, ["stockId", "stock_id"], "metricValue.stockId"),
    value: optionalNumber(record, ["value"]),
    evidenceId: optionalString(record, ["evidenceId", "evidence_id"]),
    calculationNote: optionalString(record, ["calculationNote", "calculation_note"]),
  };
}

function parseMetrics(value: unknown): ThemeMetrics {
  if (value === null || value === undefined) {
    return { definitions: [], snapshots: [], values: [] };
  }
  const record = requiredObject(value, "metrics");
  return {
    definitions: objectArray(record, ["definitions", "metricDefinitions", "metric_definitions"]).values.map(
      parseMetricDefinition,
    ),
    snapshots: objectArray(record, ["snapshots", "metricSnapshots", "metric_snapshots"]).values.map(
      parseMetricSnapshot,
    ),
    values: objectArray(record, ["values", "metricValues", "metric_values"]).values.map(parseMetricValue),
  };
}

function parseOpenAction(value: unknown): ThemeOpenAction {
  const record = requiredObject(value, "open action");
  return {
    id: requiredString(record, ["id"], "openAction.id"),
    actionType: optionalString(record, ["actionType", "action_type"]) ?? "other",
    title: requiredString(record, ["title"], "openAction.title"),
    detail: optionalString(record, ["detail", "detailSummary", "detail_summary"]),
    triggerCondition: optionalString(record, ["triggerCondition", "trigger_condition", "triggerConditionSummary"]),
    dueDate: optionalString(record, ["dueDate", "due_date"]),
    status: optionalString(record, ["status"]) ?? "open",
    basedOnAnalysisId: optionalString(record, ["basedOnAnalysisId", "based_on_analysis_id"]),
    basedOnThesisId: optionalString(record, ["basedOnThesisId", "based_on_thesis_id"]),
    createdAt: optionalString(record, ["createdAt", "created_at"]),
    updatedAt: optionalString(record, ["updatedAt", "updated_at"]),
  };
}

function section(state: ThemeSectionAvailability["state"], count: number): ThemeSectionAvailability {
  return { state, count };
}

function collectionSection(record: RawObject, keys: string[], count: number): ThemeSectionAvailability {
  const field = readField(record, keys);
  if (!field.found) return section("missing", 0);
  return section(count > 0 ? "present" : "empty", count);
}

function buildAvailability(
  root: RawObject,
  themeRecord: RawObject,
  thesisField: Field,
  analysisHistory: ThemeAnalysis[],
  evidence: ThemeEvidence[],
  directLinks: ThemeDirectLink[],
  taxonomyMap: ThemeTaxonomyMap,
  metrics: ThemeMetrics,
  openActions: ThemeOpenAction[],
): Record<ThemeSectionKey, ThemeSectionAvailability> {
  const overviewFields = [
    readField(themeRecord, ["summary", "overview"]),
    readField(themeRecord, ["definition", "themeDefinition", "theme_definition"]),
  ];
  const overviewCount = overviewFields.filter((field) => typeof field.value === "string" && field.value.trim()).length;
  const taxonomyCount =
    taxonomyMap.nodes.length +
    taxonomyMap.edges.length +
    taxonomyMap.themeLinks.length +
    taxonomyMap.stockLinks.length;
  const metricsCount = metrics.definitions.length + metrics.snapshots.length + metrics.values.length;

  return {
    overview: section(
      overviewFields.some((field) => field.found)
        ? overviewCount > 0
          ? "present"
          : "empty"
        : "missing",
      overviewCount,
    ),
    thesis: !thesisField.found
      ? section("missing", 0)
      : thesisField.value === null
        ? section("empty", 0)
        : section("present", 1),
    analysisHistory: collectionSection(root, ["analysisHistory", "analysis_history", "analyses"], analysisHistory.length),
    evidence: collectionSection(root, ["evidence", "evidenceRecords", "evidence_records"], evidence.length),
    directLinks: collectionSection(root, ["directLinks", "direct_links", "links"], directLinks.length),
    taxonomyMap: collectionSection(root, ["taxonomyMap", "taxonomy_map", "taxonomy"], taxonomyCount),
    metrics: collectionSection(root, ["metrics", "metricData", "metric_data"], metricsCount),
    openActions: collectionSection(root, ["openActions", "open_actions", "actions"], openActions.length),
  };
}

/** Viewer詳細レスポンスをcamelCaseのread modelへ変換する。nullは「対象なし」を表す。 */
export function parseThemeDetailResponse(input: unknown): ThemeDetailData | null {
  const root = requiredObject(input, "viewer detail");
  const viewerContractVersion = contractVersion(root);
  const themeField = readField(root, ["theme"]);
  if (themeField.found && themeField.value === null) return null;
  const themeValue = themeField.found ? themeField.value : root;
  const topProvenance = topLevelProvenance(root);
  const themeRecord = requiredObject(themeValue, "theme");
  const theme = parseThemeRecord(themeRecord, topProvenance);

  const thesisField = readField(root, ["currentThesis", "current_thesis", "activeThesis", "active_thesis", "thesis"]);
  const currentThesis =
    thesisField.found && thesisField.value !== null
      ? parseThesis(thesisField.value, theme.provenance)
      : null;

  const analysisField = objectArray(root, ["analysisHistory", "analysis_history", "analyses"]);
  const evidenceField = objectArray(root, ["evidence", "evidenceRecords", "evidence_records"]);
  const linksField = objectArray(root, ["directLinks", "direct_links", "links"]);
  const taxonomyField = readField(root, ["taxonomyMap", "taxonomy_map", "taxonomy"]);
  const metricsField = readField(root, ["metrics", "metricData", "metric_data"]);
  const actionsField = objectArray(root, ["openActions", "open_actions", "actions"]);

  const analysisHistory = analysisField.values.map((item) => parseAnalysis(item, theme.provenance));
  const evidence = evidenceField.values.map((item) => parseEvidence(item, theme.provenance));
  const directLinks = linksField.values.map((item) => parseDirectLink(item, theme.provenance));
  const taxonomyMap = parseTaxonomyMap(taxonomyField.value, theme.provenance);
  const metrics = parseMetrics(metricsField.value);
  const openActions = actionsField.values.map(parseOpenAction);

  return {
    contractVersion: viewerContractVersion,
    source: topProvenance.source ?? theme.provenance.source,
    asOf: topProvenance.asOf ?? theme.provenance.asOf,
    theme,
    currentThesis,
    analysisHistory,
    evidence,
    directLinks,
    taxonomyMap,
    metrics,
    openActions,
    availability: buildAvailability(
      root,
      themeRecord,
      thesisField,
      analysisHistory,
      evidence,
      directLinks,
      taxonomyMap,
      metrics,
      openActions,
    ),
  };
}

function configuredApi(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env[API_BASE_ENV]?.trim().replace(/\/+$/, "") ?? "";
  const token = process.env[API_TOKEN_ENV]?.trim() ?? "";
  if (!baseUrl || !token) return null;
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { baseUrl, token };
}

function errorResult(
  status: ThemeViewerErrorStatus,
  message: string,
  httpStatus: number | null = null,
): RequestFailure {
  return { ok: false, status, message, httpStatus };
}

function viewerError(failure: RequestFailure): ThemeViewerError {
  return {
    status: failure.status,
    message: failure.message,
    httpStatus: failure.httpStatus,
  };
}

async function requestViewerJson(
  path: string,
  kind: "list" | "detail",
  fetcher: Fetcher,
): Promise<RequestResult> {
  const config = configuredApi();
  if (!config) {
    return errorResult(
      "not_configured",
      `stock-notes Theme Viewer APIの設定がありません（${API_BASE_ENV} / ${API_TOKEN_ENV}）。`,
    );
  }

  let url: string;
  try {
    // API_BASE_URLに `/api` などのprefixが含まれる環境でもprefixを維持する。
    url = new URL(path.replace(/^\/+/, ""), `${config.baseUrl}/`).toString();
  } catch {
    return errorResult("not_configured", `${API_BASE_ENV} のURLが不正です。`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 401) {
      return errorResult("unauthorized", "stock-notes APIの認証に失敗しました。", response.status);
    }
    if (kind === "detail" && response.status === 404) {
      return errorResult("not_found", "指定されたテーマは見つかりません。", response.status);
    }
    if (response.status >= 500) {
      return errorResult(
        "upstream_error",
        `stock-notes APIで一時的なエラーが発生しました（HTTP ${response.status}）。`,
        response.status,
      );
    }
    if (!response.ok) {
      return errorResult(
        "upstream_error",
        `stock-notes APIからデータを取得できませんでした（HTTP ${response.status}）。`,
        response.status,
      );
    }

    try {
      return { ok: true, body: await response.json() };
    } catch {
      return errorResult("invalid_response", "stock-notes APIのレスポンスを読み取れませんでした。");
    }
  } catch {
    return errorResult("upstream_error", "stock-notes APIへ接続できませんでした。");
  } finally {
    clearTimeout(timeoutId);
  }
}

function invalidResponseResult(message = "stock-notes APIのレスポンス形式が契約と異なります。"): ThemeViewerError {
  return {
    status: "invalid_response" as const,
    message,
    httpStatus: null,
  };
}

export async function loadThemeList(fetcher: Fetcher = fetch): Promise<ThemeListLoadResult> {
  const response = await requestViewerJson("/viewer/themes", "list", fetcher);
  if (response.ok === false) return viewerError(response);

  try {
    const data = parseThemeListResponse(response.body);
    return data.themes.length === 0 ? { status: "empty", data } : { status: "ok", data };
  } catch {
    return invalidResponseResult();
  }
}

export async function loadThemeDetail(
  themeId: string,
  fetcher: Fetcher = fetch,
): Promise<ThemeDetailLoadResult> {
  if (!themeId.trim()) return invalidResponseResult("テーマIDが空です。");
  const response = await requestViewerJson(`/viewer/themes/${encodeURIComponent(themeId)}`, "detail", fetcher);
  if (response.ok === false) return viewerError(response);

  try {
    const data = parseThemeDetailResponse(response.body);
    return data === null ? { status: "empty" } : { status: "ok", data };
  } catch {
    return invalidResponseResult();
  }
}

export const themeViewerConfig = {
  baseEnv: API_BASE_ENV,
  tokenEnv: API_TOKEN_ENV,
};
