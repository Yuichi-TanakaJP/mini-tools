import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type {
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

export async function loadInvestorFlowManifest(): Promise<InvestorFlowManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<InvestorFlowManifest>(`${apiBase}/investor-flow/manifest`);
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

export async function loadInvestorFlowPageData(
  startDate?: string,
  endDate?: string,
): Promise<InvestorFlowPageData> {
  const manifest = await loadInvestorFlowManifest();
  const selectedWeek = findWeek(manifest, startDate, endDate);
  const isLatest =
    selectedWeek &&
    manifest?.latest.start_date === selectedWeek.start_date &&
    manifest.latest.end_date === selectedWeek.end_date;
  const payload = selectedWeek
    ? isLatest
      ? await loadInvestorFlowLatest()
      : await loadInvestorFlowWeek(selectedWeek.start_date, selectedWeek.end_date)
    : null;

  return {
    manifest,
    payload,
    selectedWeek,
    loadFailed: Boolean(selectedWeek) && payload === null,
  };
}
