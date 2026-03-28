import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MonthlyYutaiCandidate, MonthlyYutaiManifest, MonthlyYutaiPageData } from "./types";

const DEFAULT_MONTH_ID = "2026-04";

function getDataDir() {
  return path.join(process.cwd(), "app/tools/yutai-candidates/data");
}

function getExternalBaseUrl() {
  const baseUrl = process.env.MONTHLY_YUTAI_DATA_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  if (!baseUrl) {
    return [];
  }

  return baseUrl.endsWith("/monthly-yutai") ? [baseUrl] : [baseUrl, `${baseUrl}/monthly-yutai`];
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

async function loadLocalMonthData(monthId: string): Promise<MonthlyYutaiCandidate[]> {
  const fileKey = monthId.replace(/-/g, "");

  try {
    const raw = await readFile(path.join(getDataDir(), `${fileKey}.json`), "utf-8");
    return JSON.parse(raw) as MonthlyYutaiCandidate[];
  } catch {
    return [];
  }
}

export async function loadMonthlyYutaiManifest(): Promise<MonthlyYutaiManifest | null> {
  const baseUrls = getExternalBaseUrl();

  if (baseUrls.length === 0) {
    return loadLocalManifest();
  }

  for (const baseUrl of baseUrls) {
    try {
      return await fetchJson<MonthlyYutaiManifest>(`${baseUrl}/manifest.json`);
    } catch {
      continue;
    }
  }

  return loadLocalManifest();
}

export async function loadMonthlyYutaiMonthData(monthId: string): Promise<MonthlyYutaiCandidate[]> {
  const fileKey = monthId.replace(/-/g, "");
  const baseUrls = getExternalBaseUrl();

  if (baseUrls.length === 0) {
    return loadLocalMonthData(monthId);
  }

  for (const baseUrl of baseUrls) {
    try {
      return await fetchJson<MonthlyYutaiCandidate[]>(`${baseUrl}/${fileKey}.json`);
    } catch {
      continue;
    }
  }

  return loadLocalMonthData(monthId);
}

export async function loadMonthlyYutaiPageData(): Promise<MonthlyYutaiPageData> {
  const manifest = await loadMonthlyYutaiManifest();
  const selectedMonthId = manifest?.months.find((month) => month.month === 4)?.id ?? manifest?.months[0]?.id ?? DEFAULT_MONTH_ID;
  const items = selectedMonthId ? await loadMonthlyYutaiMonthData(selectedMonthId) : [];

  return {
    manifest,
    selectedMonthId,
    items,
  };
}
