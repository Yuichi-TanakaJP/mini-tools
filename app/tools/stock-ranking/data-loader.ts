import { readFile } from "node:fs/promises";
import path from "node:path";
import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { RankingDayData, RankingManifest } from "./types";

function getDataDir() {
  return path.join(process.cwd(), "app/tools/stock-ranking/data");
}

async function loadLocalRankingManifest(): Promise<RankingManifest> {
  const raw = await readFile(path.join(getDataDir(), "manifest.json"), "utf-8");
  return JSON.parse(raw) as RankingManifest;
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

export async function loadRankingManifest(): Promise<RankingManifest> {
  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return loadLocalRankingManifest();
  }

  try {
    return await fetchJson<RankingManifest>(`${apiBase}/ranking/manifest`);
  } catch {
    return loadLocalRankingManifest();
  }
}

export async function loadRankingDayData(dateStr: string): Promise<RankingDayData | null> {
  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return loadLocalRankingDayData(dateStr);
  }

  try {
    return await fetchJson<RankingDayData>(`${apiBase}/ranking/${dateStr}`);
  } catch {
    return loadLocalRankingDayData(dateStr);
  }
}
