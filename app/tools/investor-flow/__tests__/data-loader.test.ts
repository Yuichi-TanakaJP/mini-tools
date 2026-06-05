import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  loadInvestorFlowAnalysisLatest,
  loadInvestorFlowAnalysisManifest,
  loadInvestorFlowAnalysisWeek,
  loadInvestorFlowLatest,
  loadInvestorFlowManifest,
  loadInvestorFlowPageData,
  loadInvestorFlowWeek,
} from "../data-loader";
import type {
  InvestorFlowAnalysisManifest,
  InvestorFlowAnalysisPayload,
  InvestorFlowManifest,
  InvestorFlowPayload,
} from "../types";

const MANIFEST: InvestorFlowManifest = {
  data_source: "JPX",
  latest: {
    start_date: "2026-05-18",
    end_date: "2026-05-22",
    path: "investor_flow_2026-05-18_to_2026-05-22.json",
  },
  weeks: [
    {
      start_date: "2026-05-18",
      end_date: "2026-05-22",
      path: "investor_flow_2026-05-18_to_2026-05-22.json",
    },
    {
      start_date: "2026-05-11",
      end_date: "2026-05-15",
      path: "investor_flow_2026-05-11_to_2026-05-15.json",
    },
  ],
  generated_at_jst: "2026-05-28T16:00:00+09:00",
};

const PAYLOAD: InvestorFlowPayload = {
  data_source: "JPX",
  source_url: "https://www.jpx.co.jp/example.xls",
  source_file: "stock_val_1_260522.xls",
  week_label_raw: "2026年5月第3週（5/18 - 5/22）",
  start_date: "2026-05-18",
  end_date: "2026-05-22",
  market_scope: "二市場",
  unit: "thousand_yen",
  generated_at_jst: "2026-05-28T16:00:00+09:00",
  records: [],
};

const ANALYSIS_MANIFEST: InvestorFlowAnalysisManifest = {
  data_source: "JPX",
  schema_version: "investor-flow-analysis-v1",
  latest: {
    start_date: "2026-05-18",
    end_date: "2026-05-22",
    path: "investor_flow_analysis_2026-05-18_to_2026-05-22.json",
  },
  weeks: [
    {
      start_date: "2026-05-18",
      end_date: "2026-05-22",
      path: "investor_flow_analysis_2026-05-18_to_2026-05-22.json",
    },
    {
      start_date: "2026-05-11",
      end_date: "2026-05-15",
      path: "investor_flow_analysis_2026-05-11_to_2026-05-15.json",
    },
  ],
  generated_at_jst: "2026-05-31T12:00:00+09:00",
};

const ANALYSIS: InvestorFlowAnalysisPayload = {
  schema_version: "investor-flow-analysis-v1",
  data_source: "JPX",
  analysis_scope: "weekly_investor_flow",
  start_date: "2026-05-18",
  end_date: "2026-05-22",
  previous_start_date: "2026-05-11",
  previous_end_date: "2026-05-15",
  generated_at_jst: "2026-05-31T12:00:00+09:00",
  source_snapshot_path: "investor_flow_2026-05-18_to_2026-05-22.json",
  lookback_weeks: 13,
  summary: {
    largest_net_buy: { category: "海外投資家", diff_yen: 450_000_000_000 },
    largest_net_sell: { category: "自己計", diff_yen: -290_000_000_000 },
  },
  buy_composition: [],
  sell_composition: [],
  net_ranking: [],
  reversals: [],
  streaks: [],
  major_flows: [],
};

function makeFetchOk(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

function makeFetch404(): Response {
  return { ok: false, status: 404 } as unknown as Response;
}

describe("investor-flow data-loader", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.NODE_ENV = "test";
    delete process.env.MARKET_INFO_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("API 未設定のとき null を返す", async () => {
    await expect(loadInvestorFlowManifest()).resolves.toBeNull();
    await expect(loadInvestorFlowAnalysisManifest()).resolves.toBeNull();
    await expect(loadInvestorFlowLatest()).resolves.toBeNull();
    await expect(loadInvestorFlowAnalysisLatest()).resolves.toBeNull();
    await expect(loadInvestorFlowWeek("2026-05-18", "2026-05-22")).resolves.toBeNull();
    await expect(loadInvestorFlowAnalysisWeek("2026-05-18", "2026-05-22")).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("manifest / latest / week / analysis を API から取得する", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com/";
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeFetchOk(MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(ANALYSIS_MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(PAYLOAD))
      .mockResolvedValueOnce(makeFetchOk(ANALYSIS))
      .mockResolvedValueOnce(makeFetchOk(PAYLOAD));
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchOk(ANALYSIS));

    await expect(loadInvestorFlowManifest()).resolves.toEqual(MANIFEST);
    await expect(loadInvestorFlowAnalysisManifest()).resolves.toEqual(ANALYSIS_MANIFEST);
    await expect(loadInvestorFlowLatest()).resolves.toEqual(PAYLOAD);
    await expect(loadInvestorFlowAnalysisLatest()).resolves.toEqual(ANALYSIS);
    await expect(loadInvestorFlowWeek("2026-05-11", "2026-05-15")).resolves.toEqual(PAYLOAD);
    await expect(loadInvestorFlowAnalysisWeek("2026-05-11", "2026-05-15")).resolves.toEqual(ANALYSIS);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/investor-flow/manifest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/investor-flow/analysis/manifest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/investor-flow/latest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/investor-flow/analysis/latest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "https://api.example.com/investor-flow/weeks/2026-05-11/2026-05-15",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      "https://api.example.com/investor-flow/analysis/weeks/2026-05-11/2026-05-15",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("page data は latest 週なら latest endpoint を使う", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeFetchOk(MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(ANALYSIS_MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(PAYLOAD))
      .mockResolvedValueOnce(makeFetchOk(ANALYSIS));

    const result = await loadInvestorFlowPageData();

    expect(result.payload).toEqual(PAYLOAD);
    expect(result.analysis).toEqual(ANALYSIS);
    expect(result.selectedWeek?.start_date).toBe("2026-05-18");
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/investor-flow/latest",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/investor-flow/analysis/latest",
      expect.any(Object),
    );
  });

  it("raw manifest が古い場合は analysis manifest の最新週を選ぶ", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    const freshAnalysisManifest: InvestorFlowAnalysisManifest = {
      ...ANALYSIS_MANIFEST,
      latest: {
        start_date: "2026-05-25",
        end_date: "2026-05-29",
        path: "investor_flow_analysis_2026-05-25_to_2026-05-29.json",
      },
      weeks: [
        {
          start_date: "2026-05-25",
          end_date: "2026-05-29",
          path: "investor_flow_analysis_2026-05-25_to_2026-05-29.json",
        },
        ...ANALYSIS_MANIFEST.weeks,
      ],
    };
    const freshPayload = { ...PAYLOAD, start_date: "2026-05-25", end_date: "2026-05-29" };
    const freshAnalysis = { ...ANALYSIS, start_date: "2026-05-25", end_date: "2026-05-29" };
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeFetchOk(MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(freshAnalysisManifest))
      .mockResolvedValueOnce(makeFetchOk(freshPayload))
      .mockResolvedValueOnce(makeFetchOk(freshAnalysis));

    const result = await loadInvestorFlowPageData();

    expect(result.selectedWeek?.start_date).toBe("2026-05-25");
    expect(result.manifest?.latest.start_date).toBe("2026-05-25");
    expect(result.manifest?.weeks.map((week) => week.start_date)).toEqual([
      "2026-05-25",
      "2026-05-18",
      "2026-05-11",
    ]);
    expect(result.payload?.start_date).toBe("2026-05-25");
    expect(result.analysis?.start_date).toBe("2026-05-25");
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/investor-flow/weeks/2026-05-25/2026-05-29",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/investor-flow/analysis/latest",
      expect.any(Object),
    );
  });

  it("raw manifest が失敗した場合は analysis manifest だけで接続済みにしない", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeFetch404())
      .mockResolvedValueOnce(makeFetchOk(ANALYSIS_MANIFEST));

    const result = await loadInvestorFlowPageData();

    expect(result.manifest).toBeNull();
    expect(result.selectedWeek).toBeNull();
    expect(result.payload).toBeNull();
    expect(result.analysis).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("page data は過去週なら weeks endpoint を使う", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeFetchOk(MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(ANALYSIS_MANIFEST))
      .mockResolvedValueOnce(makeFetchOk({ ...PAYLOAD, start_date: "2026-05-11", end_date: "2026-05-15" }))
      .mockResolvedValueOnce(makeFetchOk({ ...ANALYSIS, start_date: "2026-05-11", end_date: "2026-05-15" }));

    const result = await loadInvestorFlowPageData("2026-05-11", "2026-05-15");

    expect(result.payload?.start_date).toBe("2026-05-11");
    expect(result.analysis?.start_date).toBe("2026-05-11");
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/investor-flow/weeks/2026-05-11/2026-05-15",
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/investor-flow/analysis/weeks/2026-05-11/2026-05-15",
      expect.any(Object),
    );
  });

  it("API 失敗時は null / loadFailed を返す", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeFetchOk(MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(ANALYSIS_MANIFEST))
      .mockResolvedValueOnce(makeFetch404());
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchOk(ANALYSIS));

    const result = await loadInvestorFlowPageData("2026-05-11", "2026-05-15");

    expect(result.payload).toBeNull();
    expect(result.loadFailed).toBe(true);
  });

  it("analysis 失敗時も raw payload があればページデータは表示可能にする", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeFetchOk(MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(ANALYSIS_MANIFEST))
      .mockResolvedValueOnce(makeFetchOk(PAYLOAD))
      .mockResolvedValueOnce(makeFetch404());

    const result = await loadInvestorFlowPageData();

    expect(result.payload).toEqual(PAYLOAD);
    expect(result.analysis).toBeNull();
    expect(result.loadFailed).toBe(false);
    expect(result.analysisLoadFailed).toBe(true);
  });

  it("analysis が raw と別週なら採用しない", async () => {
    process.env.MARKET_INFO_API_BASE_URL = "https://api.example.com";
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeFetchOk(MANIFEST))
      .mockResolvedValueOnce(
        makeFetchOk({
          ...ANALYSIS_MANIFEST,
          latest: {
            start_date: "2026-05-11",
            end_date: "2026-05-15",
            path: "investor_flow_analysis_2026-05-11_to_2026-05-15.json",
          },
          weeks: [
            {
              start_date: "2026-05-11",
              end_date: "2026-05-15",
              path: "investor_flow_analysis_2026-05-11_to_2026-05-15.json",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(makeFetchOk(PAYLOAD));

    const result = await loadInvestorFlowPageData();

    expect(result.payload).toEqual(PAYLOAD);
    expect(result.analysis).toBeNull();
    expect(result.analysisLoadFailed).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
