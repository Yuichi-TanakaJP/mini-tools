import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  MonthlyYutaiManifest,
  MonthlyYutaiMonthData,
  MonthlyYutaiPageData,
} from "./types";

const DEFAULT_MONTH_ID = "2026-04";

function getDataDir() {
  return path.join(process.cwd(), "app/tools/yutai-candidates/data");
}

function getApiBaseUrl() {
  return process.env.MARKET_INFO_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
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

async function loadLocalManifest(): Promise<MonthlyYutaiManifest | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), "manifest.json"), "utf-8");
    return JSON.parse(raw) as MonthlyYutaiManifest;
  } catch {
    return null;
  }
}

async function loadLocalMonthData(yearMonth: string): Promise<MonthlyYutaiMonthData | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), `${yearMonth}.json`), "utf-8");
    return JSON.parse(raw) as MonthlyYutaiMonthData;
  } catch {
    return null;
  }
}

export async function loadMonthlyYutaiManifest(): Promise<MonthlyYutaiManifest | null> {
  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return loadLocalManifest();
  }

  try {
    return await fetchJson<MonthlyYutaiManifest>(`${apiBase}/yutai/manifest`);
  } catch {
    return loadLocalManifest();
  }
}

export async function loadMonthlyYutaiMonthData(yearMonth: string): Promise<MonthlyYutaiMonthData | null> {
  const apiBase = getApiBaseUrl();

  if (!apiBase) {
    return loadLocalMonthData(yearMonth);
  }

  try {
    return await fetchJson<MonthlyYutaiMonthData>(`${apiBase}/yutai/monthly/${yearMonth}`);
  } catch {
    return loadLocalMonthData(yearMonth);
  }
}

export async function loadMonthlyYutaiPageData(requestedMonthId?: string): Promise<MonthlyYutaiPageData> {
  const manifest = await loadMonthlyYutaiManifest();

  const availableMonths =
    manifest?.months?.map((m) => `${m.year}-${String(m.month).padStart(2, "0")}`) ?? [];

  const selectedMonthId =
    requestedMonthId && availableMonths.includes(requestedMonthId)
      ? requestedMonthId
      : manifest?.latest_month ?? DEFAULT_MONTH_ID;

  const monthData = await loadMonthlyYutaiMonthData(selectedMonthId);

  return {
    manifest,
    selectedMonthId,
    generatedAt: monthData?.generated_at ?? manifest?.generated_at ?? null,
    source: monthData?.source ?? manifest?.source ?? null,
    items: monthData?.records ?? [],
  };
}
