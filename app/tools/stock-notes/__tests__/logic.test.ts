import { describe, expect, it } from "vitest";
import type { MyStockItem } from "@/app/tools/my-stocks/types";
import type { StockNotesEarningsInfo } from "../earnings-types";
import {
  ACTION_DUE_SOON_DAYS,
  FRESHNESS_DANGER_DAYS,
  FRESHNESS_WARN_DAYS,
  STOCK_NOTES_TABS,
  SYNC_STALE_DAYS,
  analysesForStock,
  buildAnalysisPrompt,
  buildRevalidateFailureMessage,
  canDeleteStock,
  computeActionRequiredStocks,
  computeUnanalyzedHoldings,
  countHoldingTabItems,
  countStocksForTab,
  createLoadGuard,
  daysSinceEarnings,
  daysSinceSync,
  daysUntil,
  deleteBlockedReason,
  earningsDisplay,
  extractUnregisteredHoldings,
  formatClockTime,
  formatMonthDay,
  freshnessLevel,
  freshnessLevelWithEarnings,
  hasUrgentOpenAction,
  isCodeAlreadyRegistered,
  isEarningsSoon,
  isOverdue,
  lastEarningsDisplay,
  latestAnalyzedAt,
  selectLatestThesis,
  shouldRefetchAfterBulkImport,
  sortActionRequiredStocks,
  sortOpenActions,
  sortStocksByLastAnalyzedAsc,
  sortUnanalyzedHoldingsByEarnings,
  stocksForTab,
  syncStaleness,
  validateNewStockInput,
  withFallback,
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

  describe("不正な日付（外部JSONの壊れたデータ想定、P2/P3対応）", () => {
    it("daysUntil は不正な日付文字列に対して null を返す（NaNにしない）", () => {
      expect(daysUntil("not-a-date", now)).toBeNull();
      expect(daysUntil("", now)).toBeNull();
      expect(daysUntil("2026-13-99", now)).toBeNull();
    });

    it("isEarningsSoon は不正な日付に対して false を返す", () => {
      expect(isEarningsSoon("not-a-date", now)).toBe(false);
    });
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

  it("不正な日付文字列は null を返す（NaN日前と表示させない）", () => {
    expect(daysSinceEarnings("not-a-date", now)).toBeNull();
  });

  describe("JST境界（日付だけで判定し、時差でずれないこと）", () => {
    it("JST日付の変わり目をまたいでも経過日数がずれない", () => {
      // JST 2026-08-11 00:30 = UTC 2026-08-10T15:30:00.000Z
      const jstJustAfterMidnight = new Date("2026-08-10T15:30:00.000Z");
      expect(daysSinceEarnings("2026-08-04", jstJustAfterMidnight)).toBe(7);
    });
  });
});

describe("formatMonthDay", () => {
  it("YYYY-MM-DD を M/D に変換する", () => {
    expect(formatMonthDay("2026-08-04")).toBe("8/4");
    expect(formatMonthDay("2026-01-09")).toBe("1/9");
  });

  it("不正な形式は日付を捏造せず (日付不明) を返す", () => {
    expect(formatMonthDay("not-a-date")).toBe("(日付不明)");
    expect(formatMonthDay("")).toBe("(日付不明)");
    expect(formatMonthDay(null)).toBe("(日付不明)");
    expect(formatMonthDay(undefined)).toBe("(日付不明)");
  });
});

function makeEarningsInfo(overrides: Partial<StockNotesEarningsInfo>): StockNotesEarningsInfo {
  return {
    asOfDate: "2026-08-11",
    windowTo: "2026-09-30",
    earnings: {},
    lastEarnings: {},
    complete: true,
    missingMonths: [],
    ...overrides,
  };
}

describe("earningsDisplay", () => {
  const now = new Date("2026-08-11T02:00:00.000Z"); // JST 2026-08-11 11:00

  it("earnings が null なら取得失敗の文言", () => {
    expect(earningsDisplay("5401", null, now)).toEqual({
      text: "決算情報を取得できませんでした",
      soon: false,
      failed: true,
    });
  });

  it("予定が見つかれば日付と残り日数を表示する", () => {
    const earnings = makeEarningsInfo({
      earnings: { "7433": { date: "2026-08-12", announcementType: "1Q", publishStatus: "予定" } },
    });
    expect(earningsDisplay("7433", earnings, now)).toEqual({
      text: "次回決算 8/12（あと1日）",
      soon: true,
      failed: false,
    });
  });

  it("予定が見つからず complete なら「未判明」（windowToを反映）", () => {
    const earnings = makeEarningsInfo({ earnings: {} });
    expect(earningsDisplay("5401", earnings, now)).toEqual({
      text: "次回決算 未判明（カレンダーは9/30まで）",
      soon: false,
      failed: false,
    });
  });

  it("予定が見つからず complete:false なら「未判明」ではなく取得失敗寄りの文言", () => {
    const earnings = makeEarningsInfo({ earnings: {}, complete: false });
    expect(earningsDisplay("5401", earnings, now)).toEqual({
      text: "決算情報を取得できませんでした（一部期間が未取得）",
      soon: false,
      failed: true,
    });
  });

  it("次回決算の日付が不正でもクラッシュせず、日数部分だけ省く（P3対応）", () => {
    const earnings = makeEarningsInfo({
      earnings: { "7433": { date: "not-a-date", announcementType: "1Q", publishStatus: "予定" } },
    });
    const result = earningsDisplay("7433", earnings, now);
    expect(result.text).toBe("次回決算 (日付不明)");
    expect(result.soon).toBe(false);
  });
});

describe("lastEarningsDisplay", () => {
  const now = new Date("2026-08-11T02:00:00.000Z"); // JST 2026-08-11 11:00

  it("lastEarnings にキーが無ければ null（行を出さない）", () => {
    expect(lastEarningsDisplay("5401", makeEarningsInfo({}), false, now)).toBeNull();
    expect(lastEarningsDisplay("5401", null, false, now)).toBeNull();
  });

  it("emphasize=false（次回決算が判明）は区分のみ、経過日数を付けない", () => {
    const earnings = makeEarningsInfo({
      lastEarnings: { "4063": { date: "2026-07-24", announcementType: "1Q", publishStatus: "発表済" } },
    });
    expect(lastEarningsDisplay("4063", earnings, false, now)).toBe("前回決算 7/24（1Q）");
  });

  it("emphasize=true（次回決算が未判明）は経過日数を付けて目立たせる", () => {
    const earnings = makeEarningsInfo({
      lastEarnings: { "5401": { date: "2026-08-04", announcementType: "1Q", publishStatus: "予定" } },
    });
    expect(lastEarningsDisplay("5401", earnings, true, now)).toBe("前回決算 8/4（1Q・7日前）");
  });

  it("complete:false のときは一部期間が未取得のため不確実という注記を添える（P2対応）", () => {
    const earnings = makeEarningsInfo({
      lastEarnings: { "4063": { date: "2026-07-24", announcementType: "1Q", publishStatus: "発表済" } },
      complete: false,
    });
    expect(lastEarningsDisplay("4063", earnings, false, now)).toBe(
      "前回決算 7/24（1Q・一部期間が未取得のため不確実）",
    );
    expect(lastEarningsDisplay("4063", earnings, true, now)).toBe(
      "前回決算 7/24（1Q・18日前・一部期間が未取得のため不確実）",
    );
  });

  it("旧形式からの正規化で announcementType が空文字になっても区分無しで表示する（クラッシュしない）", () => {
    const earnings = makeEarningsInfo({
      lastEarnings: { "5401": { date: "2026-08-04", announcementType: "", publishStatus: "" } },
    });
    expect(lastEarningsDisplay("5401", earnings, false, now)).toBe("前回決算 8/4");
  });

  it("決算日が不正でもクラッシュしない（P3対応）", () => {
    const earnings = makeEarningsInfo({
      lastEarnings: { "5401": { date: "not-a-date", announcementType: "1Q", publishStatus: "予定" } },
    });
    expect(lastEarningsDisplay("5401", earnings, true, now)).toBe("前回決算 (日付不明)（1Q）");
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

  it("current() は世代を進めずに現在のトークンを読める（peek）", () => {
    const guard = createLoadGuard();
    expect(guard.current()).toBe(0);
    const token1 = guard.next();
    expect(guard.current()).toBe(token1);
    // current() を何度呼んでも世代は変わらない
    expect(guard.current()).toBe(token1);
    expect(guard.isCurrent(token1)).toBe(true);
  });
});

describe("formatClockTime", () => {
  it("ISO文字列をJSTのHH:MMに変換する", () => {
    // 2026-08-11T03:05:00Z は JST 12:05
    expect(formatClockTime("2026-08-11T03:05:00.000Z")).toBe("12:05");
  });

  it("null/undefinedはnull", () => {
    expect(formatClockTime(null)).toBeNull();
    expect(formatClockTime(undefined)).toBeNull();
  });

  it("不正な日付文字列はnull", () => {
    expect(formatClockTime("not-a-date")).toBeNull();
  });
});

describe("buildRevalidateFailureMessage", () => {
  it("fetchedAtがあれば時刻入りの案内文になる", () => {
    // 2026-08-11T03:05:00Z は JST 12:05
    expect(buildRevalidateFailureMessage("2026-08-11T03:05:00.000Z")).toBe(
      "最新の取得に失敗しました（表示は12:05時点）。",
    );
  });

  it("fetchedAtが無ければ時刻を省いた案内文になる", () => {
    expect(buildRevalidateFailureMessage(null)).toBe("最新の取得に失敗しました。");
    expect(buildRevalidateFailureMessage(undefined)).toBe("最新の取得に失敗しました。");
  });

  it("fetchedAtが不正な値でも時刻を省いた案内文にフォールバックする", () => {
    expect(buildRevalidateFailureMessage("not-a-date")).toBe("最新の取得に失敗しました。");
  });
});

describe("withFallback", () => {
  const colors = { bullish: "green", bearish: "red" } as const;

  it("キーが存在すればその値を返す", () => {
    expect(withFallback(colors, "bullish", "gray")).toBe("green");
  });

  it("キーが存在しなければ既定値を返す（想定外のenum値でクラッシュしないようにするため）", () => {
    expect(withFallback(colors, "unknown-value", "gray")).toBe("gray");
  });

  it("プロトタイプ汚染的なキー（toString等）でも own property でなければ既定値を返す", () => {
    expect(withFallback(colors, "toString", "gray")).toBe("gray");
  });
});

describe("createLoadGuard（stock-notes での回帰シナリオ）", () => {
  // createLoadGuard は取得の「世代」ガードとして作られたが、ToolClient.tsx では
  // 認証状態の世代ガード（authGuardRef）としても同じ仕組みを再利用している。
  // ここでは実際に起きていた2つの不具合（codexレビュー指摘）を、
  // createLoadGuard の基本動作を組み合わせたシナリオとして再現し、
  // 修正後の設計（ToolClient.tsx 側の実装）が依拠している前提を保証する。

  it("シナリオ1: getUser()より先にonAuthStateChangeが発火したら、getUser()側のトークンは古い扱いになる（別ユーザーIDの誤適用を防ぐ）", () => {
    const authGuard = createLoadGuard();
    // マウント時、getUser() を呼ぶ直前にトークンを採番する
    const tokenAtGetUserStart = authGuard.next();
    // getUser() の応答が届く前に、アカウント切替（onAuthStateChange）が先に発火し、世代が進む
    authGuard.next();
    // 遅れて届いた getUser() の結果は、もはや最新の世代ではないので適用してはいけない
    expect(authGuard.isCurrent(tokenAtGetUserStart)).toBe(false);
  });

  it("シナリオ1逆順: onAuthStateChangeより先にgetUser()が解決すれば、そのトークンは現在の世代のまま適用してよい", () => {
    const authGuard = createLoadGuard();
    const tokenAtGetUserStart = authGuard.next();
    // この時点でまだ onAuthStateChange は発火していない
    expect(authGuard.isCurrent(tokenAtGetUserStart)).toBe(true);
  });

  it("シナリオ2: 古い取得（revalidate相当）が世代不一致で終了しても、新しい取得（load相当）自身のトークンは有効なまま", () => {
    // isRevalidating が解除されない不具合は「古いrevalidateDataがisCurrentで弾かれ、
    // 新しいloadDataがisRevalidatingに触れない」という2つの要因の組み合わせで起きていた。
    // guard自体は「新しいトークンが常にcurrentである」という前提を守れていることを確認する
    // （ToolClient.tsx 側は、loadData 開始時に isRevalidating を同期的に false へ倒すことで、
    // このガードの結果に関わらず正しい状態に収束させている）。
    const loadGuard = createLoadGuard();
    const revalidateToken = loadGuard.next();
    const loadToken = loadGuard.next();
    expect(loadGuard.isCurrent(revalidateToken)).toBe(false);
    expect(loadGuard.isCurrent(loadToken)).toBe(true);
  });

  it("シナリオ3: 書き込み（登録・分類変更・削除・一括取り込み）の開始時に current() で記録した世代は、完了前にユーザーが切り替わると古い扱いになる（refetchAfterWrite が中止すべきケース）", () => {
    // ToolClient.tsx の書き込みハンドラは、書き込みを開始する直前に
    // authGuardRef.current.current() で「今の認証世代」を記録し、書き込み（例: insertStock）が
    // 完了した後に isCurrent(authToken) を確認してから再取得・キャッシュ保存を行う。
    // ここでは「書き込み中にユーザーが切り替わった」状況を再現し、記録した世代が
    // 古い扱いになる（＝再取得・キャッシュ保存を中止すべき）ことを確認する。
    const authGuard = createLoadGuard();
    // ユーザーAでログイン中。書き込み開始直前に世代を記録する。
    const authTokenAtWriteStart = authGuard.current();
    // 書き込み（await insertStock 等）が完了するまでの間に、ユーザーBへ切り替わった
    // （onAuthStateChange が発火し、世代が進む）。
    authGuard.next();
    // 書き込み自体はDBのRLSにより拒否される想定だが（このガードの担当範囲外）、
    // 仮に書き込みが成立していたとしても、この古い世代のままキャッシュへ保存してはいけない。
    expect(authGuard.isCurrent(authTokenAtWriteStart)).toBe(false);
  });

  it("シナリオ3逆順: 書き込み完了までユーザーが切り替わらなければ、記録した世代のまま再取得・キャッシュ保存してよい", () => {
    const authGuard = createLoadGuard();
    const authTokenAtWriteStart = authGuard.current();
    // 切替は起きない
    expect(authGuard.isCurrent(authTokenAtWriteStart)).toBe(true);
  });
});

describe("shouldRefetchAfterBulkImport", () => {
  it("成功が1件以上あれば再取得する", () => {
    expect(shouldRefetchAfterBulkImport({ succeeded: ["7203"], failed: [] })).toBe(true);
  });

  it("成功0件でも重複（duplicate:true）の失敗があれば再取得する（別タブで先に登録済みだったケース）", () => {
    expect(
      shouldRefetchAfterBulkImport({
        succeeded: [],
        failed: [{ duplicate: true }],
      }),
    ).toBe(true);
  });

  it("成功0件かつ重複でない失敗のみなら再取得しない（DB側に変化が無いため）", () => {
    expect(
      shouldRefetchAfterBulkImport({
        succeeded: [],
        failed: [{ duplicate: false }],
      }),
    ).toBe(false);
  });

  it("成功も失敗も無ければ再取得しない", () => {
    expect(shouldRefetchAfterBulkImport({ succeeded: [], failed: [] })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5タブ構成（要対応/保有/ウォッチ/新規調査/アーカイブ）・登録・分類変更・削除・
// 一括取り込みの純関数群。
// ---------------------------------------------------------------------------

describe("hasUrgentOpenAction", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");

  it("期限切れの open アクションがあれば true", () => {
    const actions = [makeAction({ dueDate: "2026-01-01", status: "open" })];
    expect(hasUrgentOpenAction(actions, now)).toBe(true);
  });

  it(`期限が${ACTION_DUE_SOON_DAYS}日以内なら true`, () => {
    const due = new Date(now.getTime() + (ACTION_DUE_SOON_DAYS - 1) * 86400000).toISOString();
    const actions = [makeAction({ dueDate: due, status: "open" })];
    expect(hasUrgentOpenAction(actions, now)).toBe(true);
  });

  it(`期限が${ACTION_DUE_SOON_DAYS}日超先なら false`, () => {
    const due = new Date(now.getTime() + (ACTION_DUE_SOON_DAYS + 5) * 86400000).toISOString();
    const actions = [makeAction({ dueDate: due, status: "open" })];
    expect(hasUrgentOpenAction(actions, now)).toBe(false);
  });

  it("done/dismissed は対象外", () => {
    const actions = [makeAction({ dueDate: "2026-01-01", status: "done" })];
    expect(hasUrgentOpenAction(actions, now)).toBe(false);
  });

  it("期限未設定は対象外", () => {
    const actions = [makeAction({ dueDate: null, status: "open" })];
    expect(hasUrgentOpenAction(actions, now)).toBe(false);
  });
});

describe("computeActionRequiredStocks", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");

  it("分析0件の銘柄は要対応（アーカイブ以外）", () => {
    const stocks = [makeStock({ id: "s1", category: "watch" })];
    const result = computeActionRequiredStocks(stocks, [], [], {}, now);
    expect(result.map((s) => s.id)).toEqual(["s1"]);
  });

  it("分析0件でもアーカイブは対象外", () => {
    const stocks = [makeStock({ id: "s1", category: "archived" })];
    const result = computeActionRequiredStocks(stocks, [], [], {}, now);
    expect(result).toEqual([]);
  });

  it("決算またぎ（post-earnings）の銘柄は要対応", () => {
    const stocks = [makeStock({ id: "s1", category: "holding" })];
    const analyses = [makeAnalysis({ stockId: "s1", analyzedAt: "2026-08-01T00:00:00.000Z" })];
    const lastEarningsByCode = { "0000": { date: "2026-08-05", announcementType: "1Q", publishStatus: "発表済" } };
    const result = computeActionRequiredStocks(stocks, analyses, [], lastEarningsByCode, now);
    expect(result.map((s) => s.id)).toEqual(["s1"]);
  });

  it("期限切れ・期限間近の未消化アクションがある銘柄は要対応", () => {
    const stocks = [makeStock({ id: "s1", category: "holding" })];
    const analyses = [makeAnalysis({ stockId: "s1", analyzedAt: now.toISOString() })];
    const actions = [makeAction({ stockId: "s1", dueDate: "2026-08-01", status: "open" })];
    const result = computeActionRequiredStocks(stocks, analyses, actions, {}, now);
    expect(result.map((s) => s.id)).toEqual(["s1"]);
  });

  it("分析があり決算またぎでもなく緊急アクションも無ければ要対応にならない", () => {
    const stocks = [makeStock({ id: "s1", category: "holding" })];
    const analyses = [makeAnalysis({ stockId: "s1", analyzedAt: now.toISOString() })];
    const result = computeActionRequiredStocks(stocks, analyses, [], {}, now);
    expect(result).toEqual([]);
  });
});

describe("sortActionRequiredStocks", () => {
  it("次回決算日が近い順、未判明は後ろに並べる", () => {
    const stocks = [
      makeStock({ id: "no-earnings", code: "9999" }),
      makeStock({ id: "far", code: "2222" }),
      makeStock({ id: "near", code: "1111" }),
    ];
    const nextEarningsByCode = {
      "2222": { date: "2026-09-01", announcementType: "", publishStatus: "" },
      "1111": { date: "2026-08-14", announcementType: "", publishStatus: "" },
    };
    const result = sortActionRequiredStocks(stocks, [], nextEarningsByCode);
    expect(result.map((s) => s.id)).toEqual(["near", "far", "no-earnings"]);
  });

  it("決算日が同じ（未判明同士含む）場合は最終分析日の古い順（未分析が最上位）", () => {
    const stocks = [
      makeStock({ id: "analyzed", code: "1111" }),
      makeStock({ id: "unanalyzed", code: "2222" }),
    ];
    const analyses = [makeAnalysis({ stockId: "analyzed", analyzedAt: "2026-01-01T00:00:00.000Z" })];
    const result = sortActionRequiredStocks(stocks, analyses, {});
    expect(result.map((s) => s.id)).toEqual(["unanalyzed", "analyzed"]);
  });
});

describe("sortStocksByLastAnalyzedAsc", () => {
  it("最終分析日の古い順に並べ、未分析（null）を最上位にする", () => {
    const stocks = [
      makeStock({ id: "new", code: "1111" }),
      makeStock({ id: "unanalyzed", code: "2222" }),
      makeStock({ id: "old", code: "3333" }),
    ];
    const analyses = [
      makeAnalysis({ stockId: "new", analyzedAt: "2026-08-01T00:00:00.000Z" }),
      makeAnalysis({ stockId: "old", analyzedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const result = sortStocksByLastAnalyzedAsc(stocks, analyses);
    expect(result.map((s) => s.id)).toEqual(["unanalyzed", "old", "new"]);
  });
});

describe("stocksForTab / countStocksForTab", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");
  const stocks = [
    makeStock({ id: "unanalyzed-holding", code: "1111", category: "holding" }),
    makeStock({ id: "analyzed-watch", code: "2222", category: "watch" }),
    makeStock({ id: "archived", code: "3333", category: "archived" }),
  ];
  const analyses = [makeAnalysis({ stockId: "analyzed-watch", analyzedAt: now.toISOString() })];

  it("action-required タブはアーカイブを除く要対応銘柄だけを返す", () => {
    const result = stocksForTab("action-required", stocks, analyses, [], null, now);
    expect(result.map((s) => s.id)).toEqual(["unanalyzed-holding"]);
  });

  it("アーカイブは他のどのタブにも一切出ない（action-required除外の確認）", () => {
    for (const tab of STOCK_NOTES_TABS) {
      const result = stocksForTab(tab, stocks, analyses, [], null, now);
      if (tab !== "archived") {
        expect(result.some((s) => s.id === "archived")).toBe(false);
      }
    }
  });

  it("archived タブはカテゴリが archived の銘柄だけを返す", () => {
    const result = stocksForTab("archived", stocks, analyses, [], null, now);
    expect(result.map((s) => s.id)).toEqual(["archived"]);
  });

  it("holding タブはカテゴリが holding の銘柄だけを返す", () => {
    const result = stocksForTab("holding", stocks, analyses, [], null, now);
    expect(result.map((s) => s.id)).toEqual(["unanalyzed-holding"]);
  });

  it("countStocksForTab は stocksForTab の件数と一致する", () => {
    for (const tab of STOCK_NOTES_TABS) {
      expect(countStocksForTab(tab, stocks, analyses, [], null, now)).toBe(
        stocksForTab(tab, stocks, analyses, [], null, now).length,
      );
    }
  });
});

describe("extractUnregisteredHoldings", () => {
  it("stock_notes_stocks に無い保有銘柄（tab='holding'）を抽出する", () => {
    const holdings = [makeHolding({ code: "7203", name: "トヨタ自動車", quantity: 100 })];
    expect(extractUnregisteredHoldings(holdings, [])).toEqual([
      { code: "7203", name: "トヨタ自動車", quantity: 100 },
    ]);
  });

  it("stock_notes_stocks に既にある銘柄は対象外（分析0件でも対象外。computeUnanalyzedHoldingsとの違い）", () => {
    const holdings = [makeHolding({ code: "7203" })];
    const stocks = [makeStock({ code: "7203" })];
    expect(extractUnregisteredHoldings(holdings, stocks)).toEqual([]);
  });

  it("watch タブは対象外", () => {
    const holdings = [makeHolding({ code: "9999", tab: "watch" })];
    expect(extractUnregisteredHoldings(holdings, [])).toEqual([]);
  });

  it("同一銘柄が複数口座にあっても1件に集約し、コード順で返す", () => {
    const holdings = [
      makeHolding({ id: "a", code: "9999", name: "Z" }),
      makeHolding({ id: "b", code: "9999", name: "Z" }),
      makeHolding({ id: "c", code: "1111", name: "A" }),
    ];
    const result = extractUnregisteredHoldings(holdings, []);
    expect(result.map((r) => r.code)).toEqual(["1111", "9999"]);
  });
});

describe("isCodeAlreadyRegistered", () => {
  it("既に登録済みのコードなら true", () => {
    const stocks = [makeStock({ code: "7203" })];
    expect(isCodeAlreadyRegistered(stocks, "7203")).toBe(true);
  });

  it("未登録のコードなら false", () => {
    expect(isCodeAlreadyRegistered([makeStock({ code: "7203" })], "9999")).toBe(false);
  });

  it("前後の空白は無視して比較する", () => {
    const stocks = [makeStock({ code: "7203" })];
    expect(isCodeAlreadyRegistered(stocks, " 7203 ")).toBe(true);
  });
});

describe("validateNewStockInput", () => {
  it("コード・名前が両方あればエラー無し", () => {
    expect(validateNewStockInput("7203", "トヨタ自動車")).toBeNull();
  });

  it("コードが空ならエラー", () => {
    expect(validateNewStockInput("", "トヨタ自動車")).not.toBeNull();
    expect(validateNewStockInput("   ", "トヨタ自動車")).not.toBeNull();
  });

  it("名前が空ならエラー", () => {
    expect(validateNewStockInput("7203", "")).not.toBeNull();
    expect(validateNewStockInput("7203", "   ")).not.toBeNull();
  });
});

describe("canDeleteStock / deleteBlockedReason", () => {
  it("分析0件なら削除できる", () => {
    const stock = makeStock({ id: "s1" });
    expect(canDeleteStock(stock, [])).toBe(true);
    expect(deleteBlockedReason(stock, [])).toBeNull();
  });

  it("分析が1件でもあれば削除できない（cascade削除を防ぐ）", () => {
    const stock = makeStock({ id: "s1" });
    const analyses = [makeAnalysis({ stockId: "s1" })];
    expect(canDeleteStock(stock, analyses)).toBe(false);
    expect(deleteBlockedReason(stock, analyses)).toContain("1件");
  });

  it("分析が複数件あれば件数を理由文言に含める", () => {
    const stock = makeStock({ id: "s1" });
    const analyses = [
      makeAnalysis({ id: "a1", stockId: "s1" }),
      makeAnalysis({ id: "a2", stockId: "s1" }),
    ];
    expect(deleteBlockedReason(stock, analyses)).toContain("2件");
  });
});
