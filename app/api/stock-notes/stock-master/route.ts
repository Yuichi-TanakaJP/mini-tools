import { NextResponse } from "next/server";
import { fetchJson, getApiBaseUrl } from "@/lib/market-api";

// 銘柄分析ダッシュボード（/tools/stock-notes）の「銘柄の登録」フォームで、
// 証券コード入力から銘柄名を補完するためのルート。
//
// なぜ独自ルートを挟むか: MARKET_INFO_API_BASE_URL はサーバー専用の環境変数であり、
// クライアントから直接 `{market-info-api}/stock-master/latest` を叩けない。
// 既存の app/tools/my-stocks/data-loader.ts の loadStockMasterReference と同じ
// 取得方法（fetchJson + getApiBaseUrl + cache: "no-store"）・同じフィールド優先順位
// （display_name || name || abbrev_name）・同じ全角→半角正規化に合わせている
// （取得方法を変えると挙動差分の温床になるため）。
//
// レスポンスは { code, name } の配列のみに絞り込む（全4,451銘柄・約数百KBある
// フルレコードをそのまま返すと重いため、登録フォームに必要な最小限のフィールドだけ返す）。
// 呼び出し側（useStockNotesStockMaster.ts）はこれを1回だけ fetch してメモリに使い回す
// （my-stocks の useStockMaster.ts と同じ「重いので取得結果は使い回す」方針）。

type StockMasterLatestRecord = {
  code?: unknown;
  name?: unknown;
  display_name?: unknown;
  abbrev_name?: unknown;
};

export type StockNotesStockMasterEntry = { code: string; name: string };

const CACHE_CONTROL = "public, max-age=300";

function normalizeAscii(value: string): string {
  return value.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

export async function GET() {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return NextResponse.json({ error: "market-info API is not configured" }, { status: 503 });
  }

  try {
    const records = await fetchJson<StockMasterLatestRecord[]>(`${apiBase}/stock-master/latest`, 300, {
      cache: "no-store",
    });
    const entries: StockNotesStockMasterEntry[] = [];
    for (const r of records) {
      if (typeof r.code !== "string" || !r.code) continue;
      const rawName =
        (typeof r.display_name === "string" && r.display_name) ||
        (typeof r.name === "string" && r.name) ||
        (typeof r.abbrev_name === "string" && r.abbrev_name) ||
        "";
      if (!rawName) continue;
      entries.push({ code: r.code, name: normalizeAscii(rawName) });
    }
    return NextResponse.json(entries, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch {
    return NextResponse.json({ error: "failed to fetch stock master" }, { status: 502 });
  }
}
