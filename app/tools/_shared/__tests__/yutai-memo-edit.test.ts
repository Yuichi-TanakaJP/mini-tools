import { describe, expect, it } from "vitest";
import type { MemoItem } from "@/app/tools/yutai-memo/types";
import { applyMemoEdit, buildMemoEditDraft } from "../yutai-memo-edit";

function memoItem(overrides: Partial<MemoItem> = {}): MemoItem {
  return {
    id: "id-1",
    name: "テスト銘柄",
    code: "1234",
    createdAt: "2026-07-01T00:00:00.000Z",
    months: [3],
    tagIds: [],
    crossType: "長期優遇なし",
    acquired: false,
    priority: 2,
    memo: "元メモ",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildMemoEditDraft", () => {
  it("未設定の任意項目は空文字に落とす", () => {
    const draft = buildMemoEditDraft(memoItem({ preparationMonthsBefore: undefined, oneShareStartedAt: undefined }));
    expect(draft.preparationMonthsBefore).toBe("");
    expect(draft.oneShareStartedAt).toBe("");
    expect(draft.entryTiming).toBe("");
  });

  it("設定済み項目はそのまま渡す", () => {
    const draft = buildMemoEditDraft(
      memoItem({ preparationMonthsBefore: 3, oneShareStartedAt: "2025-06", crossType: "連続クロス", priority: 1 }),
    );
    expect(draft.preparationMonthsBefore).toBe(3);
    expect(draft.oneShareStartedAt).toBe("2025-06");
    expect(draft.crossType).toBe("連続クロス");
    expect(draft.priority).toBe(1);
  });
});

describe("applyMemoEdit", () => {
  const now = "2026-07-06T00:00:00.000Z";

  it("id 一致の項目だけ更新し updatedAt を差し替える", () => {
    const items = [memoItem({ id: "a" }), memoItem({ id: "b" })];
    const { items: next, updated } = applyMemoEdit(
      items,
      "b",
      { ...buildMemoEditDraft(items[1]), crossType: "先行クロス", memo: "更新" },
      now,
    );
    expect(updated).toBe(true);
    expect(next[0]).toBe(items[0]);
    expect(next[1].crossType).toBe("先行クロス");
    expect(next[1].memo).toBe("更新");
    expect(next[1].updatedAt).toBe(now);
  });

  it("空文字は undefined に正規化する", () => {
    const items = [memoItem({ id: "a", preparationMonthsBefore: 3, oneShareStartedAt: "2025-06", entryTiming: "前月" })];
    const { items: next } = applyMemoEdit(
      items,
      "a",
      { ...buildMemoEditDraft(items[0]), preparationMonthsBefore: "", oneShareStartedAt: "", entryTiming: "  " },
      now,
    );
    expect(next[0].preparationMonthsBefore).toBeUndefined();
    expect(next[0].oneShareStartedAt).toBeUndefined();
    expect(next[0].entryTiming).toBeUndefined();
  });

  it("name が空なら元の名前を維持する", () => {
    const items = [memoItem({ id: "a", name: "元名称" })];
    const { items: next } = applyMemoEdit(items, "a", { ...buildMemoEditDraft(items[0]), name: "   " }, now);
    expect(next[0].name).toBe("元名称");
  });

  it("該当 id がなければ updated=false", () => {
    const items = [memoItem({ id: "a" })];
    const { items: next, updated } = applyMemoEdit(items, "zzz", buildMemoEditDraft(items[0]), now);
    expect(updated).toBe(false);
    expect(next).toEqual(items);
  });
});
