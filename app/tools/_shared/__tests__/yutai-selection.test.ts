import { describe, expect, it } from "vitest";
import type { MemoItem } from "@/app/tools/yutai-memo/types";
import { getAddedKeysFromMemoItems, getCardMemoKey, loadCardMemos, loadCodeSet } from "../yutai-selection";

function memoItem(overrides: Partial<MemoItem> = {}): MemoItem {
  return {
    id: "id-1",
    name: "テスト銘柄",
    createdAt: "2026-07-01T00:00:00.000Z",
    months: [3],
    tagIds: [],
    crossType: "長期優遇なし",
    acquired: false,
    priority: 2,
    memo: "",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getCardMemoKey", () => {
  it("code:month 形式のキーを返す", () => {
    expect(getCardMemoKey({ code: "9861", month: 8 })).toBe("9861:8");
  });
});

describe("getAddedKeysFromMemoItems", () => {
  it("各メモの権利月ごとにキーを作る", () => {
    const keys = getAddedKeysFromMemoItems([
      memoItem({ id: "a", code: "9861", months: [2, 8] }),
      memoItem({ id: "b", code: undefined, months: [3] }),
    ]);
    expect(keys).toEqual(new Set(["9861:2", "9861:8", ":3"]));
  });

  it("months が欠けた旧データでも落ちない", () => {
    const legacy = memoItem({ id: "c", code: "1234" });
    delete (legacy as { months?: number[] }).months;
    expect(getAddedKeysFromMemoItems([legacy])).toEqual(new Set());
  });
});

describe("SSR ガード", () => {
  it("window がない環境では空値を返す", () => {
    expect(loadCodeSet("monthly_yutai_picks_v1")).toEqual(new Set());
    expect(loadCardMemos()).toEqual({});
  });
});
