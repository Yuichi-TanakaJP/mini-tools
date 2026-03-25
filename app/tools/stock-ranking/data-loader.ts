import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RankingDayData, RankingManifest } from "./types";

function getDataDir() {
  return path.join(process.cwd(), "app/tools/stock-ranking/data");
}

export async function loadRankingManifest(): Promise<RankingManifest> {
  const raw = await readFile(path.join(getDataDir(), "manifest.json"), "utf-8");
  return JSON.parse(raw) as RankingManifest;
}

export async function loadRankingDayData(dateStr: string): Promise<RankingDayData | null> {
  const fileKey = dateStr.replace(/-/g, "");

  try {
    const raw = await readFile(path.join(getDataDir(), `${fileKey}.json`), "utf-8");
    return JSON.parse(raw) as RankingDayData;
  } catch {
    return null;
  }
}
