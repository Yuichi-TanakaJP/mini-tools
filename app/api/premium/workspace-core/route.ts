import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PREMIUM_COOKIE_NAME, verifyPremiumSession } from "@/lib/premium-auth";
import { verifyWorkspaceCoreReadProxyToken } from "@/lib/workspace-core/read-proxy-auth";
import { isWorkspaceCoreConfigured } from "@/lib/workspace-core/config";
import { buildWorkspaceCoreControlCenterV2Error } from "@/lib/workspace-core/control-center-v2";
import { createWorkspaceCoreServerClient } from "@/lib/workspace-core/server";
import {
  loadWorkspaceCoreControlCenter,
  loadWorkspaceCoreControlCenterV2,
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
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode")?.trim() || "overview";
  const slug = url.searchParams.get("slug")?.trim() || "";
  const isControlCenterV2 = mode === "control-center-v2";
  const v2ErrorClock = new Date();

  const proxyAuthorized = verifyWorkspaceCoreReadProxyToken(
    request.headers.get("authorization"),
  );

  if (!proxyAuthorized) {
    const cookieStore = await cookies();
    const session = cookieStore.get(PREMIUM_COOKIE_NAME)?.value;
    if (!verifyPremiumSession(session)) {
      if (isControlCenterV2) {
        return json(
          buildWorkspaceCoreControlCenterV2Error({
            status: "unauthenticated",
            code: "UNAUTHENTICATED",
            message: "Premium認証が必要です。",
            now: v2ErrorClock,
          }),
          401,
        );
      }
      return json(
        { status: "unauthenticated", data: null, message: "Premium認証が必要です。" },
        401,
      );
    }
  }

  if (!isWorkspaceCoreConfigured()) {
    if (isControlCenterV2) {
      return json(
        buildWorkspaceCoreControlCenterV2Error({
          status: "unconfigured",
          code: "PROVIDER_UNCONFIGURED",
          message: "Workspace Core provider is not configured.",
          now: v2ErrorClock,
        }),
        503,
      );
    }
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

  if ((mode === "product" || mode === "provider") && !SLUG_PATTERN.test(slug)) {
    return json({ status: "error", data: null, message: "有効なslugを指定してください。" }, 400);
  }

  if (
    (mode === "overview" ||
      mode === "control-center" ||
      mode === "control-center-v2") &&
    slug
  ) {
    if (isControlCenterV2) {
      return json(
        buildWorkspaceCoreControlCenterV2Error({
          status: "error",
          code: "INVALID_REQUEST",
          message: "このmodeではslugを指定できません。",
          now: v2ErrorClock,
        }),
        400,
      );
    }
    return json({ status: "error", data: null, message: "このmodeではslugを指定できません。" }, 400);
  }

  try {
    const supabase = createWorkspaceCoreServerClient();

    if (mode === "control-center-v2") {
      const data = await loadWorkspaceCoreControlCenterV2(supabase);
      return json(data);
    }

    if (mode === "control-center") {
      const data = await loadWorkspaceCoreControlCenter(supabase);
      return json({ status: "ok", data });
    }

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
    if (isControlCenterV2) {
      // V2 never logs or returns raw upstream/database error payloads.
      console.error("[workspace-core] Control Center V2 read API failed");
      return json(
        buildWorkspaceCoreControlCenterV2Error({
          status: "error",
          code: "PROVIDER_FAILURE",
          message: "Workspace Coreの取得に失敗しました。",
          now: v2ErrorClock,
        }),
        500,
      );
    }
    console.error("[workspace-core] read API failed", error);
    return json({ status: "error", data: null, message: "Workspace Coreの取得に失敗しました。" }, 500);
  }
}
