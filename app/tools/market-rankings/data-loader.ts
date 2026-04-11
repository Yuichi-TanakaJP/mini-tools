import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type {
  MarketRankingManifest,
  MarketRankingMonthData,
  MarketRankingType,
} from "./types";

const ENDPOINTS: Record<MarketRankingType, string> = {
  "market-cap": "market-cap",
  "dividend-yield": "dividend-yield",
};

function buildBasePath(rankingType: MarketRankingType) {
  return `/market-rankings/${ENDPOINTS[rankingType]}`;
}

export async function loadMarketRankingManifest(
  rankingType: MarketRankingType,
): Promise<MarketRankingManifest | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    return await fetchJson<MarketRankingManifest>(
      `${apiBase}${buildBasePath(rankingType)}/manifest`,
    );
  } catch {
    return null;
  }
}

export async function loadMarketRankingMonthData(
  rankingType: MarketRankingType,
  yearMonth: string,
): Promise<MarketRankingMonthData | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase || !yearMonth) return null;

  try {
    return await fetchJson<MarketRankingMonthData>(
      `${apiBase}${buildBasePath(rankingType)}/monthly/${yearMonth}`,
    );
  } catch {
    return null;
  }
}
