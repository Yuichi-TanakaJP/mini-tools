import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HoldingsFetchError,
  bulkInsertHoldingsAsStocks,
  deleteStockById,
  fetchEarnings,
  fetchHoldings,
  insertStock,
  isDuplicateStockError,
  isForeignKeyViolationError,
  isSessionExpiredSupabaseError,
  normalizeLastEarnings,
  updateStockCategory,
} from "../data";

/**
 * 最小限の Supabase クライアントモック。
 * insertStock は .from().insert().select().single() を、
 * updateStockCategory は .from().update().eq() を、
 * deleteStockById は .from().delete().eq() を呼ぶ。
 * 呼び出しごとの挙動は各テストで注入する関数（handlers）に委譲する。
 */
function makeSupabaseMock(handlers: {
  insert?: (table: string, values: Record<string, unknown>) => { data: unknown; error: unknown };
  update?: (table: string, values: Record<string, unknown>, id: string) => { error: unknown };
  delete?: (table: string, id: string) => { error: unknown };
}): SupabaseClient {
  const client = {
    from(table: string) {
      return {
        insert(values: Record<string, unknown>) {
          return {
            select() {
              return {
                single() {
                  const result = handlers.insert?.(table, values) ?? { data: null, error: new Error("not mocked") };
                  return Promise.resolve(result);
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq(_column: string, id: string) {
              const result = handlers.update?.(table, values, id) ?? { error: new Error("not mocked") };
              return Promise.resolve(result);
            },
          };
        },
        delete() {
          return {
            eq(_column: string, id: string) {
              const result = handlers.delete?.(table, id) ?? { error: new Error("not mocked") };
              return Promise.resolve(result);
            },
          };
        },
      };
    },
  };
  return client as unknown as SupabaseClient;
}

function makeFetchResponse(ok: boolean, status: number, body: unknown): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("fetchHoldings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("401（セッション切れ）は HoldingsFetchError を status 付きで投げる（空配列にフォールバックしない）", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(false, 401, { error: "unauthorized" }));

    await expect(fetchHoldings()).rejects.toMatchObject({
      name: "HoldingsFetchError",
      status: 401,
    });
  });

  it("500 などの他のエラーも HoldingsFetchError を投げる", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(false, 500, { error: "server error" }));

    await expect(fetchHoldings()).rejects.toBeInstanceOf(HoldingsFetchError);
    await expect(fetchHoldings()).rejects.toMatchObject({ status: 500 });
  });

  it("正常時は my_stocks_items_v1 を normalize して返し、同期日時(updatedAt)も返す", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse(true, 200, {
        items: [
          {
            key: "my_stocks_items_v1",
            updatedAt: "2026-06-21T00:00:00.000Z",
            value: [
              {
                id: "a",
                code: "7203",
                name: "トヨタ自動車",
                tab: "holding",
                addedAt: 1,
                updatedAt: 1,
              },
            ],
          },
        ],
      }),
    );

    const result = await fetchHoldings();
    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0].code).toBe("7203");
    expect(result.updatedAt).toBe("2026-06-21T00:00:00.000Z");
  });

  it("my_stocks_items_v1 が無ければ空配列とnullのupdatedAtを返す（本当に0件の場合はエラーにしない）", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, { items: [] }));

    await expect(fetchHoldings()).resolves.toEqual({ holdings: [], updatedAt: null });
  });
});

describe("fetchEarnings", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("codes をカンマ区切りのクエリパラメータとして渡す（全銘柄を取りに行かないため必須）", async () => {
    const payload = {
      asOfDate: "2026-08-11",
      windowTo: "2026-09-30",
      earnings: {},
      lastEarnings: {},
      complete: true,
      missingMonths: [],
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, payload));

    await fetchEarnings(["7203", "6758"]);

    expect(fetch).toHaveBeenCalledWith("/api/stock-notes/earnings?codes=7203%2C6758", { method: "GET" });
  });

  it("失敗時はエラーを投げる（呼び出し側 load.ts でキャッチしてearnings:nullにする）", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(false, 502, { error: "boom" }));

    await expect(fetchEarnings(["7203"])).rejects.toThrow();
  });

  it("旧形式（lastEarningsが文字列）のキャッシュ済みレスポンスが来ても落ちずに正規化する（P1回帰防止）", async () => {
    const legacyPayload = {
      asOfDate: "2026-08-11",
      windowTo: "2026-09-30",
      earnings: {},
      lastEarnings: { "5401": "2026-08-04", "4063": "2026-07-24" },
      complete: true,
      missingMonths: [],
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, legacyPayload));

    const result = await fetchEarnings(["5401", "4063"]);
    expect(result.lastEarnings["5401"]).toEqual({ date: "2026-08-04", announcementType: "", publishStatus: "" });
    expect(result.lastEarnings["4063"]).toEqual({ date: "2026-07-24", announcementType: "", publishStatus: "" });
  });

  it("新形式（オブジェクト）はそのまま通す", async () => {
    const payload = {
      asOfDate: "2026-08-11",
      windowTo: "2026-09-30",
      earnings: {},
      lastEarnings: { "5401": { date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" } },
      complete: true,
      missingMonths: [],
    };
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(true, 200, payload));

    const result = await fetchEarnings(["5401"]);
    expect(result.lastEarnings["5401"]).toEqual({ date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" });
  });
});

describe("normalizeLastEarnings", () => {
  it("文字列（旧形式）はオブジェクトに変換する", () => {
    expect(normalizeLastEarnings({ "5401": "2026-08-04" })).toEqual({
      "5401": { date: "2026-08-04", announcementType: "", publishStatus: "" },
    });
  });

  it("既にオブジェクトならそのまま使う（欠けているフィールドは空文字で補う）", () => {
    expect(normalizeLastEarnings({ "5401": { date: "2026-08-04" } })).toEqual({
      "5401": { date: "2026-08-04", announcementType: "", publishStatus: "" },
    });
    expect(
      normalizeLastEarnings({ "5401": { date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" } }),
    ).toEqual({ "5401": { date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" } });
  });

  it("date が無い/文字列でないなど壊れた形は黙って無視する", () => {
    expect(normalizeLastEarnings({ a: { announcementType: "1Q" }, b: 123, c: null, d: undefined })).toEqual({});
  });

  it("null / undefined / オブジェクトでない場合は空オブジェクトを返す", () => {
    expect(normalizeLastEarnings(null)).toEqual({});
    expect(normalizeLastEarnings(undefined)).toEqual({});
    expect(normalizeLastEarnings("not-an-object")).toEqual({});
  });
});

describe("isSessionExpiredSupabaseError", () => {
  it("code が PGRST301（JWT expired）なら true", () => {
    expect(isSessionExpiredSupabaseError({ code: "PGRST301", message: "JWT expired" })).toBe(true);
  });

  it("code が無くても message に jwt expired が含まれれば true（codeが欠落する環境への保険）", () => {
    expect(isSessionExpiredSupabaseError({ message: "JWT expired" })).toBe(true);
    expect(isSessionExpiredSupabaseError({ message: "jwt expired for user" })).toBe(true);
  });

  it("RLSで単に対象行が無い/権限が無いだけの一般的なPostgrestErrorはセッション切れと判定しない", () => {
    expect(
      isSessionExpiredSupabaseError({
        code: "42501",
        message: "permission denied for table stock_notes_stocks",
      }),
    ).toBe(false);
  });

  it("エラーではない値（null/undefined/文字列/Error以外）はfalse", () => {
    expect(isSessionExpiredSupabaseError(null)).toBe(false);
    expect(isSessionExpiredSupabaseError(undefined)).toBe(false);
    expect(isSessionExpiredSupabaseError("boom")).toBe(false);
    expect(isSessionExpiredSupabaseError(new Error("network error"))).toBe(false);
  });
});

describe("isDuplicateStockError", () => {
  it("code が 23505（一意制約違反）なら true", () => {
    expect(isDuplicateStockError({ code: "23505", message: "duplicate key value" })).toBe(true);
  });

  it("code が無くても message に duplicate key が含まれれば true", () => {
    expect(isDuplicateStockError({ message: "duplicate key value violates unique constraint" })).toBe(true);
  });

  it("他のエラーコードは false", () => {
    expect(isDuplicateStockError({ code: "42501", message: "permission denied" })).toBe(false);
  });

  it("エラーではない値は false", () => {
    expect(isDuplicateStockError(null)).toBe(false);
    expect(isDuplicateStockError(undefined)).toBe(false);
  });
});

describe("isForeignKeyViolationError", () => {
  it("code が 23503（外部キー制約違反）なら true（分析が残る銘柄の削除をDBが拒否したケース）", () => {
    expect(
      isForeignKeyViolationError({
        code: "23503",
        message: 'update or delete on table "stock_notes_stocks" violates foreign key constraint',
      }),
    ).toBe(true);
  });

  it("code が無くても message に foreign key constraint が含まれれば true", () => {
    expect(isForeignKeyViolationError({ message: "violates foreign key constraint" })).toBe(true);
  });

  it("他のエラーコードは false", () => {
    expect(isForeignKeyViolationError({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(isForeignKeyViolationError({ code: "42501", message: "permission denied" })).toBe(false);
  });

  it("エラーではない値は false", () => {
    expect(isForeignKeyViolationError(null)).toBe(false);
    expect(isForeignKeyViolationError(undefined)).toBe(false);
  });
});

describe("insertStock", () => {
  it("user_id・code・name・category・category_changed_at を付けて insert し、camelCase化して返す", async () => {
    let capturedTable = "";
    let capturedValues: Record<string, unknown> = {};
    const supabase = makeSupabaseMock({
      insert: (table, values) => {
        capturedTable = table;
        capturedValues = values;
        return {
          data: {
            id: "new-id",
            code: values.code,
            name: values.name,
            category: values.category,
            category_changed_at: values.category_changed_at,
            category_change_reason: null,
            created_at: "2026-08-11T00:00:00.000Z",
            updated_at: "2026-08-11T00:00:00.000Z",
          },
          error: null,
        };
      },
    });

    const result = await insertStock(supabase, "user-1", { code: " 7203 ", name: " トヨタ自動車 ", category: "watch" });

    expect(capturedTable).toBe("stock_notes_stocks");
    expect(capturedValues.user_id).toBe("user-1");
    expect(capturedValues.code).toBe("7203");
    expect(capturedValues.name).toBe("トヨタ自動車");
    expect(capturedValues.category).toBe("watch");
    expect(typeof capturedValues.category_changed_at).toBe("string");
    expect(result).toMatchObject({ id: "new-id", code: "7203", name: "トヨタ自動車", category: "watch" });
  });

  it("エラー時は throw する", async () => {
    const supabase = makeSupabaseMock({
      insert: () => ({ data: null, error: { code: "23505", message: "duplicate key value" } }),
    });
    await expect(
      insertStock(supabase, "user-1", { code: "7203", name: "トヨタ自動車", category: "watch" }),
    ).rejects.toMatchObject({ code: "23505" });
  });
});

describe("updateStockCategory", () => {
  it("category と category_changed_at を更新する（reason省略時はcategory_change_reasonに触れない）", async () => {
    let captured: Record<string, unknown> = {};
    const supabase = makeSupabaseMock({
      update: (_table, values) => {
        captured = values;
        return { error: null };
      },
    });
    await updateStockCategory(supabase, "stock-1", "archived");
    expect(captured.category).toBe("archived");
    expect(typeof captured.category_changed_at).toBe("string");
    expect("category_change_reason" in captured).toBe(false);
  });

  it("reason を渡すと category_change_reason も更新する", async () => {
    let captured: Record<string, unknown> = {};
    const supabase = makeSupabaseMock({
      update: (_table, values) => {
        captured = values;
        return { error: null };
      },
    });
    await updateStockCategory(supabase, "stock-1", "archived", "決算後に一旦様子見");
    expect(captured.category_change_reason).toBe("決算後に一旦様子見");
  });

  it("エラー時は throw する", async () => {
    const supabase = makeSupabaseMock({ update: () => ({ error: new Error("boom") }) });
    await expect(updateStockCategory(supabase, "stock-1", "archived")).rejects.toThrow("boom");
  });
});

describe("deleteStockById", () => {
  it("成功時は何も返さない", async () => {
    const supabase = makeSupabaseMock({ delete: () => ({ error: null }) });
    await expect(deleteStockById(supabase, "stock-1")).resolves.toBeUndefined();
  });

  it("エラー時は throw する", async () => {
    const supabase = makeSupabaseMock({ delete: () => ({ error: new Error("boom") }) });
    await expect(deleteStockById(supabase, "stock-1")).rejects.toThrow("boom");
  });
});

describe("bulkInsertHoldingsAsStocks", () => {
  it("成功分は succeeded に、失敗分は failed に個別で入る（失敗があっても残りは続行する）", async () => {
    let callCount = 0;
    const supabase = makeSupabaseMock({
      insert: (_table, values) => {
        callCount += 1;
        if (values.code === "9999") {
          return { data: null, error: { code: "23505", message: "duplicate key value" } };
        }
        return {
          data: {
            id: `id-${values.code}`,
            code: values.code,
            name: values.name,
            category: values.category,
            category_changed_at: values.category_changed_at,
            category_change_reason: null,
            created_at: "",
            updated_at: "",
          },
          error: null,
        };
      },
    });

    const result = await bulkInsertHoldingsAsStocks(supabase, "user-1", [
      { code: "7203", name: "トヨタ自動車" },
      { code: "9999", name: "重複銘柄" },
    ]);

    expect(callCount).toBe(2);
    expect(result.succeeded).toEqual(["7203"]);
    expect(result.failed).toEqual([
      { code: "9999", name: "重複銘柄", message: "既に登録されています", duplicate: true },
    ]);
  });

  it("重複以外の失敗は duplicate:false で報告する（再取得要否の判定 shouldRefetchAfterBulkImport で使う）", async () => {
    const supabase = makeSupabaseMock({
      insert: () => ({ data: null, error: new Error("permission denied") }),
    });
    const result = await bulkInsertHoldingsAsStocks(supabase, "user-1", [{ code: "7203", name: "トヨタ自動車" }]);
    expect(result.failed).toEqual([
      { code: "7203", name: "トヨタ自動車", message: "permission denied", duplicate: false },
    ]);
  });

  it("全銘柄を category='holding' で登録する", async () => {
    const capturedCategories: unknown[] = [];
    const supabase = makeSupabaseMock({
      insert: (_table, values) => {
        capturedCategories.push(values.category);
        return {
          data: {
            id: "id",
            code: values.code,
            name: values.name,
            category: values.category,
            category_changed_at: values.category_changed_at,
            category_change_reason: null,
            created_at: "",
            updated_at: "",
          },
          error: null,
        };
      },
    });
    await bulkInsertHoldingsAsStocks(supabase, "user-1", [{ code: "7203", name: "トヨタ自動車" }]);
    expect(capturedCategories).toEqual(["holding"]);
  });
});
