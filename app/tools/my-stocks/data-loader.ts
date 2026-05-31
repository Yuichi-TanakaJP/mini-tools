// app/tools/my-stocks/data-loader.ts
import {
  loadMonthlyYutaiManifest,
  loadMonthlyYutaiMonthData,
} from "@/app/tools/yutai-candidates/data-loader";
import { loadEarningsCalendarPageData } from "@/app/tools/earnings-calendar/data-loader";
import type { MyStocksReference } from "./types";

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
  const today = getJstTodayIso();

  const [yutaiMonthsByCode, nextEarningsByCode] = await Promise.all([
    buildYutaiMonthsByCode(),
    buildNextEarningsByCode(today),
  ]);

  return {
    asOf: today,
    nextEarningsByCode,
    yutaiMonthsByCode,
  };
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
