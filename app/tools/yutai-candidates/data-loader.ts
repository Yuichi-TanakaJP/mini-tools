import { readFile } from "node:fs/promises";
import path from "node:path";
import { canUseLocalMarketDataFallback, getApiBaseUrl, fetchJson } from "@/lib/market-api";
import { getKenriLastDay, getKenriLastDateForMonthId } from "@/app/tools/_shared/yutai-kenri-date";
import type {
  MonthlyYutaiManifest,
  MonthlyYutaiMonthData,
  MonthlyYutaiPageData,
  NikkoCreditData,
  SbiCreditData,
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
  const canUseLocalFallback = canUseLocalMarketDataFallback();

  if (!apiBase) {
    return canUseLocalFallback ? loadLocalManifest() : null;
  }

  try {
    return await fetchJson<MonthlyYutaiManifest>(`${apiBase}/yutai/manifest`);
  } catch {
    return canUseLocalFallback ? loadLocalManifest() : null;
  }
}

export async function loadMonthlyYutaiMonthData(yearMonth: string): Promise<MonthlyYutaiMonthData | null> {
  const apiBase = getApiBaseUrl();
  const canUseLocalFallback = canUseLocalMarketDataFallback();

  if (!apiBase) {
    return canUseLocalFallback ? loadLocalMonthData(yearMonth) : null;
  }

  try {
    return await fetchJson<MonthlyYutaiMonthData>(`${apiBase}/yutai/monthly/${yearMonth}`);
  } catch {
    return canUseLocalFallback ? loadLocalMonthData(yearMonth) : null;
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
  // API未設定時のみサンプルにフォールバック（開発用）
  if (!apiBase) {
    return canUseLocalMarketDataFallback() ? loadLocalNikkoCreditSample() : null;
  }

  try {
    return await fetchJson<NikkoCreditData>(`${apiBase}/nikko/credit`);
  } catch {
    // APIあり・fetch失敗時はサンプルを返さず null にする（誤情報防止）
    return null;
  }
}

async function loadLocalSbiCreditSample(): Promise<SbiCreditData | null> {
  try {
    const raw = await readFile(path.join(getDataDir(), "sbi_credit_sample.json"), "utf-8");
    return JSON.parse(raw) as SbiCreditData;
  } catch {
    return null;
  }
}

/**
 * SBI一般信用データを取得する。
 *
 * SBI一般信用は15営業日の短期売りのため、latest.json には当月クロス対象銘柄のみが掲載される。
 * - 当月・将来月を選択している場合: latest.json（= 当月時点の在庫）を使う
 * - 過去月を選択している場合: monthly/{yearMonth}.json（月次アーカイブ）を使う
 * API未設定時はサンプルにフォールバック（開発用）。
 */
async function loadSbiCreditData(selectedMonthId: string): Promise<SbiCreditData | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return canUseLocalMarketDataFallback() ? loadLocalSbiCreditSample() : null;
  }

  const { year, month } = getJstToday();
  const currentMonthId = `${year}-${String(month).padStart(2, "0")}`;
  const url = selectedMonthId >= currentMonthId
    ? `${apiBase}/sbi/credit/latest`
    : `${apiBase}/sbi/credit/monthly/${selectedMonthId}`;

  try {
    return await fetchJson<SbiCreditData>(url);
  } catch {
    return null;
  }
}

// 優待ダッシュボードの「全月」表示用。manifest の全月データを結合して返す。
// yutai-candidates 側の月別表示（loadMonthlyYutaiPageData）は従来どおりで変更しない。
export const ALL_MONTHS_ID = "all";

export async function loadMonthlyYutaiAllMonthsPageData(): Promise<MonthlyYutaiPageData> {
  const { year, month } = getJstToday();
  const currentMonthId = `${year}-${String(month).padStart(2, "0")}`;

  const [manifest, nikkoCredit, sbiCredit] = await Promise.all([
    loadMonthlyYutaiManifest(),
    loadNikkoCreditData(),
    // 全月表示では SBI は当月在庫（latest 相当）を使う
    loadSbiCreditData(currentMonthId),
  ]);

  // アーカイブが複数年に跨ると同じ権利月が年違いで並ぶため、各権利月は最新年のデータだけを使う。
  // record は month しか持たず、code:month キーが年違いで衝突するのを防ぐ（全月=12ヶ月カレンダー想定）。
  const latestByMonth = new Map<number, { year: number; month: number }>();
  for (const entry of manifest?.months ?? []) {
    const current = latestByMonth.get(entry.month);
    if (!current || entry.year > current.year) {
      latestByMonth.set(entry.month, { year: entry.year, month: entry.month });
    }
  }
  const monthIds = [...latestByMonth.values()]
    .sort((a, b) => a.month - b.month)
    .map((m) => `${m.year}-${String(m.month).padStart(2, "0")}`);
  const monthDataList = await Promise.all(monthIds.map((id) => loadMonthlyYutaiMonthData(id)));
  const items = monthDataList.flatMap((data) => data?.records ?? []);

  return {
    manifest,
    selectedMonthId: ALL_MONTHS_ID,
    selectedMonthKenriLastDate: null,
    generatedAt: manifest?.generated_at ?? null,
    source: manifest?.source ?? null,
    items,
    nikkoCredit,
    sbiCredit,
  };
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

  const [monthData, sbiCredit] = await Promise.all([
    loadMonthlyYutaiMonthData(selectedMonthId),
    loadSbiCreditData(selectedMonthId),
  ]);

  return {
    manifest,
    selectedMonthId,
    selectedMonthKenriLastDate: getKenriLastDateForMonthId(selectedMonthId),
    generatedAt: monthData?.generated_at ?? manifest?.generated_at ?? null,
    source: monthData?.source ?? manifest?.source ?? null,
    items: monthData?.records ?? [],
    nikkoCredit,
    sbiCredit,
  };
}
