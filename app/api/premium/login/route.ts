import { NextResponse } from "next/server";
import {
  PREMIUM_COOKIE_NAME,
  PREMIUM_SESSION_MAX_AGE_SECONDS,
  createPremiumSessionValue,
  isPremiumAuthConfigured,
  verifyPremiumPassword,
} from "@/lib/premium-auth";

export async function POST(request: Request) {
  if (!isPremiumAuthConfigured()) {
    return NextResponse.json(
      { error: "PREMIUM_ACCESS_PASSWORD / PREMIUM_ACCESS_SECRET が未設定です。" },
      { status: 500 }
    );
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim() ?? "";

  if (!verifyPremiumPassword(password)) {
    return NextResponse.json(
      { error: "パスワードが正しくありません。" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: PREMIUM_COOKIE_NAME,
    value: createPremiumSessionValue(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PREMIUM_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
