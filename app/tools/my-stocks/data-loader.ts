// app/tools/my-stocks/data-loader.ts
import {
  loadMonthlyYutaiManifest,
  loadMonthlyYutaiMonthData,
} from "@/app/tools/yutai-candidates/data-loader";
import { loadEarningsCalendarPageData } from "@/app/tools/earnings-calendar/data-loader";
import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type { MyStocksReference } from "./types";

type StockMasterLatestRecord = {
  code: string;
  name: string;
  display_name: string;
  abbrev_name: string;
  market: string;
  sector: string | null;
  earnings_next_date: string | null;
  yutai_months: string | null;
  dividend_yield_pct: number | null;
  dividend_per_share: number | null;
  dividend_as_of: string | null;
  as_of_date: string;
};

/** JST の今日（YYYY-MM-DD）を返す。 */
function getJstTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * 公開データを「広めに」取得し、code→情報の対応表を作る。
 * ユーザーの保有/ウォッチ銘柄コードはここでは使わない（サーバへ送らない）。
 * クライアントがこの表を自分のコードで filter してバッジ表示する。
 *
 * データソースが未提供（API 未設定・同梱データ無し）の場合は空の表を返し、
 * バッジは表示されないだけでツール本体は動く。
 */
export async function loadMyStocksReference(): Promise<MyStocksReference> {
  const stockMasterReference = await loadStockMasterReference();
  if (stockMasterReference) return stockMasterReference;

  const today = getJstTodayIso();

  const [yutaiMonthsByCode, nextEarningsByCode] = await Promise.all([
    buildYutaiMonthsByCode(),
    buildNextEarningsByCode(today),
  ]);

  return {
    asOf: today,
    nextEarningsByCode,
    yutaiMonthsByCode,
    dividendByCode: {},
    stockMaster: [],
  };
}

async function loadStockMasterReference(): Promise<MyStocksReference | null> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return null;

  try {
    const records = await fetchJson<StockMasterLatestRecord[]>(
      `${apiBase}/stock-master/latest`,
      300,
      { cache: "no-store" },
    );
    const nextEarningsByCode: Record<string, string> = {};
    const yutaiMonthsByCode: Record<string, number[]> = {};
    const dividendByCode: MyStocksReference["dividendByCode"] = {};
    const stockMaster: MyStocksReference["stockMaster"] = [];
    let asOf: string | null = null;

    for (const record of records) {
      if (!record.code) continue;
      asOf ??= record.as_of_date || null;
      if (record.earnings_next_date) {
        nextEarningsByCode[record.code] = record.earnings_next_date;
      }
      const months = parseYutaiMonths(record.yutai_months);
      if (months.length > 0) {
        yutaiMonthsByCode[record.code] = months;
      }
      if (typeof record.dividend_yield_pct === "number") {
        dividendByCode[record.code] = {
          yieldPct: record.dividend_yield_pct,
          perShare: typeof record.dividend_per_share === "number" ? record.dividend_per_share : null,
          asOf: record.dividend_as_of,
        };
      }
      const dividend = dividendByCode[record.code];
      stockMaster.push({
        code: record.code,
        name: normalizeAscii(record.display_name || record.name || record.abbrev_name),
        market: record.market,
        sector: record.sector,
        ...(dividend ? { dividend } : {}),
      });
    }

    return {
      asOf,
      nextEarningsByCode,
      yutaiMonthsByCode,
      dividendByCode,
      stockMaster,
    };
  } catch {
    return null;
  }
}

function normalizeAscii(value: string): string {
  return value.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

function parseYutaiMonths(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    .sort((a, b) => a - b);
}

async function buildYutaiMonthsByCode(): Promise<Record<string, number[]>> {
  const map: Record<string, number[]> = {};
  try {
    const manifest = await loadMonthlyYutaiManifest();
    if (!manifest) return map;

    const monthDataList = await Promise.all(
      manifest.months.map((m) =>
        loadMonthlyYutaiMonthData(`${m.year}-${String(m.month).padStart(2, "0")}`),
      ),
    );

    for (const monthData of monthDataList) {
      if (!monthData) continue;
      for (const rec of monthData.records) {
        if (!rec.code || !Number.isInteger(rec.month)) continue;
        const months = (map[rec.code] ??= []);
        if (!months.includes(rec.month)) months.push(rec.month);
      }
    }

    for (const code of Object.keys(map)) {
      map[code].sort((a, b) => a - b);
    }
  } catch {
    return map;
  }
  return map;
}

async function buildNextEarningsByCode(todayIso: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const { domestic } = await loadEarningsCalendarPageData();

    const responses = [
      ...Object.values(domestic.monthData),
      ...(domestic.latest ? [domestic.latest] : []),
    ];

    for (const response of responses) {
      for (const day of response.calendar) {
        if (day.date < todayIso) continue; // 過去の決算は対象外
        for (const item of day.items) {
          if (!item.code) continue;
          const current = map[item.code];
          // より早い予定日を優先
          if (!current || day.date < current) {
            map[item.code] = day.date;
          }
        }
      }
    }
  } catch {
    return map;
  }
  return map;
}
