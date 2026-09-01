import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { isWorkspaceCoreConfigured } from "@/lib/workspace-core/config";
import { createWorkspaceCoreServerClient } from "@/lib/workspace-core/server";
import {
  loadWorkspaceCoreOverview,
  loadWorkspaceCoreProductDetail,
  loadWorkspaceCoreProviderImpact,
} from "@/lib/workspace-core/data";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
  if (!verifyPremiumSession(session)) {
    return json({ status: "unauthenticated", data: null, message: "Premium認証が必要です。" }, 401);
  }

  if (!isWorkspaceCoreConfigured()) {
    return json(
      {
        status: "unconfigured",
        data: null,
        message:
          "Workspace Core のserver-only環境変数が未設定です。WORKSPACE_CORE_SUPABASE_URL / WORKSPACE_CORE_SUPABASE_SECRET_KEY を設定してください。",
      },
      503,
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode")?.trim() || "overview";
  const slug = url.searchParams.get("slug")?.trim() || "";

  if ((mode === "product" || mode === "provider") && !SLUG_PATTERN.test(slug)) {
    return json({ status: "error", data: null, message: "有効なslugを指定してください。" }, 400);
  }

  try {
    const supabase = createWorkspaceCoreServerClient();

    if (mode === "overview") {
      const data = await loadWorkspaceCoreOverview(supabase);
      return json({ status: "ok", data });
    }

    if (mode === "product") {
      const data = await loadWorkspaceCoreProductDetail(supabase, slug);
      if (!data) return json({ status: "not_found", data: null, message: "Productが見つかりません。" }, 404);
      return json({ status: "ok", data });
    }

    if (mode === "provider") {
      const data = await loadWorkspaceCoreProviderImpact(supabase, slug);
      return json({ status: "ok", data });
    }

    return json({ status: "error", data: null, message: "未対応のmodeです。" }, 400);
  } catch (error) {
    console.error("[workspace-core] read API failed", error);
    return json({ status: "error", data: null, message: "Workspace Coreの取得に失敗しました。" }, 500);
  }
}
