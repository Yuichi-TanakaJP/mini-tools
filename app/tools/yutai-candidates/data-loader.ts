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

function getExternalManifestUrls() {
  const configuredUrl = process.env.MONTHLY_YUTAI_DATA_BASE_URL?.trim() ?? "";
  if (!configuredUrl) {
    return [];
  }

  if (configuredUrl.endsWith(".json")) {
    return [configuredUrl];
  }

  return [`${configuredUrl.replace(/\/+$/, "")}/manifest.json`];
}

function buildExternalMonthDataUrl(manifestUrl: string, monthPath: string) {
  return new URL(monthPath, manifestUrl).toString();
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
  requestedMonthId?: string,
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
  const requestedEntry = requestedMonthId
    ? sorted.find(
        (entry) => `${entry.year}-${`${entry.month}`.padStart(2, "0")}` === requestedMonthId,
      )
    : null;
  return (
    requestedEntry ??
    latestEntry ??
    latestMonthEntry ??
    sorted.at(-1) ??
    null
  );
}

export async function loadMonthlyYutaiManifest(): Promise<MonthlyYutaiManifest | null> {
  const manifestUrls = getExternalManifestUrls();

  if (manifestUrls.length === 0) {
    return loadLocalManifest();
  }

  for (const manifestUrl of manifestUrls) {
    try {
      return await fetchJson<MonthlyYutaiManifest>(manifestUrl);
    } catch {
      continue;
    }
  }

  return loadLocalManifest();
}

export async function loadMonthlyYutaiMonthData(
  monthEntry: MonthlyYutaiMonthManifest,
  manifestUrl?: string | null,
): Promise<MonthlyYutaiMonthData | null> {
  const manifestUrls = manifestUrl ? [manifestUrl] : getExternalManifestUrls();

  if (manifestUrls.length === 0) {
    return loadLocalMonthData(monthEntry.path);
  }

  for (const currentManifestUrl of manifestUrls) {
    try {
      return await fetchJson<MonthlyYutaiMonthData>(buildExternalMonthDataUrl(currentManifestUrl, monthEntry.path));
    } catch {
      continue;
    }
  }

  return loadLocalMonthData(monthEntry.path);
}

export async function loadMonthlyYutaiPageData(requestedMonthId?: string): Promise<MonthlyYutaiPageData> {
  const manifestUrls = getExternalManifestUrls();
  let manifest: MonthlyYutaiManifest | null = null;
  let resolvedManifestUrl: string | null = null;

  if (manifestUrls.length > 0) {
    for (const manifestUrl of manifestUrls) {
      try {
        manifest = await fetchJson<MonthlyYutaiManifest>(manifestUrl);
        resolvedManifestUrl = manifestUrl;
        break;
      } catch {
        continue;
      }
    }
  }

  if (!manifest) {
    manifest = await loadLocalManifest();
  }

  const selectedMonthEntry = resolveSelectedMonthEntry(manifest, requestedMonthId);
  const selectedMonthId = selectedMonthEntry
    ? `${selectedMonthEntry.year}-${`${selectedMonthEntry.month}`.padStart(2, "0")}`
    : manifest?.latest_month ?? DEFAULT_MONTH_ID;
  const monthData = selectedMonthEntry
    ? await loadMonthlyYutaiMonthData(selectedMonthEntry, resolvedManifestUrl)
    : null;

  return {
    manifest,
    selectedMonthId,
    generatedAt: monthData?.generated_at ?? manifest?.generated_at ?? null,
    source: monthData?.source ?? manifest?.source ?? null,
    items: monthData?.records ?? [],
  };
}
