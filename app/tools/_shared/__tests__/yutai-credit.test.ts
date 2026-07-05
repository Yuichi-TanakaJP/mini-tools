import { describe, expect, it } from "vitest";
import type { NikkoCreditRecord, SbiCreditRecord } from "@/app/tools/yutai-candidates/types";
import {
  canNikkoGeneralCrossNow,
  getNikkoCreditBadges,
  hasNikkoLendingCaution,
  hasNikkoSellStop,
  isHandledBySbiShort,
  isNikkoGeneralOutOfStock,
  shouldWatchNikkoGeneral,
} from "../yutai-credit";

function nikkoRecord(overrides: Partial<NikkoCreditRecord> = {}): NikkoCreditRecord {
  return {
    institutional_buy: false,
    institutional_short: false,
    general_buy: false,
    general_short: false,
    available_shares: null,
    has_exchange_regulation: false,
    has_internal_regulation: false,
    regulation_sources: [],
    regulation_details: [],
    ...overrides,
  };
}

function sbiRecord(overrides: Partial<SbiCreditRecord> = {}): SbiCreditRecord {
  return {
    position_status: "available",
    unit_upper_limit: "",
    is_hyper: false,
    is_daily: false,
    is_short: false,
    is_long: false,
    ...overrides,
  };
}

describe("日興 一般信用の判定", () => {
  it("売建規制（取引停止）の明細があれば hasNikkoSellStop", () => {
    const credit = nikkoRecord({
      regulation_details: ["exchange|日証金（東証）|新規売建規制 取引停止|2022/07/06"],
    });
    expect(hasNikkoSellStop(credit)).toBe(true);
    expect(hasNikkoSellStop(nikkoRecord())).toBe(false);
    expect(hasNikkoSellStop(undefined)).toBe(false);
  });

  it("貸株注意喚起の明細があれば hasNikkoLendingCaution", () => {
    expect(hasNikkoLendingCaution(nikkoRecord({ regulation_details: ["internal|貸株注意喚起|2026/01/01"] }))).toBe(true);
    expect(hasNikkoLendingCaution(nikkoRecord())).toBe(false);
  });

  it("general_short かつ在庫ありかつ売建停止なしなら今クロス可", () => {
    expect(canNikkoGeneralCrossNow(nikkoRecord({ general_short: true, available_shares: 100 }))).toBe(true);
    expect(canNikkoGeneralCrossNow(nikkoRecord({ general_short: true, available_shares: 0 }))).toBe(false);
    expect(canNikkoGeneralCrossNow(nikkoRecord({ general_short: false, available_shares: 100 }))).toBe(false);
    expect(
      canNikkoGeneralCrossNow(nikkoRecord({
        general_short: true,
        available_shares: 100,
        regulation_details: ["internal|新規売建規制 取引停止|2011/12/05"],
      })),
    ).toBe(false);
  });

  it("available_shares=0 かつ売建停止なしは在庫切れ扱い（general_short は不問）", () => {
    expect(isNikkoGeneralOutOfStock(nikkoRecord({ general_short: false, available_shares: 0 }))).toBe(true);
    expect(isNikkoGeneralOutOfStock(nikkoRecord({ available_shares: null }))).toBe(false);
    expect(
      isNikkoGeneralOutOfStock(nikkoRecord({
        available_shares: 0,
        regulation_details: ["internal|新規売建規制 取引停止|2011/12/05"],
      })),
    ).toBe(false);
  });

  it("shouldWatchNikkoGeneral は停止中・クロス可・在庫あり非売建を監視対象にする", () => {
    expect(shouldWatchNikkoGeneral(nikkoRecord({ regulation_details: ["internal|新規売建規制 取引停止|2011/12/05"] }))).toBe(true);
    expect(shouldWatchNikkoGeneral(nikkoRecord({ general_short: true, available_shares: 100 }))).toBe(true);
    expect(shouldWatchNikkoGeneral(nikkoRecord({ general_short: false, available_shares: 100 }))).toBe(true);
    expect(shouldWatchNikkoGeneral(nikkoRecord())).toBe(false);
    expect(shouldWatchNikkoGeneral(undefined)).toBe(false);
  });
});

describe("getNikkoCreditBadges", () => {
  it("売建停止は一般停止バッジのみ（他の一般系より優先）", () => {
    const badges = getNikkoCreditBadges(nikkoRecord({
      general_short: true,
      available_shares: 100,
      regulation_details: ["internal|新規売建規制 取引停止|2011/12/05"],
    }));
    expect(badges.map((badge) => badge.kind)).toEqual(["generalStop"]);
    expect(badges[0].label).toBe("一般停止");
  });

  it("クロス可＋貸株注意喚起は一般注意", () => {
    const badges = getNikkoCreditBadges(nikkoRecord({
      general_short: true,
      available_shares: 100,
      regulation_details: ["internal|貸株注意喚起|2026/01/01"],
    }));
    expect(badges.map((badge) => badge.kind)).toEqual(["generalCaution"]);
  });

  it("クロス可は一般可、制度売可なら制度可を併記", () => {
    const badges = getNikkoCreditBadges(nikkoRecord({
      general_short: true,
      available_shares: 100,
      institutional_short: true,
    }));
    expect(badges.map((badge) => badge.kind)).toEqual(["generalOk", "institutional"]);
    expect(badges.map((badge) => badge.label)).toEqual(["一般可", "制度可"]);
  });

  it("在庫0は一般×、非対象（null）はバッジなし", () => {
    expect(getNikkoCreditBadges(nikkoRecord({ available_shares: 0 })).map((badge) => badge.kind)).toEqual([
      "generalOutOfStock",
    ]);
    expect(getNikkoCreditBadges(nikkoRecord({ available_shares: null }))).toEqual([]);
    expect(getNikkoCreditBadges(undefined)).toEqual([]);
  });
});

describe("SBI 短期対象の判定", () => {
  it("is_short のみで判定し、在庫状態（position_status）は見ない", () => {
    expect(isHandledBySbiShort(sbiRecord({ is_short: true, position_status: "unavailable" }))).toBe(true);
    expect(isHandledBySbiShort(sbiRecord({ is_short: false, position_status: "available" }))).toBe(false);
    expect(isHandledBySbiShort(undefined)).toBe(false);
  });
});
