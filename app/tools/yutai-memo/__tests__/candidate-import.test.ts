import { describe, expect, it } from "vitest";
import { createMemoItemFromCandidate } from "../candidate-import";

describe("createMemoItemFromCandidate", () => {
  it("カレンダーで設定した仕込み開始をメモへ引き継ぐ", () => {
    const item = createMemoItemFromCandidate({
      code: "1234",
      companyName: "テスト会社",
      month: 9,
      preparationMonthsBefore: 3,
      minkabuYutaiUrl: "https://example.com/yutai",
    });

    expect(item.preparationMonthsBefore).toBe(3);
  });
});
