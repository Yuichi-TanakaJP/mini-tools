import { describe, expect, it } from "vitest";
import { mergeStockNotesDelta, parseStockNotesDelta, type StockNotesDelta } from "../delta";
import type { DashboardData } from "../load";

const base: DashboardData = {
  stocks: [
    {
      id: "s1",
      code: "7203",
      name: "旧トヨタ",
      category: "holding",
      categoryChangedAt: null,
      categoryChangeReason: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "s2",
      code: "6758",
      name: "ソニー",
      category: "watch",
      categoryChangedAt: null,
      categoryChangeReason: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  analyses: [
    {
      id: "a1",
      stockId: "s1",
      analysisType: "initial",
      conclusion: "旧結論",
      evidence: null,
      concerns: null,
      source: "chatgpt",
      sourceUrl: null,
      analyzedAt: "2026-08-01T00:00:00.000Z",
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  theses: [],
  actions: [],
  holdings: [],
  holdingsUpdatedAt: null,
  earnings: null,
};

const replacement = {
  stock: { ...base.stocks[0], name: "新トヨタ", updatedAt: "2026-08-13T00:00:00.000Z" },
  analyses: [{ ...base.analyses[0], conclusion: "新結論" }],
  theses: [],
  actions: [],
  revision: "rev-s1",
};

function delta(overrides: Partial<StockNotesDelta> = {}): StockNotesDelta {
  return {
    version: 1,
    complete: true,
    currentManifest: { s1: "rev-s1", s2: "rev-s2" },
    changedStocks: [replacement],
    deletedStockIds: [],
    ...overrides,
  };
}

describe("stock-notes delta", () => {
  it("変更銘柄だけを置き換え、変更のない銘柄を維持する", () => {
    const result = mergeStockNotesDelta(base, delta(), false);

    expect(result.stocks.find((stock) => stock.id === "s1")?.name).toBe("新トヨタ");
    expect(result.stocks.find((stock) => stock.id === "s2")?.name).toBe("ソニー");
    expect(result.analyses.find((analysis) => analysis.id === "a1")?.conclusion).toBe("新結論");
  });

  it("完全なmanifestで消えた銘柄と子データを取り除く", () => {
    const result = mergeStockNotesDelta(
      base,
      delta({ currentManifest: { s1: "rev-s1" }, deletedStockIds: ["s2"] }),
      false,
    );

    expect(result.stocks.map((stock) => stock.id)).toEqual(["s1"]);
    expect(result.analyses.every((analysis) => analysis.stockId === "s1")).toBe(true);
  });

  it("manifest無しの旧キャッシュからはサーバーの全スナップショットへ置き換える", () => {
    const result = mergeStockNotesDelta(
      base,
      delta({ currentManifest: { s1: "rev-s1" }, deletedStockIds: [] }),
      true,
    );

    expect(result.stocks.map((stock) => stock.id)).toEqual(["s1"]);
    expect(result.stocks[0].name).toBe("新トヨタ");
  });

  it("不完全なレスポンスを受け付けない", () => {
    expect(() => parseStockNotesDelta({ version: 1, complete: false })).toThrow();
  });

  it("manifestにない変更銘柄を受け付けない", () => {
    expect(() =>
      parseStockNotesDelta({
        ...delta(),
        currentManifest: { s2: "rev-s2" },
      }),
    ).toThrow();
  });

  it("manifestに残っている銘柄を削除一覧に入れない", () => {
    expect(() => parseStockNotesDelta(delta({ deletedStockIds: ["s1"] }))).toThrow();
  });
});
