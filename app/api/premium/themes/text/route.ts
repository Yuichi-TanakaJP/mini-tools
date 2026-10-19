import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { loadThemeText } from "@/app/premium/themes/data-loader";
import { isThemeTextRequest, type ThemeTextRequest } from "@/app/premium/themes/text-contract";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = (await cookies()).get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) return NextResponse.json({ message: "Premium認証が必要です。" }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  const keys = ["themeId", "section", "recordId", "field", "offset", "revision"];
  if (keys.some((key) => params.getAll(key).length > 1) || Array.from(params.keys()).some((key) => !keys.includes(key)) ||
    !/^(0|[1-9][0-9]*)$/.test(params.get("offset") ?? "")) {
    return NextResponse.json({ message: "本文の指定が不正です。" }, { status: 400, headers });
  }
  const input: ThemeTextRequest = {
    themeId: params.get("themeId") ?? "", section: params.get("section") ?? "",
    recordId: params.get("recordId") ?? "", field: params.get("field") ?? "",
    offset: Number(params.get("offset")), revision: params.get("revision") ?? undefined,
  };
  if (!isThemeTextRequest(input)) return NextResponse.json({ message: "本文の指定が不正です。" }, { status: 400, headers });
  const result = await loadThemeText(input);
  if (result.status === "ok") return NextResponse.json(result.data, { headers });
  return NextResponse.json({ message: result.message }, {
    status: result.httpStatus === 409 ? 409 : result.status === "timeout" ? 504 : result.httpStatus === 404 ? 404 : 502, headers,
  });
}
