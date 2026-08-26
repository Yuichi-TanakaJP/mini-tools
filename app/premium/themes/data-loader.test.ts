import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadThemeDetail, loadThemeList, parseThemeDetailResponse } from "./data-loader";

const API_BASE_ENV = "STOCK_NOTES_API_BASE_URL";
const API_TOKEN_ENV = "STOCK_NOTES_API_TOKEN";
const API_BASE = "https://stock-notes.example.test/api/";
const API_TOKEN = "theme-viewer-test-token";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function setApiConfig() {
  process.env[API_BASE_ENV] = API_BASE;
  process.env[API_TOKEN_ENV] = API_TOKEN;
}

function fullDetailResponse() {
  return {
    schemaVersion: "theme-viewer.v1",
    source: "stock-notes",
    asOf: "2026-08-27T00:00:00Z",
    theme: {
      id: "theme-1",
      slug: "ai-infrastructure",
      displayName: "AI infrastructure",
      status: "draft",
      summary: "AI infrastructure investment theme",
      definition: "A theme about the infrastructure supporting AI workloads.",
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-27T00:00:00Z",
      archivedAt: null,
      provenance: {
        source: "chatgpt-supabase",
        asOf: "2026-08-26",
        confidence: "medium",
      },
    },
    currentThesis: {
      id: "thesis-1",
      versionNumber: 2,
      status: "draft",
      definition: "Demand for compute and power may expand together.",
      structuralHypothesis: "Capacity constraints can persist through the build-out.",
      confidence: "medium",
      lenses: ["demand", "capacity"],
      risks: ["capex slowdown"],
      falsificationConditions: ["orders decline for two quarters"],
      nextChecks: ["check quarterly bookings"],
      asOf: "2026-08-26",
      source: "chatgpt-supabase",
      basedOnAnalysisId: "analysis-1",
    },
    analysisHistory: [
      {
        id: "analysis-1",
        analysisType: "quarterly_review",
        conclusion: "The hypothesis remains open.",
        evidence: "Bookings were resilient.",
        concerns: "Power availability is a constraint.",
        body: "Review notes",
        source: "chatgpt-supabase",
        sourceUrl: "https://example.com/analysis",
        asOf: "2026-08-25",
        confidence: "medium",
        createdAt: "2026-08-25T00:00:00Z",
      },
    ],
    evidence: [
      {
        id: "evidence-1",
        analysisId: "analysis-1",
        thesisId: "thesis-1",
        evidenceType: "source",
        claimKind: "supporting",
        stance: "supports",
        claim: "Bookings remained resilient.",
        sourceTitle: "Example filing",
        sourceUrl: "https://example.com/filing",
        sourceType: "filing",
        sourceAsOf: "2026-08-24",
        checkedAt: "2026-08-25",
        confidence: "high",
        verificationStatus: "checked",
      },
    ],
    directLinks: [
      {
        id: "link-1",
        targetType: "stock",
        targetId: "stock-1",
        displayName: "Example stock",
        relationType: "exposure",
        relationNote: "Illustrative direct link",
        url: "https://example.com/stocks/stock-1",
        status: "proposed",
        contributionStage: "enabler",
        sourceTitle: "Internal mapping",
        sourceUrl: "https://example.com/mapping",
        sourceAsOf: "2026-08-20",
        checkedAt: "2026-08-21",
        confidence: "medium",
      },
    ],
    taxonomyMap: {
      nodes: [
        {
          id: "node-1",
          domain: "technology",
          kind: "category",
          slug: "compute",
          displayName: "Compute",
          description: "Compute infrastructure",
          status: "active",
        },
      ],
      edges: [
        {
          id: "edge-1",
          sourceNodeId: "node-1",
          targetNodeId: "node-2",
          relationType: "related_to",
          relationNote: null,
        },
      ],
      themeLinks: [
        {
          id: "theme-link-1",
          nodeId: "node-1",
          relationType: "includes",
          relationNote: null,
        },
      ],
      stockLinks: [
        {
          id: "stock-link-1",
          stockId: "stock-1",
          nodeId: "node-1",
          strategicRole: "enabler",
          controlType: "supply",
          relationNote: null,
          source: "chatgpt-supabase",
          confidence: "medium",
          asOf: "2026-08-20",
          validFrom: "2026-01-01",
          validTo: null,
        },
      ],
    },
    metrics: {
      definitions: [
        {
          id: "metric-1",
          metricKey: "capacity_growth",
          displayName: "Capacity growth",
          scope: "theme",
          appliesToStockId: null,
          unit: "%",
          definition: "Year-on-year capacity growth.",
          versionNumber: 1,
          isActive: true,
        },
      ],
      snapshots: [
        {
          id: "snapshot-1",
          asOf: "2026-08-26",
          periodLabel: "2026 Q2",
          snapshotKind: "quarterly",
          note: null,
        },
      ],
      values: [
        {
          id: "value-1",
          snapshotId: "snapshot-1",
          metricId: "metric-1",
          stockId: "stock-1",
          value: 0,
          evidenceId: "evidence-1",
          calculationNote: "Zero is a reported value, not missing.",
        },
      ],
    },
    openActions: [
      {
        id: "action-1",
        actionType: "check",
        title: "Check next bookings release",
        detail: "Compare bookings with the thesis threshold.",
        triggerCondition: "Next quarterly filing",
        dueDate: "2026-11-01",
        status: "open",
        basedOnAnalysisId: "analysis-1",
        basedOnThesisId: "thesis-1",
        createdAt: "2026-08-26T00:00:00Z",
        updatedAt: "2026-08-26T00:00:00Z",
      },
    ],
  };
}

describe("Theme Viewer data loader", () => {
  beforeEach(() => {
    vi.stubEnv(API_BASE_ENV, "");
    vi.stubEnv(API_TOKEN_ENV, "");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("正常な一覧をcamelCase read modelへ変換し、tokenを結果へ含めない", async () => {
    setApiConfig();
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      jsonResponse({
        schemaVersion: "theme-viewer.v1",
        source: "stock-notes",
        asOf: "2026-08-27",
        themes: [
          {
            id: "theme-1",
            slug: "ai-infrastructure",
            displayName: "AI infrastructure",
            status: "draft",
            summary: "Summary",
            source: "chatgpt-supabase",
            asOf: "2026-08-26",
            confidence: "medium",
            updatedAt: "2026-08-27",
            analysisCount: 0,
            openActionCount: 2,
          },
        ],
      }),
    );

    const result = await loadThemeList();

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.themes[0]).toMatchObject({
        id: "theme-1",
        displayName: "AI infrastructure",
        analysisCount: 0,
        openActionCount: 2,
      });
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "https://stock-notes.example.test/api/viewer/themes",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(JSON.stringify(result)).not.toContain(API_TOKEN);
  });

  it("正常な詳細で各セクション、provenance、0のmetric値を保持する", async () => {
    setApiConfig();
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(fullDetailResponse()));

    const result = await loadThemeDetail("theme-1");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.theme.provenance).toEqual({
      source: "chatgpt-supabase",
      asOf: "2026-08-26",
      confidence: "medium",
    });
    expect(result.data.currentThesis?.status).toBe("draft");
    expect(result.data.analysisHistory[0]).toMatchObject({ asOf: "2026-08-25", confidence: "medium" });
    expect(result.data.directLinks[0]?.url).toBe("https://example.com/stocks/stock-1");
    expect(result.data.taxonomyMap.stockLinks[0]?.stockId).toBe("stock-1");
    expect(result.data.metrics.values[0]?.value).toBe(0);
    expect(result.data.openActions[0]?.title).toBe("Check next bookings release");
    expect(result.data.availability.metrics).toEqual({ state: "present", count: 3 });
  });

  it.each([
    ["base URLがない", undefined, API_TOKEN],
    ["tokenがない", API_BASE, undefined],
    ["base URLのschemeが不正", "ftp://stock-notes.example.test", API_TOKEN],
  ])("%sとき、not_configuredを返してfetchしない", async (_label, baseUrl, token) => {
    if (baseUrl) process.env[API_BASE_ENV] = baseUrl;
    if (token) process.env[API_TOKEN_ENV] = token;
    const fetchMock = vi.mocked(globalThis.fetch);

    const result = await loadThemeList();

    expect(result).toMatchObject({ status: "not_configured", httpStatus: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401をunauthorizedとして返し、tokenや上流エラー本文を露出しない", async () => {
    setApiConfig();
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ secret: API_TOKEN }, 401));

    const result = await loadThemeList();

    expect(result).toMatchObject({ status: "unauthorized", httpStatus: 401 });
    expect(JSON.stringify(result)).not.toContain(API_TOKEN);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it.each([500, 503])("HTTP %sをupstream_errorとして空状態と区別する", async (status) => {
    setApiConfig();
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ themes: [] }, status));

    const result = await loadThemeList();

    expect(result).toMatchObject({ status: "upstream_error", httpStatus: status });
  });

  it("一覧の空配列をemptyとして返す", async () => {
    setApiConfig();
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ schemaVersion: "theme-viewer.v1", source: "stock-notes", themes: [] }),
    );

    const result = await loadThemeList();

    expect(result).toMatchObject({ status: "empty", data: { themes: [] } });
  });

  it("詳細404をnot_foundとして返す", async () => {
    setApiConfig();
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse({ message: "not found" }, 404));

    const result = await loadThemeDetail("theme/日本語");

    expect(result).toMatchObject({ status: "not_found", httpStatus: 404 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://stock-notes.example.test/api/viewer/themes/theme%2F%E6%97%A5%E6%9C%AC%E8%AA%9E",
      expect.any(Object),
    );
  });

  it("詳細のtheme=nullをemptyとして返す", async () => {
    setApiConfig();
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ schemaVersion: "theme-viewer.v1", theme: null }),
    );

    const result = await loadThemeDetail("theme-1");

    expect(result).toEqual({ status: "empty" });
  });

  it("接続失敗をupstream_errorとして返す", async () => {
    setApiConfig();
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("network failure"));

    const result = await loadThemeList();

    expect(result).toMatchObject({ status: "upstream_error", httpStatus: null });
    expect(JSON.stringify(result)).not.toContain("network failure");
  });

  it("詳細の明示的nullと未提供セクションをそれぞれempty/missingで表す", async () => {
    setApiConfig();
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({
        schemaVersion: "theme-viewer.v1",
        theme: {
          id: "theme-1",
          slug: "minimal",
          displayName: "Minimal theme",
          status: "active",
        },
        currentThesis: null,
      }),
    );

    const result = await loadThemeDetail("theme-1");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.availability).toMatchObject({
      overview: { state: "missing", count: 0 },
      thesis: { state: "empty", count: 0 },
      analysisHistory: { state: "missing", count: 0 },
      evidence: { state: "missing", count: 0 },
      directLinks: { state: "missing", count: 0 },
      taxonomyMap: { state: "missing", count: 0 },
      metrics: { state: "missing", count: 0 },
      openActions: { state: "missing", count: 0 },
    });
  });

  it("レスポンスの必須項目欠損や未知の契約versionをinvalid_responseとする", async () => {
    setApiConfig();
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ schemaVersion: "theme-viewer.v1", themes: [{ id: "missing-fields" }] }))
      .mockResolvedValueOnce(
        jsonResponse({ schemaVersion: "theme-viewer.v2", themes: [] }),
      );

    await expect(loadThemeList()).resolves.toMatchObject({ status: "invalid_response" });
    await expect(loadThemeList()).resolves.toMatchObject({ status: "invalid_response" });
  });

  it("既存snake_caseの移行レスポンスもcamelCase read modelへ正規化する", () => {
    const data = parseThemeDetailResponse({
      schema_version: "theme-viewer.v1",
      source_system: "stock-notes",
      generated_at: "2026-08-27",
      theme: {
        id: "theme-1",
        slug: "snake-case",
        display_name: "Snake case",
        status: "active",
        theme_definition: "Definition",
      },
      active_thesis: {
        id: "thesis-1",
        version_number: 1,
        status: "draft",
        structural_hypothesis: "Hypothesis",
        falsification_conditions: [],
        next_checks: [],
      },
      analysis_history: [],
      direct_links: [],
      open_actions: [],
    });

    expect(data.theme.displayName).toBe("Snake case");
    expect(data.theme.definition).toBe("Definition");
    expect(data.currentThesis?.structuralHypothesis).toBe("Hypothesis");
    expect(data.availability.analysisHistory).toEqual({ state: "empty", count: 0 });
  });
});
