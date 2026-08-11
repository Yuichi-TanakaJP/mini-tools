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
//   サーバー側で「銘柄コードごとに最も近い1件」へ畳み込んでから返す。さらに、呼び出し側が
//   実際に必要とする銘柄コード（保有＋分析済み、通常は数十件）だけを ?codes= クエリで受け取り、
//   全銘柄（実測1,039銘柄・約140KB）を返さないよう絞り込む
// - カレンダーは約2ヶ月先までしか無いため、「未判明」と「取得失敗」を呼び出し側で区別できるよう、
//   本ルートは取得失敗時にエラーレスポンス（本文なし・空オブジェクトへのフォールバックはしない）を返す
// - 過去分・未来分の月次JSONが一部だけ取得に失敗した場合も、当月分さえ取れていれば200を返すが、
//   `complete: false` と `missingMonths` で欠落を明示する。呼び出し側はこれを見て
//   「未判明」と誤解させない表示に倒す（欠落した月にだけ決算があった銘柄を見逃す可能性があるため）。
//   ただし manifest の current_window（公開範囲）より先の月は「まだ公開されていない」だけの
//   正常な状態であり、取得失敗ではないため missingMonths / complete の判定対象に含めない
//   （でないと、当ルートが当月+2ヶ月先まで要求している都合で、未公開の月が常に「欠落」扱いになり
//   complete が恒常的に false になってしまう）

const CACHE_CONTROL = "public, max-age=300";
// 過去分は「決算またぎ」判定と「前回決算」表示の両方に使う。四半期決算は約3ヶ月間隔のため、
// 当月＋前月だけでは前回決算が見つからない銘柄が実測で出た（対象18銘柄中6件が空だった）。
// 当月＋過去3ヶ月（計4ヶ月分）まで見る（設計判断の追加メモ参照）
const PAST_MONTH_OFFSETS = [-3, -2, -1, 0];
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

function parseCodes(request: Request): string[] {
  const url = new URL(request.url);
  const raw = url.searchParams.get("codes") ?? "";
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((code) => code.trim())
        .filter((code) => code.length > 0),
    ),
  );
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

export async function GET(request: Request) {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return NextResponse.json({ error: "market-info API is not configured" }, { status: 503 });
  }

  // codes が無いと全銘柄を返してしまう（実測1,039銘柄・約140KB）ため、必須パラメータにする。
  // 空で呼ばれた場合は「安全側に倒して空を返す」のではなく明示的にエラーにし、
  // 呼び出し側の実装漏れに気付けるようにする。
  const codes = parseCodes(request);
  if (codes.length === 0) {
    return NextResponse.json({ error: "codes query parameter is required" }, { status: 400 });
  }
  const codesFilter = new Set(codes);

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

  // 当月以外の月が取得に失敗した場合は200のまま返すが、欠落を明示する。
  // （例: 月初に前月データの取得だけ失敗すると、決算またぎ判定に必要な lastEarnings が
  //  欠落したまま「未判明」に見えてしまうため、呼び出し側が区別できるようにする）
  //
  // ただし、決算カレンダーは manifest の current_window より先の月をそもそも公開していない
  // （実測: 2026-08-11時点で current_window.to = 2026-09-30。当ルートは当月+2ヶ月先まで
  // 要求するため、公開範囲外の月（例: 2026-10）は常に取得失敗になる）。これは障害ではなく
  // 「まだ判明していない」正常な状態なので、公開範囲より先の月は missingMonths に含めない
  // （= complete の判定対象から除外する）。manifest 自体が取得できず公開範囲が分からない
  // 場合は、安全側に倒して欠落月をそのまま missingMonths に残す（除外の判断ができないため）。
  const missingMonthsRaw = monthIds.filter((_, index) => !monthResponses[index]);
  const windowToMonth = manifest?.current_window.to.slice(0, 7) ?? null;
  const missingMonths = windowToMonth
    ? missingMonthsRaw.filter((id) => id <= windowToMonth)
    : missingMonthsRaw;
  const complete = missingMonths.length === 0;

  const { next, last } = foldEarningsCalendar(monthResponses, today, codesFilter);

  const body: StockNotesEarningsInfo = {
    asOfDate: today,
    windowTo: manifest?.current_window.to ?? null,
    earnings: next,
    lastEarnings: last,
    complete,
    missingMonths,
  };

  return NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
}
