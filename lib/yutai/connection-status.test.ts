import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { YutaiConnectionStatus, type CalendarConnection } from "./calendar-connection";
import { EMPTY_STATE } from "./repository";

vi.mock("./browser", () => ({ getYutaiRepository: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const connection: CalendarConnection = {
  view: EMPTY_STATE, projection: null, blocked: false,
  action: { status: "idle", message: "", completed: 0, total: 0, retryable: false, month: null },
  save: async () => {}, retry: async () => {}, reviewRejected: async () => {}, refresh: async () => undefined,
};
it.each(["true", "false", undefined])("describes the actual canonical mode (%s)", flag => {
  vi.stubGlobal("React", React);
  vi.stubEnv("NEXT_PUBLIC_YUTAI_DB_CANONICAL", flag);
  const html = renderToStaticMarkup(React.createElement(YutaiConnectionStatus, { connection }));
  if (flag === "true") {
    expect(html).toContain("Supabase保存");
    expect(html).not.toContain("未完了");
    expect(html).not.toContain("検証モード");
  } else {
    expect(html).toContain("検証モード");
    expect(html).toContain("本番切替は未完了");
  }
  expect(html).toContain("Supabaseへのログインが必要です");
});
