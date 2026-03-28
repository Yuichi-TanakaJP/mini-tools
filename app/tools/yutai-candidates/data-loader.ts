import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  MonthlyYutaiManifest,
  MonthlyYutaiMonthData,
  MonthlyYutaiMonthManifest,
  MonthlyYutaiPageData,
} from "./types";

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

async function loadLocalMonthData(relativePath: string): Promise<MonthlyYutaiMonthData | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), relativePath), "utf-8");
    return JSON.parse(raw) as MonthlyYutaiMonthData;
  } catch {
    return null;
  }
}

function resolveSelectedMonthEntry(
  manifest: MonthlyYutaiManifest | null,
): MonthlyYutaiMonthManifest | null {
  if (!manifest?.months?.length) return null;

  const sorted = [...manifest.months].sort((a, b) =>
    `${a.year}-${`${a.month}`.padStart(2, "0")}`.localeCompare(
      `${b.year}-${`${b.month}`.padStart(2, "0")}`,
    ),
  );
  const latestEntry = sorted.find((entry) => entry.path === manifest.latest_path);
  const latestMonthEntry = sorted.find(
    (entry) => `${entry.year}-${`${entry.month}`.padStart(2, "0")}` === manifest.latest_month,
  );
  return (
    latestEntry ??
    latestMonthEntry ??
    sorted.at(-1) ??
    null
  );
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

export async function loadMonthlyYutaiMonthData(
  monthEntry: MonthlyYutaiMonthManifest,
): Promise<MonthlyYutaiMonthData | null> {
  const baseUrls = getExternalBaseUrl();

  if (baseUrls.length === 0) {
    return loadLocalMonthData(monthEntry.path);
  }

  for (const baseUrl of baseUrls) {
    try {
      return await fetchJson<MonthlyYutaiMonthData>(
        `${baseUrl}/${monthEntry.path.replace(/^\/+/, "")}`,
      );
    } catch {
      continue;
    }
  }

  return loadLocalMonthData(monthEntry.path);
}

export async function loadMonthlyYutaiPageData(): Promise<MonthlyYutaiPageData> {
  const manifest = await loadMonthlyYutaiManifest();
  const selectedMonthEntry = resolveSelectedMonthEntry(manifest);
  const selectedMonthId = selectedMonthEntry
    ? `${selectedMonthEntry.year}-${`${selectedMonthEntry.month}`.padStart(2, "0")}`
    : manifest?.latest_month ?? DEFAULT_MONTH_ID;
  const monthData = selectedMonthEntry ? await loadMonthlyYutaiMonthData(selectedMonthEntry) : null;

  return {
    manifest,
    selectedMonthId,
    generatedAt: monthData?.generated_at ?? manifest?.generated_at ?? null,
    source: monthData?.source ?? manifest?.source ?? null,
    items: monthData?.records ?? [],
  };
}
