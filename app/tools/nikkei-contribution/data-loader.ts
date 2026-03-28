import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NikkeiContributionDayData, NikkeiContributionManifest } from "./types";

const EMPTY_MANIFEST: NikkeiContributionManifest = {
  dates: [],
  latest_date: null,
};

function getDataDir() {
  return path.join(process.cwd(), "app/tools/nikkei-contribution/data");
}

function getExternalBaseUrl() {
  const baseUrl = process.env.NIKKEI_CONTRIBUTION_DATA_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!baseUrl) {
    return [];
  }

  return baseUrl.endsWith("/nikkei-contribution") ? [baseUrl] : [baseUrl, `${baseUrl}/nikkei-contribution`];
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

async function loadLocalManifest(): Promise<NikkeiContributionManifest> {
  try {
    const raw = await readFile(path.join(getDataDir(), "nikkei_contribution_manifest.json"), "utf-8");
    return JSON.parse(raw) as NikkeiContributionManifest;
  } catch {
    return EMPTY_MANIFEST;
  }
}

async function loadLocalDayData(dateStr: string): Promise<NikkeiContributionDayData | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), `nikkei_contribution_${dateStr}.json`), "utf-8");
    return JSON.parse(raw) as NikkeiContributionDayData;
  } catch {
    return null;
  }
}

export async function loadContributionManifest(): Promise<NikkeiContributionManifest> {
  const baseUrls = getExternalBaseUrl();

  if (baseUrls.length === 0) {
    return loadLocalManifest();
  }

  for (const baseUrl of baseUrls) {
    try {
      return await fetchJson<NikkeiContributionManifest>(`${baseUrl}/nikkei_contribution_manifest.json`);
    } catch {
      continue;
    }
  }

  return loadLocalManifest();
}

export async function loadContributionDayData(dateStr: string): Promise<NikkeiContributionDayData | null> {
  if (!dateStr) {
    return null;
  }

  const baseUrls = getExternalBaseUrl();

  if (baseUrls.length === 0) {
    return loadLocalDayData(dateStr);
  }

  for (const baseUrl of baseUrls) {
    try {
      return await fetchJson<NikkeiContributionDayData>(`${baseUrl}/nikkei_contribution_${dateStr}.json`);
    } catch {
      continue;
    }
  }

  return loadLocalDayData(dateStr);
}
