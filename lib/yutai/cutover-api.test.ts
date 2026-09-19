import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ isSyncConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) }, from: mocks.from,
}) }));
import { POST } from "@/app/api/sync/route";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("rejects a stale client's Yutai write before any tool_data query", async () => {
  vi.stubEnv("NEXT_PUBLIC_YUTAI_DB_CANONICAL", "true");
  const response = await POST(new Request("http://localhost/api/sync", { method: "POST", body: JSON.stringify({ items: [
    { key: "yutai_memo_items_v1", value: [], updatedAt: "2026-09-11T00:00:00Z" },
    { key: "my_stocks_items_v1", value: [], updatedAt: "2026-09-11T00:00:00Z" },
  ] }) }));
  expect(response.status).toBe(409);
  expect(mocks.from).not.toHaveBeenCalled();
});
