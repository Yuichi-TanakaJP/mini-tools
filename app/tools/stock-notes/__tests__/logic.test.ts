import { describe, expect, it } from "vitest";
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import {
  FRESHNESS_DANGER_DAYS,
  FRESHNESS_WARN_DAYS,
  SYNC_STALE_DAYS,
  analysesForStock,
  buildAnalysisPrompt,
  computeUnanalyzedHoldings,
  countHoldingTabItems,
  createLoadGuard,
  daysSinceEarnings,
  daysSinceSync,
  daysUntil,
  freshnessLevel,
  freshnessLevelWithEarnings,
  isEarningsSoon,
  isOverdue,
  latestAnalyzedAt,
  selectLatestThesis,
  sortOpenActions,
  sortUnanalyzedHoldingsByEarnings,
  syncStaleness,
} from "../logic";
import type { StockNoteAction, StockNoteAnalysis, StockNoteStock, StockNoteThesis } from "../types";

function makeHolding(overrides: Partial<MyStockItem>): MyStockItem {
  return {
    id: overrides.id ?? "id",
    code: overrides.code ?? "0000",
    name: overrides.name ?? "テスト銘柄",
    market: "プライム",
    sector: null,
    tab: overrides.tab ?? "holding",
    accountType: overrides.accountType,
    accountLabel: overrides.accountLabel,
    quantity: overrides.quantity,
    acquisitionPrice: overrides.acquisitionPrice,
    memo: "",
    addedAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeStock(overrides: Partial<StockNoteStock>): StockNoteStock {
  return {
    id: overrides.id ?? "stock-1",
    code: overrides.code ?? "0000",
    name: overrides.name ?? "テスト銘柄",
    category: overrides.category ?? "holding",
    categoryChangedAt: null,
    categoryChangeReason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<StockNoteAnalysis>): StockNoteAnalysis {
  return {
    id: overrides.id ?? "analysis-1",
    stockId: overrides.stockId ?? "stock-1",
    analysisType: overrides.analysisType ?? "other",
    conclusion: null,
    evidence: null,
    concerns: null,
    source: null,
    sourceUrl: null,
    analyzedAt: overrides.analyzedAt ?? "2026-01-01T00:00:00.000Z",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeThesis(overrides: Partial<StockNoteThesis>): StockNoteThesis {
  return {
    id: overrides.id ?? "thesis-1",
    stockId: overrides.stockId ?? "stock-1",
    view: overrides.view ?? "neutral",
    confidence: overrides.confidence ?? "medium",
    thesis: [],
    risks: [],
    nextCheck: [],
    buyMoreCondition: null,
    exitCondition: null,
    asOf: overrides.asOf ?? "2026-01-01",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAction(overrides: Partial<StockNoteAction>): StockNoteAction {
  return {
    id: overrides.id ?? "action-1",
    stockId: overrides.stockId ?? "stock-1",
    actionType: overrides.actionType ?? "other",
    title: overrides.title ?? "アクション",
    detail: null,
    triggerCondition: null,
    dueDate: overrides.dueDate ?? null,
    status: overrides.status ?? "open",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("freshnessLevel", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");

  it("分析が無ければ unknown", () => {
    expect(freshnessLevel(null, now)).toBe("unknown");
    expect(freshnessLevel(undefined, now)).toBe("unknown");
  });

  it(`${FRESHNESS_WARN_DAYS}日以内は fresh`, () => {
    const recent = new Date(now.getTime() - (FRESHNESS_WARN_DAYS - 1) * 86400000).toISOString();
    expect(freshnessLevel(recent, now)).toBe("fresh");
  });

  it(`${FRESHNESS_WARN_DAYS}日超 ${FRESHNESS_DANGER_DAYS}日以内は warn`, () => {
    const mid = new Date(now.getTime() - (FRESHNESS_WARN_DAYS + 1) * 86400000).toISOString();
    expect(freshnessLevel(mid, now)).toBe("warn");
  });

  it(`${FRESHNESS_DANGER_DAYS}日超は danger`, () => {
    const old = new Date(now.getTime() - (FRESHNESS_DANGER_DAYS + 1) * 86400000).toISOString();
    expect(freshnessLevel(old, now)).toBe("danger");
  });

  it("不正な日付は unknown", () => {
    expect(freshnessLevel("not-a-date", now)).toBe("unknown");
  });
});

describe("freshnessLevelWithEarnings", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");

  it("決算日が判明していなければ経過日数のみで判定する（従来どおり）", () => {
    const recent = new Date(now.getTime() - 10 * 86400000).toISOString();
    expect(freshnessLevelWithEarnings(recent, null, now)).toBe("fresh");
    const old = new Date(now.getTime() - (FRESHNESS_DANGER_DAYS + 1) * 86400000).toISOString();
    expect(freshnessLevelWithEarnings(old, null, now)).toBe("danger");
  });

  it("最終分析日より後に決算があれば post-earnings（経過日数に関係なく）", () => {
    const lastAnalyzedAt = "2026-08-01T00:00:00.000Z";
    const lastEarningsDate = "2026-08-05"; // 分析より後
    expect(freshnessLevelWithEarnings(lastAnalyzedAt, lastEarningsDate, now)).toBe("post-earnings");
  });

  it("最終分析日より前の決算なら post-earnings にならない（経過日数どおり）", () => {
    const lastAnalyzedAt = "2026-08-05T00:00:00.000Z";
    const lastEarningsDate = "2026-08-01"; // 分析より前
    expect(freshnessLevelWithEarnings(lastAnalyzedAt, lastEarningsDate, now)).toBe("fresh");
  });

  it("分析が0件なら unknown", () => {
    expect(freshnessLevelWithEarnings(null, "2026-08-05", now)).toBe("unknown");
  });

  describe("JST境界（決算日のカットオフはUTCではなくJSTでなければならない）", () => {
    const laterNow = new Date("2026-09-01T00:00:00.000Z"); // 判定対象より十分後

    it("決算日の翌日0:00 JSTの分析は post-earnings にならない（決算後の分析として扱う）", () => {
      // 2026-08-05 決算。分析は 2026-08-06 00:00:00 JST = 2026-08-05T15:00:00.000Z
      const lastAnalyzedAt = "2026-08-05T15:00:00.000Z";
      expect(freshnessLevelWithEarnings(lastAnalyzedAt, "2026-08-05", laterNow)).not.toBe("post-earnings");
    });

    it("決算日当日23:00 JSTの分析は post-earnings になる（決算日のうちに決算をまたいだとみなす）", () => {
      // 2026-08-05 決算。分析は 2026-08-05 23:00:00 JST = 2026-08-05T14:00:00.000Z
      const lastAnalyzedAt = "2026-08-05T14:00:00.000Z";
      expect(freshnessLevelWithEarnings(lastAnalyzedAt, "2026-08-05", laterNow)).toBe("post-earnings");
    });
  });
});

describe("sortUnanalyzedHoldingsByEarnings", () => {
  it("決算日が判明している銘柄を先頭に日付昇順で並べる", () => {
    const holdings = [
      { code: "1111", name: "A", quantity: null },
      { code: "2222", name: "B", quantity: null },
      { code: "3333", name: "C", quantity: null },
    ];
    const earnings = {
      "3333": { date: "2026-08-20" },
      "1111": { date: "2026-08-14" },
    };
    const result = sortUnanalyzedHoldingsByEarnings(holdings, earnings);
    expect(result.map((h) => h.code)).toEqual(["1111", "3333", "2222"]);
  });

  it("未判明の銘柄同士はコード順で並べる", () => {
    const holdings = [
      { code: "9999", name: "Z", quantity: null },
      { code: "1111", name: "A", quantity: null },
    ];
    const result = sortUnanalyzedHoldingsByEarnings(holdings, {});
    expect(result.map((h) => h.code)).toEqual(["1111", "9999"]);
  });
});

describe("daysUntil / isEarningsSoon", () => {
  const now = new Date("2026-08-11T02:00:00.000Z"); // JST 2026-08-11 11:00

  it("同日なら0", () => {
    expect(daysUntil("2026-08-11", now)).toBe(0);
  });

  it("未来日は正の日数", () => {
    expect(daysUntil("2026-08-14", now)).toBe(3);
  });

  it("過去日は負の日数", () => {
    expect(daysUntil("2026-08-08", now)).toBe(-3);
  });

  it("3日以内（当日含む）は isEarningsSoon が true", () => {
    expect(isEarningsSoon("2026-08-11", now)).toBe(true);
    expect(isEarningsSoon("2026-08-14", now)).toBe(true);
    expect(isEarningsSoon("2026-08-15", now)).toBe(false);
  });

  it("過去日は isEarningsSoon が false", () => {
    expect(isEarningsSoon("2026-08-10", now)).toBe(false);
  });
});

describe("daysSinceEarnings", () => {
  const now = new Date("2026-08-11T02:00:00.000Z"); // JST 2026-08-11 11:00

  it("当日なら0", () => {
    expect(daysSinceEarnings("2026-08-11", now)).toBe(0);
  });

  it("過去日は経過日数（正の値）を返す", () => {
    expect(daysSinceEarnings("2026-08-04", now)).toBe(7);
  });

  it("未来日を渡した場合は安全側で0に丸める", () => {
    expect(daysSinceEarnings("2026-08-14", now)).toBe(0);
  });

  describe("JST境界（日付だけで判定し、時差でずれないこと）", () => {
    it("JST日付の変わり目をまたいでも経過日数がずれない", () => {
      // JST 2026-08-11 00:30 = UTC 2026-08-10T15:30:00.000Z
      const jstJustAfterMidnight = new Date("2026-08-10T15:30:00.000Z");
      expect(daysSinceEarnings("2026-08-04", jstJustAfterMidnight)).toBe(7);
    });
  });
});

describe("syncStaleness / daysSinceSync", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");

  it(`${SYNC_STALE_DAYS}日未満は fresh`, () => {
    const recent = new Date(now.getTime() - (SYNC_STALE_DAYS - 1) * 86400000).toISOString();
    expect(syncStaleness(recent, now)).toBe("fresh");
  });

  it(`${SYNC_STALE_DAYS}日以上は stale`, () => {
    const old = new Date(now.getTime() - SYNC_STALE_DAYS * 86400000).toISOString();
    expect(syncStaleness(old, now)).toBe("stale");
  });

  it("updatedAt が無ければ unknown（stale=「30日以上前」と混同しない）", () => {
    expect(syncStaleness(null, now)).toBe("unknown");
    expect(syncStaleness(undefined, now)).toBe("unknown");
  });

  it("updatedAt が不正な値でも unknown", () => {
    expect(syncStaleness("not-a-date", now)).toBe("unknown");
  });

  it("daysSinceSync は経過日数を返す", () => {
    const updatedAt = new Date(now.getTime() - 52 * 86400000).toISOString();
    expect(daysSinceSync(updatedAt, now)).toBe(52);
  });

  it("updatedAt が無ければ daysSinceSync は null", () => {
    expect(daysSinceSync(null, now)).toBeNull();
  });
});

describe("computeUnanalyzedHoldings", () => {
  it("stock_notes に無い保有銘柄を抽出する", () => {
    const holdings = [makeHolding({ code: "7203", name: "トヨタ自動車", quantity: 100 })];
    const result = computeUnanalyzedHoldings(holdings, [], []);
    expect(result).toEqual([{ code: "7203", name: "トヨタ自動車", quantity: 100 }]);
  });

  it("stock_notes にあるが分析が0件の保有銘柄を抽出する", () => {
    const holdings = [makeHolding({ code: "7203", name: "トヨタ自動車", quantity: 100 })];
    const stocks = [makeStock({ id: "s1", code: "7203" })];
    const result = computeUnanalyzedHoldings(holdings, stocks, []);
    expect(result).toEqual([{ code: "7203", name: "トヨタ自動車", quantity: 100 }]);
  });

  it("分析が1件以上あれば除外する", () => {
    const holdings = [makeHolding({ code: "7203", name: "トヨタ自動車", quantity: 100 })];
    const stocks = [makeStock({ id: "s1", code: "7203" })];
    const analyses = [makeAnalysis({ stockId: "s1" })];
    const result = computeUnanalyzedHoldings(holdings, stocks, analyses);
    expect(result).toEqual([]);
  });

  it("watch タブは対象外", () => {
    const holdings = [makeHolding({ code: "9999", tab: "watch" })];
    expect(computeUnanalyzedHoldings(holdings, [], [])).toEqual([]);
  });

  it("同一銘柄が複数口座にあっても1件に集約する", () => {
    const holdings = [
      makeHolding({ id: "a", code: "7203", name: "トヨタ自動車", quantity: 100, accountType: "specific" }),
      makeHolding({ id: "b", code: "7203", name: "トヨタ自動車", quantity: 200, accountType: "nisa-growth" }),
    ];
    const result = computeUnanalyzedHoldings(holdings, [], []);
    expect(result).toHaveLength(1);
  });

  it("コード順にソートする", () => {
    const holdings = [
      makeHolding({ code: "9999", name: "Z" }),
      makeHolding({ code: "1111", name: "A" }),
    ];
    const result = computeUnanalyzedHoldings(holdings, [], []);
    expect(result.map((r) => r.code)).toEqual(["1111", "9999"]);
  });
});

describe("buildAnalysisPrompt", () => {
  it("コードと銘柄名を含む日本語プロンプトを作る", () => {
    expect(buildAnalysisPrompt("7203", "トヨタ自動車")).toBe(
      "7203 トヨタ自動車について、直近の決算と現在の投資判断を整理して",
    );
  });
});

describe("selectLatestThesis", () => {
  it("as_of の降順で最新を選ぶ（created_at 順ではない）", () => {
    const theses = [
      makeThesis({ id: "old-created-but-new-asof", stockId: "s1", asOf: "2026-08-01", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeThesis({ id: "new-created-but-old-asof", stockId: "s1", asOf: "2026-02-01", createdAt: "2026-08-01T00:00:00.000Z" }),
    ];
    const latest = selectLatestThesis(theses, "s1");
    expect(latest?.id).toBe("old-created-but-new-asof");
  });

  it("該当が無ければ null", () => {
    expect(selectLatestThesis([], "s1")).toBeNull();
  });

  it("as_of が同値なら created_at が新しい方", () => {
    const theses = [
      makeThesis({ id: "a", stockId: "s1", asOf: "2026-08-01", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeThesis({ id: "b", stockId: "s1", asOf: "2026-08-01", createdAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(selectLatestThesis(theses, "s1")?.id).toBe("b");
  });
});

describe("analysesForStock / latestAnalyzedAt", () => {
  it("新しい順に並べる", () => {
    const analyses = [
      makeAnalysis({ id: "old", stockId: "s1", analyzedAt: "2026-01-01T00:00:00.000Z" }),
      makeAnalysis({ id: "new", stockId: "s1", analyzedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(analysesForStock(analyses, "s1").map((a) => a.id)).toEqual(["new", "old"]);
    expect(latestAnalyzedAt(analyses, "s1")).toBe("2026-06-01T00:00:00.000Z");
  });

  it("分析が無ければ null", () => {
    expect(latestAnalyzedAt([], "s1")).toBeNull();
  });
});

describe("sortOpenActions", () => {
  it("期限昇順で並べ、done/dismissed は除外する", () => {
    const actions = [
      makeAction({ id: "b", dueDate: "2026-09-01", status: "open" }),
      makeAction({ id: "a", dueDate: "2026-08-01", status: "open" }),
      makeAction({ id: "done", dueDate: "2026-01-01", status: "done" }),
    ];
    expect(sortOpenActions(actions).map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("期限未設定は末尾に回す", () => {
    const actions = [
      makeAction({ id: "no-due", dueDate: null, createdAt: "2026-01-01T00:00:00.000Z" }),
      makeAction({ id: "has-due", dueDate: "2026-12-31" }),
    ];
    expect(sortOpenActions(actions).map((a) => a.id)).toEqual(["has-due", "no-due"]);
  });
});

describe("isOverdue", () => {
  it("期限日が過去なら true", () => {
    expect(isOverdue("2020-01-01", new Date("2026-01-01"))).toBe(true);
  });
  it("期限日が未来なら false", () => {
    expect(isOverdue("2030-01-01", new Date("2026-01-01"))).toBe(false);
  });
  it("期限未設定なら false", () => {
    expect(isOverdue(null)).toBe(false);
  });
});

describe("countHoldingTabItems", () => {
  it("tab='holding' の件数だけを数える", () => {
    const holdings = [
      makeHolding({ code: "1111", tab: "holding" }),
      makeHolding({ code: "2222", tab: "holding" }),
      makeHolding({ code: "3333", tab: "watch" }),
    ];
    expect(countHoldingTabItems(holdings)).toBe(2);
  });

  it("ウォッチのみの場合は0になる（holdings.length は1以上でも0件と判定できる）", () => {
    const holdings = [makeHolding({ code: "9999", tab: "watch" })];
    expect(holdings.length).toBeGreaterThan(0);
    expect(countHoldingTabItems(holdings)).toBe(0);
  });

  it("空配列なら0", () => {
    expect(countHoldingTabItems([])).toBe(0);
  });
});

describe("createLoadGuard", () => {
  it("最新のトークンだけ isCurrent が true になる", () => {
    const guard = createLoadGuard();
    const token1 = guard.next();
    expect(guard.isCurrent(token1)).toBe(true);

    const token2 = guard.next();
    // token1 は古い世代になったので、その結果は破棄されるべき
    expect(guard.isCurrent(token1)).toBe(false);
    expect(guard.isCurrent(token2)).toBe(true);
  });

  it("invalidate() すると進行中のトークンも古い扱いになる（新しい世代は発行しない）", () => {
    const guard = createLoadGuard();
    const token1 = guard.next();
    guard.invalidate();
    expect(guard.isCurrent(token1)).toBe(false);

    // invalidate 後に next() すれば新しい世代は改めて current になる
    const token2 = guard.next();
    expect(guard.isCurrent(token2)).toBe(true);
  });

  it("同じトークンで2回 isCurrent を呼んでも状態は変わらない（副作用なし）", () => {
    const guard = createLoadGuard();
    const token = guard.next();
    expect(guard.isCurrent(token)).toBe(true);
    expect(guard.isCurrent(token)).toBe(true);
  });
});
