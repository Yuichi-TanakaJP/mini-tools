import { afterEach, describe, expect, it, vi } from "vitest";
import { legacyYutaiKeys, legacyYutaiWriteBlocked } from "./cutover";
import { applyBackup, BACKUP_SCHEMA } from "../local-data-transfer";
import { markChanged, pullAll, pushAll } from "../sync/client";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function storage() {
  const rows = new Map<string, string>([["yutai_memo_items_v1", "original"], ["my_stocks_items_v1", "old"]]);
  vi.stubGlobal("window", { localStorage: {
    get length() { return rows.size; }, key: (i: number) => [...rows.keys()][i] ?? null,
    getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => rows.set(k,v), removeItem: (k: string) => rows.delete(k),
  } });
  return rows;
}
describe("Yutai cutover legacy protection", () => {
  it("protects all seven business keys only when canonical mode is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_YUTAI_DB_CANONICAL", "false");
    expect([...legacyYutaiKeys].some(legacyYutaiWriteBlocked)).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_YUTAI_DB_CANONICAL", "true");
    expect([...legacyYutaiKeys].every(legacyYutaiWriteBlocked)).toBe(true);
    expect(legacyYutaiWriteBlocked("my_stocks_items_v1")).toBe(false);
  });
  it("preserves old Yutai data during replace and merge imports while importing other tools", () => {
    vi.stubEnv("NEXT_PUBLIC_YUTAI_DB_CANONICAL", "true"); const rows = storage();
    const backup = { schema: BACKUP_SCHEMA, version: 1, exportedAt: "", itemCount: 1, data: { my_stocks_items_v1: "new" } };
    expect(applyBackup(backup,"replace")).toEqual({ applied: 1, removed: 0 });
    applyBackup({ ...backup, data: { yutai_memo_items_v1: "overwrite" } },"merge");
    expect(rows.get("yutai_memo_items_v1")).toBe("original");
    expect(rows.get("my_stocks_items_v1")).toBe("new");
  });
  it("never pushes or hydrates legacy Yutai even if an old server returns it", async () => {
    vi.stubEnv("NEXT_PUBLIC_YUTAI_DB_CANONICAL", "true"); const rows = storage();
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ items: [{ key: "yutai_memo_items_v1", value: ["remote"], updatedAt: "2099-01-01T00:00:00Z" }] }) }));
    vi.stubGlobal("fetch",fetcher);
    markChanged("yutai_memo_items_v1");
    expect(rows.has("mini_tools_sync_meta_v1")).toBe(false);
    await pushAll(); await pullAll();
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('"key":"yutai_memo_items_v1"');
    expect(rows.get("yutai_memo_items_v1")).toBe("original");
  });
});
