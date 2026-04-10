import { readFile } from "node:fs/promises";
import path from "node:path";
import { getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { NikkeiContributionDayData, NikkeiContributionManifest } from "./types";

const EMPTY_MANIFEST: NikkeiContributionManifest = {
  dates: [],
  latest_date: null,
};

function getDataDir() {
  return path.join(process.cwd(), "app/tools/nikkei-contribution/data");
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
  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return loadLocalManifest();
  }

  try {
    return await fetchJson<NikkeiContributionManifest>(`${apiBase}/nikkei/manifest`);
  } catch {
    return loadLocalManifest();
  }
}

export async function loadContributionDayData(dateStr: string): Promise<NikkeiContributionDayData | null> {
  if (!dateStr) {
    return null;
  }

  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return loadLocalDayData(dateStr);
  }

  try {
    return await fetchJson<NikkeiContributionDayData>(`${apiBase}/nikkei/${dateStr}`);
  } catch {
    return loadLocalDayData(dateStr);
  }
}
