import { readFile } from "node:fs/promises";
import path from "node:path";
import { canUseLocalMarketDataFallback, getApiBaseUrl, fetchJson } from "@/lib/market-api";
import type { Topix33DayData, Topix33Manifest } from "./types";

const EMPTY_MANIFEST: Topix33Manifest = {
  dates: [],
  latest_date: null,
};

function getDataDir() {
  return path.join(process.cwd(), "app/tools/topix33/data");
}

async function loadLocalManifest(): Promise<Topix33Manifest> {
  try {
    const raw = await readFile(path.join(getDataDir(), "topix33_manifest.json"), "utf-8");
    return JSON.parse(raw) as Topix33Manifest;
  } catch {
    return EMPTY_MANIFEST;
  }
}

async function loadLocalDayData(dateStr: string): Promise<Topix33DayData | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), `topix33_${dateStr}.json`), "utf-8");
    return JSON.parse(raw) as Topix33DayData;
  } catch {
    return null;
  }
}

export async function loadTopix33Manifest(): Promise<Topix33Manifest> {
  const apiBase = getApiBaseUrl();
  const canUseLocalFallback = canUseLocalMarketDataFallback();

  if (!apiBase) {
    return canUseLocalFallback ? loadLocalManifest() : EMPTY_MANIFEST;
  }

  try {
    return await fetchJson<Topix33Manifest>(`${apiBase}/topix33/manifest`);
  } catch {
    return canUseLocalFallback ? loadLocalManifest() : EMPTY_MANIFEST;
  }
}

export async function loadTopix33DayData(dateStr: string): Promise<Topix33DayData | null> {
  if (!dateStr) {
    return null;
  }

  const apiBase = getApiBaseUrl();
  const canUseLocalFallback = canUseLocalMarketDataFallback();

  if (!apiBase) {
    return canUseLocalFallback ? loadLocalDayData(dateStr) : null;
  }

  try {
    return await fetchJson<Topix33DayData>(`${apiBase}/topix33/${dateStr}`);
  } catch {
    return canUseLocalFallback ? loadLocalDayData(dateStr) : null;
  }
}
