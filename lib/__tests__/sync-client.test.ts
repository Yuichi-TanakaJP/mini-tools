import { afterEach, describe, expect, it, vi } from "vitest";
import { pushAll } from "../sync/client";

class MemoryLocalStorage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  keys() {
    return Array.from(this.store.keys());
  }
}

function installWindow(localStorage: MemoryLocalStorage) {
  vi.stubGlobal("window", { localStorage });
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sync client", () => {
  it("repairs a newer empty server value by retrying with the preserved local data", async () => {
    const storage = new MemoryLocalStorage();
    installWindow(storage);
    storage.setItem("yutai_memo_items_v1", JSON.stringify([{ id: "kept" }]));
    storage.setItem(
      "mini_tools_sync_meta_v1",
      JSON.stringify({ yutai_memo_items_v1: { updatedAt: "2026-01-01T00:00:00.000Z" } }),
    );

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (fetchMock.mock.calls.length === 1) {
        expect(body.items[0].updatedAt).toBe("2026-01-01T00:00:00.000Z");
        return jsonResponse({
          items: [
            {
              key: "yutai_memo_items_v1",
              value: [],
              updatedAt: "2099-01-02T00:00:00.000Z",
            },
          ],
        });
      }

      expect(body.items[0].value).toEqual([{ id: "kept" }]);
      expect(new Date(body.items[0].updatedAt).getTime()).toBeGreaterThan(
        new Date("2099-01-02T00:00:00.000Z").getTime(),
      );
      return jsonResponse({
        items: [
          {
            key: "yutai_memo_items_v1",
            value: [{ id: "kept" }],
            updatedAt: body.items[0].updatedAt,
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(pushAll()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storage.getItem("yutai_memo_items_v1") ?? "null")).toEqual([
      { id: "kept" },
    ]);
  });


  it("hydrates non-empty server data over an empty local value during upload", async () => {
    const storage = new MemoryLocalStorage();
    installWindow(storage);
    storage.setItem("yutai_memo_items_v1", JSON.stringify([]));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          items: [
            {
              key: "yutai_memo_items_v1",
              value: [{ id: "server" }],
              updatedAt: "2026-01-03T00:00:00.000Z",
            },
          ],
        }),
      ),
    );

    await expect(pushAll()).resolves.toEqual({ ok: true });
    expect(JSON.parse(storage.getItem("yutai_memo_items_v1") ?? "null")).toEqual([
      { id: "server" },
    ]);
  });

  it("keeps only the configured number of safety backups", async () => {
    const storage = new MemoryLocalStorage();
    installWindow(storage);
    storage.setItem("yutai_memo_items_v1", JSON.stringify([{ id: "kept" }]));
    storage.setItem("mini_tools_sync_safety_backup_v1:1", "{}");
    storage.setItem("mini_tools_sync_safety_backup_v1:2", "{}");
    storage.setItem("mini_tools_sync_safety_backup_v1:3", "{}");
    storage.setItem("mini_tools_sync_safety_backup_v1:4", "{}");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ items: [] })));

    await expect(pushAll()).resolves.toEqual({ ok: true });

    const backupKeys = storage
      .keys()
      .filter((key) => key.startsWith("mini_tools_sync_safety_backup_v1:"));
    expect(backupKeys).toHaveLength(3);
  });
});