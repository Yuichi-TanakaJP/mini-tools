import { NextResponse } from "next/server";
import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import type {
  EarningsCalendarManifest,
  EarningsCalendarResponse,
} from "@/app/tools/earnings-calendar/types";
import { foldEarningsCalendar } from "@/app/tools/stock-notes/earnings-logic";
import type { StockNotesEarningsInfo } from "@/app/tools/stock-notes/earnings-types";

// 銘柄分析ダッシュボード（/tools/stock-notes）向けの次回決算日ルート。
// 設計判断: docs/decision-log/2026-08-11-stock-notes-dashboard-design.md
// - 銘柄マスターの earnings_next_date は空欄が多く使えないため、決算カレンダーAPIを叩いて畳み込む
// - 月次JSONは1本あたり約500KBあり、そのままクライアントへ送るとスマホに重いため、
//   サーバー側で「銘柄コードごとに最も近い1件」へ畳み込んでから返す
// - カレンダーは約2ヶ月先までしか無いため、「未判明」と「取得失敗」を呼び出し側で区別できるよう、
//   本ルートは取得失敗時にエラーレスポンス（本文なし・空オブジェクトへのフォールバックはしない）を返す

const CACHE_CONTROL = "public, max-age=300";
// 過去分は「決算またぎ」判定に使うだけなので、当月＋前月まで見れば十分（設計判断の追加メモ参照）
const PAST_MONTH_OFFSETS = [-1, 0];
// 未来分は当月＋翌月＋翌々月まで見る（カレンダーの提供範囲が「約2ヶ月先まで」のため、余裕を持たせる）
const FUTURE_MONTH_OFFSETS = [0, 1, 2];

function todayJstKey(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function addMonths(monthId: string, delta: number): string {
  const [year, month] = monthId.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function loadManifest(apiBase: string): Promise<EarningsCalendarManifest | null> {
  try {
    return await fetchJson<EarningsCalendarManifest>(`${apiBase}/earnings-calendar/domestic/manifest`);
  } catch {
    return null;
  }
}

async function loadMonth(apiBase: string, monthId: string): Promise<EarningsCalendarResponse | null> {
  try {
    return await fetchJson<EarningsCalendarResponse>(
      `${apiBase}/earnings-calendar/domestic/monthly/${monthId}`,
    );
  } catch {
    return null;
  }
}

export async function GET() {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return NextResponse.json({ error: "market-info API is not configured" }, { status: 503 });
  }

  const today = todayJstKey();
  const currentMonth = today.slice(0, 7);
  const monthIds = Array.from(
    new Set([...PAST_MONTH_OFFSETS, ...FUTURE_MONTH_OFFSETS].map((delta) => addMonths(currentMonth, delta))),
  );

  const [manifest, ...monthResponses] = await Promise.all([
    loadManifest(apiBase),
    ...monthIds.map((id) => loadMonth(apiBase, id)),
  ]);

  // 当月分すら取得できない場合は、部分表示せずエラーとして返す
  // （呼び出し側で「未判明」と「取得失敗」を混同させないため）。
  const currentMonthIndex = monthIds.indexOf(currentMonth);
  if (!monthResponses[currentMonthIndex]) {
    return NextResponse.json({ error: "failed to fetch earnings calendar" }, { status: 502 });
  }

  const { next, last } = foldEarningsCalendar(monthResponses, today);

  const body: StockNotesEarningsInfo = {
    asOfDate: today,
    windowTo: manifest?.current_window.to ?? null,
    earnings: next,
    lastEarnings: last,
  };

  return NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
}
