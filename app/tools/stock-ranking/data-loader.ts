import { readFile } from "node:fs/promises";
import path from "node:path";
import { canUseLocalMarketDataFallback, getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { RankingDayData, RankingManifest } from "./types";

type NodeErrorLike = Error & { code?: string };

function getDataDir() {
  return path.join(process.cwd(), "app/tools/stock-ranking/data");
}

async function loadLocalRankingManifest(): Promise<RankingManifest | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), "manifest.json"), "utf-8");
    return JSON.parse(raw) as RankingManifest;
  } catch (error) {
    if ((error as NodeErrorLike).code !== "ENOENT") {
      throw error;
    }
    return null;
  }
}

async function loadLocalRankingDayData(dateStr: string): Promise<RankingDayData | null> {
  const fileKey = dateStr.replace(/-/g, "");

  try {
    const raw = await readFile(path.join(getDataDir(), `${fileKey}.json`), "utf-8");
    return JSON.parse(raw) as RankingDayData;
  } catch {
    return null;
  }
}

export async function loadRankingManifest(): Promise<RankingManifest | null> {
  const apiBase = getApiBaseUrl();
  const canUseLocalFallback = canUseLocalMarketDataFallback();

  if (!apiBase) {
    return canUseLocalFallback ? loadLocalRankingManifest() : null;
  }

  try {
    return await fetchJson<RankingManifest>(`${apiBase}/ranking/manifest`);
  } catch {
    return canUseLocalFallback ? loadLocalRankingManifest() : null;
  }
}

export async function loadRankingDayData(dateStr: string): Promise<RankingDayData | null> {
  const apiBase = getApiBaseUrl();
  const canUseLocalFallback = canUseLocalMarketDataFallback();

  if (!apiBase) {
    return canUseLocalFallback ? loadLocalRankingDayData(dateStr) : null;
  }

  try {
    return await fetchJson<RankingDayData>(`${apiBase}/ranking/${dateStr}`);
  } catch {
    return canUseLocalFallback ? loadLocalRankingDayData(dateStr) : null;
  }
}
