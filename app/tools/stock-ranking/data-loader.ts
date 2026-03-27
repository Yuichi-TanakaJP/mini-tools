import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RankingDayData, RankingManifest } from "./types";

function getDataDir() {
  return path.join(process.cwd(), "app/tools/stock-ranking/data");
}

function getExternalBaseUrl() {
  const baseUrl = process.env.STOCK_RANKING_DATA_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!baseUrl) {
    return [];
  }

  return baseUrl.endsWith("/stock-ranking") ? [baseUrl] : [baseUrl, `${baseUrl}/stock-ranking`];
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
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
  const baseUrls = getExternalBaseUrl();

  if (baseUrls.length === 0) {
    return loadLocalRankingManifest();
  }

  for (const baseUrl of baseUrls) {
    try {
      return await fetchJson<RankingManifest>(`${baseUrl}/manifest.json`);
    } catch {
      continue;
    }
  }

  return loadLocalRankingManifest();
}

export async function loadRankingDayData(dateStr: string): Promise<RankingDayData | null> {
  const fileKey = dateStr.replace(/-/g, "");
  const baseUrls = getExternalBaseUrl();

  if (baseUrls.length === 0) {
    return loadLocalRankingDayData(dateStr);
  }

  for (const baseUrl of baseUrls) {
    try {
      return await fetchJson<RankingDayData>(`${baseUrl}/${fileKey}.json`);
    } catch {
      continue;
    }
  }

  return loadLocalRankingDayData(dateStr);
}
