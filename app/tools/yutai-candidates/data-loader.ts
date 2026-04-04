import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  MonthlyYutaiManifest,
  MonthlyYutaiMonthData,
  MonthlyYutaiPageData,
  NikkoCreditData,
} from "./types";

/** JST の今日の年・月・日を返す */
function getJstToday(): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === "year")?.value ?? "0"),
    month: Number(parts.find((p) => p.type === "month")?.value ?? "0"),
    day: Number(parts.find((p) => p.type === "day")?.value ?? "0"),
  };
}

/**
 * 月末近く（月の後半）に位置する TSE 非営業日。
 * これ以外の祝日は月末最終営業日の計算に影響しないため対象外。
 *
 * - 4/29 昭和の日（固定）: 翌月切替判定に影響する唯一の固定祝日
 * - 4/30 振替: 4/29 が日曜の年（2029 年）
 * - 12/31 大納会: TSE 年末休場（固定）
 *
 * 2030 年以降に利用する場合は末尾に追記すること。
 */
const JP_LATE_MONTH_NON_TRADING = new Set([
  "2025-04-29",
  "2026-04-29",
  "2027-04-29",
  "2028-04-29",
  "2029-04-29",
  "2029-04-30", // 4/29 が日曜のため振替
  "2025-12-31",
  "2026-12-31",
  "2027-12-31",
  "2028-12-31",
  "2029-12-31",
]);

function isBusinessDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  if (dow === 0 || dow === 6) return false;
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return !JP_LATE_MONTH_NON_TRADING.has(key);
}

/**
 * 権利付き最終日（日）を返す。
 * = 月末最終営業日 - 2 営業日
 */
function getKenriLastDay(year: number, month: number): number {
  const lastCalendarDay = new Date(year, month, 0).getDate();
  // 月末から遡って最終営業日を探す
  let day = lastCalendarDay;
  while (!isBusinessDay(year, month, day)) day--;
  // そこからさらに 2 営業日戻る
  let remaining = 2;
  while (remaining > 0) {
    day--;
    if (isBusinessDay(year, month, day)) remaining--;
  }
  return day;
}

/**
 * 当月 or 権利付き最終日後なら翌月を優先し、availableMonths にある最初の候補を返す。
 * どちらもなければ fallback を返す。
 */
function getSmartDefaultMonthId(availableMonths: string[], fallback: string): string {
  const { year, month, day } = getJstToday();
  const kenriLastDay = getKenriLastDay(year, month);
  const isPastKenri = day > kenriLastDay;

  const candidates: string[] = [];
  if (isPastKenri) {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    candidates.push(`${nextYear}-${String(nextMonth).padStart(2, "0")}`);
  }
  candidates.push(`${year}-${String(month).padStart(2, "0")}`);

  for (const id of candidates) {
    if (availableMonths.includes(id)) return id;
  }
  return fallback;
}

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

async function loadLocalNikkoCreditSample(): Promise<NikkoCreditData | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), "nikko_credit_sample.json"), "utf-8");
    return JSON.parse(raw) as NikkoCreditData;
  } catch {
    return null;
  }
}

async function loadNikkoCreditData(): Promise<NikkoCreditData | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return loadLocalNikkoCreditSample();

  try {
    return await fetchJson<NikkoCreditData>(`${apiBase}/nikko/credit`);
  } catch {
    return loadLocalNikkoCreditSample();
  }
}

export async function loadMonthlyYutaiPageData(requestedMonthId?: string): Promise<MonthlyYutaiPageData> {
  const [manifest, nikkoCredit] = await Promise.all([
    loadMonthlyYutaiManifest(),
    loadNikkoCreditData(),
  ]);

  const availableMonths =
    manifest?.months?.map((m) => `${m.year}-${String(m.month).padStart(2, "0")}`) ?? [];

  const selectedMonthId =
    requestedMonthId && availableMonths.includes(requestedMonthId)
      ? requestedMonthId
      : getSmartDefaultMonthId(availableMonths, manifest?.latest_month ?? "");

  const monthData = await loadMonthlyYutaiMonthData(selectedMonthId);

  return {
    manifest,
    selectedMonthId,
    generatedAt: monthData?.generated_at ?? manifest?.generated_at ?? null,
    source: monthData?.source ?? manifest?.source ?? null,
    items: monthData?.records ?? [],
    nikkoCredit,
  };
}
