import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { getApiBaseUrl } from "@/lib/market-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 一度に登録できる銘柄コード数の上限。市場情報・日興への負荷を抑える。 */
const MAX_CODES = 100;

async function isAuthorized(): Promise<boolean> {
  // 既存の premium セッション認証を gate に使う。
  // 第三者が日興セッション / market-info の取得キューを濫費するのを防ぐ。
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  return verifyPremiumSession(session);
}

/** 4桁中心の日本株コード。英字混じり（例: 130A）も許容する。 */
function normalizeCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const code = v.trim().toUpperCase();
    if (/^[0-9][0-9A-Z]{3}$/.test(code)) seen.add(code);
    if (seen.size >= MAX_CODES) break;
  }
  return [...seen];
}

/**
 * 優待銘柄メモ帳から「この銘柄の信用売り残高を取得したい」コードを受け取り、
 * market-info に取得対象として登録する（完全非同期 = 即返す）。
 * 実際の取得・公開 JSON 更新は market-info PC が手動パスキーで自分のペースで行う。
 * 反映は次回のページ読込で loadNikkoShortBalance() が拾う。
 */
export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    // 未ログイン / セッション期限切れ。クライアントが JSON.parse できるよう JSON で返す。
    // 存在自体を伏せたい意図で 404 を使うが、ボディは構造化エラー。
    return NextResponse.json(
      { error: "ログインが必要です。/premium/login からログインしてください。" },
      { status: 404 },
    );
  }

  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return NextResponse.json(
      { error: "MARKET_INFO_API_BASE_URL is not configured" },
      { status: 503 },
    );
  }

  let body: { codes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const codes = normalizeCodes(body.codes);
  if (codes.length === 0) {
    return NextResponse.json({ error: "codes is required" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase}/nikko/short-balance/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "market-info への登録に失敗しました", detail: String(e) },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const upstream = res.status;
    const retryable = upstream === 503 || upstream === 429;
    return NextResponse.json(
      { error: "market-info が登録を受け付けませんでした", upstreamStatus: upstream, retryable },
      { status: retryable ? upstream : 502 },
    );
  }

  // 受付完了。完全非同期なので結果は待たず、登録できた件数だけ返す。
  return NextResponse.json({ accepted: true, requested: codes.length });
}
