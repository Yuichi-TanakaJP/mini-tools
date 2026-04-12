import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type { UsRankingDayData, UsRankingManifest } from "./types";

export async function loadUsRankingManifest(): Promise<UsRankingManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<UsRankingManifest>(`${apiBase}/us-ranking/manifest`);
  } catch {
    return null;
  }
}

export async function loadUsRankingDayData(
  dateStr: string,
): Promise<UsRankingDayData | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<UsRankingDayData>(`${apiBase}/us-ranking/${dateStr}`);
  } catch {
    return null;
  }
}
