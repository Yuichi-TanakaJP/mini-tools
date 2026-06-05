import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type {
  InvestorFlowAnalysisManifest,
  InvestorFlowAnalysisPayload,
  InvestorFlowManifest,
  InvestorFlowPageData,
  InvestorFlowPayload,
  InvestorFlowWeekRef,
} from "./types";

const INVESTOR_FLOW_REVALIDATE_SECONDS = 0;

function isAfterWeek(left: InvestorFlowWeekRef | null | undefined, right: InvestorFlowWeekRef | null | undefined) {
  if (!left) return false;
  if (!right) return true;
  if (left.start_date !== right.start_date) return left.start_date > right.start_date;
  return left.end_date > right.end_date;
}

function findWeek(
  manifest: InvestorFlowManifest | null,
  analysisManifest: InvestorFlowAnalysisManifest | null,
  startDate?: string,
  endDate?: string,
): InvestorFlowWeekRef | null {
  if (!manifest) return null;
  if (startDate && endDate) {
    return (
      manifest?.weeks.find(
        (week) => week.start_date === startDate && week.end_date === endDate,
      ) ??
      analysisManifest?.weeks.find(
        (week) => week.start_date === startDate && week.end_date === endDate,
      ) ??
      manifest?.latest ??
      analysisManifest?.latest ??
      null
    );
  }
  return isAfterWeek(analysisManifest?.latest, manifest?.latest)
    ? (analysisManifest?.latest ?? null)
    : (manifest?.latest ?? analysisManifest?.latest ?? null);
}

function mergeDisplayManifest(
  manifest: InvestorFlowManifest | null,
  analysisManifest: InvestorFlowAnalysisManifest | null,
): InvestorFlowManifest | null {
  if (!manifest) return null;
  const latest = isAfterWeek(analysisManifest?.latest, manifest?.latest)
    ? analysisManifest?.latest
    : manifest?.latest;
  if (!latest) return manifest;
  const weekMap = new Map<string, InvestorFlowWeekRef>();
  for (const week of [...(analysisManifest?.weeks ?? []), ...(manifest?.weeks ?? [])]) {
    weekMap.set(`${week.start_date}:${week.end_date}`, week);
  }
  const weeks = [...weekMap.values()].sort((left, right) => {
    if (left.start_date !== right.start_date) return right.start_date.localeCompare(left.start_date);
    return right.end_date.localeCompare(left.end_date);
  });
  return {
    data_source: manifest?.data_source ?? analysisManifest?.data_source ?? "JPX",
    latest,
    weeks,
    generated_at_jst: manifest?.generated_at_jst ?? analysisManifest?.generated_at_jst ?? "",
  };
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
    return await fetchJson<InvestorFlowManifest>(
      `${apiBase}/investor-flow/manifest`,
      INVESTOR_FLOW_REVALIDATE_SECONDS,
    );
  } catch {
    return null;
  }
}

export async function loadInvestorFlowAnalysisManifest(): Promise<InvestorFlowAnalysisManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<InvestorFlowAnalysisManifest>(
      `${apiBase}/investor-flow/analysis/manifest`,
      INVESTOR_FLOW_REVALIDATE_SECONDS,
    );
  } catch {
    return null;
  }
}

export async function loadInvestorFlowLatest(): Promise<InvestorFlowPayload | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<InvestorFlowPayload>(
      `${apiBase}/investor-flow/latest`,
      INVESTOR_FLOW_REVALIDATE_SECONDS,
    );
  } catch {
    return null;
  }
}

export async function loadInvestorFlowAnalysisLatest(): Promise<InvestorFlowAnalysisPayload | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<InvestorFlowAnalysisPayload>(
      `${apiBase}/investor-flow/analysis/latest`,
      INVESTOR_FLOW_REVALIDATE_SECONDS,
    );
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
      INVESTOR_FLOW_REVALIDATE_SECONDS,
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
      INVESTOR_FLOW_REVALIDATE_SECONDS,
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
  const selectedWeek = findWeek(manifest, analysisManifest, startDate, endDate);
  const displayManifest = mergeDisplayManifest(manifest, analysisManifest);
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
    manifest: displayManifest,
    payload,
    analysisManifest,
    analysis: matchedAnalysis,
    selectedWeek,
    loadFailed: Boolean(selectedWeek) && payload === null,
    analysisLoadFailed: analysisWeekAvailable && matchedAnalysis === null,
  };
}
