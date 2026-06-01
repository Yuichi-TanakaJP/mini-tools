import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type {
  InvestorFlowAnalysisManifest,
  InvestorFlowAnalysisPayload,
  InvestorFlowManifest,
  InvestorFlowPageData,
  InvestorFlowPayload,
  InvestorFlowWeekRef,
} from "./types";

function findWeek(
  manifest: InvestorFlowManifest | null,
  startDate?: string,
  endDate?: string,
): InvestorFlowWeekRef | null {
  if (!manifest) return null;
  if (startDate && endDate) {
    return (
      manifest.weeks.find(
        (week) => week.start_date === startDate && week.end_date === endDate,
      ) ?? manifest.latest
    );
  }
  return manifest.latest;
}

function hasAnalysisWeek(
  manifest: InvestorFlowAnalysisManifest | null,
  selectedWeek: InvestorFlowWeekRef | null,
): boolean {
  if (!manifest || !selectedWeek) return false;
  return manifest.weeks.some(
    (week) =>
      week.start_date === selectedWeek.start_date &&
      week.end_date === selectedWeek.end_date,
  );
}

function isSameWeek(
  payload: InvestorFlowAnalysisPayload | null,
  selectedWeek: InvestorFlowWeekRef | null,
): payload is InvestorFlowAnalysisPayload {
  if (!payload || !selectedWeek) return false;
  return payload.start_date === selectedWeek.start_date && payload.end_date === selectedWeek.end_date;
}

export async function loadInvestorFlowManifest(): Promise<InvestorFlowManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<InvestorFlowManifest>(`${apiBase}/investor-flow/manifest`);
  } catch {
    return null;
  }
}

export async function loadInvestorFlowAnalysisManifest(): Promise<InvestorFlowAnalysisManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<InvestorFlowAnalysisManifest>(`${apiBase}/investor-flow/analysis/manifest`);
  } catch {
    return null;
  }
}

export async function loadInvestorFlowLatest(): Promise<InvestorFlowPayload | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<InvestorFlowPayload>(`${apiBase}/investor-flow/latest`);
  } catch {
    return null;
  }
}

export async function loadInvestorFlowAnalysisLatest(): Promise<InvestorFlowAnalysisPayload | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<InvestorFlowAnalysisPayload>(`${apiBase}/investor-flow/analysis/latest`);
  } catch {
    return null;
  }
}

export async function loadInvestorFlowWeek(
  startDate: string,
  endDate: string,
): Promise<InvestorFlowPayload | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase || !startDate || !endDate) return null;

  try {
    return await fetchJson<InvestorFlowPayload>(
      `${apiBase}/investor-flow/weeks/${startDate}/${endDate}`,
    );
  } catch {
    return null;
  }
}

export async function loadInvestorFlowAnalysisWeek(
  startDate: string,
  endDate: string,
): Promise<InvestorFlowAnalysisPayload | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase || !startDate || !endDate) return null;

  try {
    return await fetchJson<InvestorFlowAnalysisPayload>(
      `${apiBase}/investor-flow/analysis/weeks/${startDate}/${endDate}`,
    );
  } catch {
    return null;
  }
}

export async function loadInvestorFlowPageData(
  startDate?: string,
  endDate?: string,
): Promise<InvestorFlowPageData> {
  const [manifest, analysisManifest] = await Promise.all([
    loadInvestorFlowManifest(),
    loadInvestorFlowAnalysisManifest(),
  ]);
  const selectedWeek = findWeek(manifest, startDate, endDate);
  const isLatest =
    selectedWeek &&
    manifest?.latest.start_date === selectedWeek.start_date &&
    manifest.latest.end_date === selectedWeek.end_date;
  const isAnalysisLatest =
    selectedWeek &&
    analysisManifest?.latest.start_date === selectedWeek.start_date &&
    analysisManifest.latest.end_date === selectedWeek.end_date;
  const analysisWeekAvailable = hasAnalysisWeek(analysisManifest, selectedWeek);
  const [payload, analysis] = selectedWeek
    ? await Promise.all([
        isLatest
          ? loadInvestorFlowLatest()
          : loadInvestorFlowWeek(selectedWeek.start_date, selectedWeek.end_date),
        !analysisWeekAvailable
          ? Promise.resolve(null)
          : isAnalysisLatest
            ? loadInvestorFlowAnalysisLatest()
            : loadInvestorFlowAnalysisWeek(selectedWeek.start_date, selectedWeek.end_date),
      ])
    : [null, null];
  const matchedAnalysis = isSameWeek(analysis, selectedWeek) ? analysis : null;

  return {
    manifest,
    payload,
    analysisManifest,
    analysis: matchedAnalysis,
    selectedWeek,
    loadFailed: Boolean(selectedWeek) && payload === null,
    analysisLoadFailed: analysisWeekAvailable && matchedAnalysis === null,
  };
}
