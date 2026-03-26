import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RankingDayData, RankingManifest } from "./types";

function getDataDir() {
  return path.join(process.cwd(), "app/tools/stock-ranking/data");
}

function getExternalBaseUrl() {
  return process.env.STOCK_RANKING_DATA_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }

  return (await res.json()) as T;
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
  const baseUrl = getExternalBaseUrl();

  if (!baseUrl) {
    return loadLocalRankingManifest();
  }

  try {
    return await fetchJson<RankingManifest>(`${baseUrl}/manifest.json`);
  } catch {
    return loadLocalRankingManifest();
  }
}

export async function loadRankingDayData(dateStr: string): Promise<RankingDayData | null> {
  const fileKey = dateStr.replace(/-/g, "");
  const baseUrl = getExternalBaseUrl();

  if (!baseUrl) {
    return loadLocalRankingDayData(dateStr);
  }

  try {
    return await fetchJson<RankingDayData>(`${baseUrl}/${fileKey}.json`);
  } catch {
    return loadLocalRankingDayData(dateStr);
  }
}
