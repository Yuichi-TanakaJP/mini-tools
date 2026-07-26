import { describe, expect, it } from "vitest";
import {
  buildLaunchDisplayByKey,
  getLaunchDisplayHint,
  getLongTermFlags,
  parseYutaiLaunchDisplaySnapshot,
  type YutaiLaunchDisplayRecord,
} from "../launch-display";

function recordWithHoldingMonths(monthsPerTier: number[]): YutaiLaunchDisplayRecord {
  return {
    month: "2026-09",
    code: "0000",
    companyName: "テスト",
    displayStatus: "conditions_available",
    calculationStatus: "auto_calculable",
    requiresUserValuation: false,
    hasLongTermBenefit: false,
    requiresLongTermHolding: false,
    longTermRequiredHoldingMonths: [],
    longTermBenefitTiers: [],
    normalizedStatus: null,
    normalizedAsOfDate: null,
    notes: null,
    programs: [
      {
        programId: "p",
        label: "優待",
        rightsMonths: [9],
        notes: null,
        tiers: monthsPerTier.map((m, i) => ({
          minimumShares: 100 * (i + 1),
          maximumShares: null,
          requiredHoldingMonths: m,
          groups: [],
        })),
      },
    ],
  };
}

describe("getLongTermFlags", () => {
  it("短期tierのみ: required=false, benefit=false", () => {
    expect(getLongTermFlags(recordWithHoldingMonths([0, 0]))).toEqual({ required: false, benefit: false });
  });

  it("短期と長期が混在: required=false, benefit=true（長期優遇）", () => {
    expect(getLongTermFlags(recordWithHoldingMonths([0, 12]))).toEqual({ required: false, benefit: true });
  });

  it("全tierが長期保有必須: required=true, benefit=true", () => {
    expect(getLongTermFlags(recordWithHoldingMonths([12, 24]))).toEqual({ required: true, benefit: true });
  });

  it("条件なし/未取得は両方false", () => {
    expect(getLongTermFlags(recordWithHoldingMonths([]))).toEqual({ required: false, benefit: false });
    expect(getLongTermFlags(null)).toEqual({ required: false, benefit: false });
    expect(getLongTermFlags(undefined)).toEqual({ required: false, benefit: false });
  });
});

describe("parseYutaiLaunchDisplaySnapshot", () => {
  it("公式条件payloadをdashboard用に変換する", () => {
    const snapshot = parseYutaiLaunchDisplaySnapshot({
      schema_version: 1,
      month: "2026-09",
      record_count: 1,
      counts: { conditions_available: 1, auto_calculable: 1, requires_user_valuation: 0 },
      generated_at: "2026-07-22T14:57:25.239015Z",
      records: [
        {
          month: "2026-09",
          code: "1822",
          company_name: "大豊建設",
          display_status: "conditions_available",
          calculation_status: "auto_calculable",
          requires_user_valuation: false,
          normalized_status: "draft",
          normalized_as_of_date: "2026-07-22",
          programs: [
            {
              program_id: "quo-card",
              label: "QUOカード",
              rights_months: [3, 9],
              tiers: [
                {
                  minimum_shares: 100,
                  required_holding_months: 0,
                  groups: [
                    {
                      mode: "all",
                      allow_repeated_choices: false,
                      items: [
                        {
                          label: "QUOカード",
                          kind: "money_voucher",
                          official_value_yen: 500,
                          valuation_policy: "face_value",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const record = buildLaunchDisplayByKey(snapshot).get("1822:9");
    expect(record?.programs[0].label).toBe("QUOカード");
    expect(getLaunchDisplayHint(record)).toEqual({
      requiredShares: 100,
      benefitValueYen: 500,
      label: "QUOカード 100株",
    });
  });


  it("割引率メタデータを任意フィールドとして受け取る", () => {
    const snapshot = parseYutaiLaunchDisplaySnapshot({
      schema_version: 1,
      month: "2026-09",
      record_count: 1,
      counts: { conditions_available: 1, auto_calculable: 0, requires_user_valuation: 1 },
      generated_at: "2026-07-22T14:57:25.239015Z",
      records: [
        {
          month: "2026-09",
          code: "9202",
          company_name: "ANA",
          display_status: "conditions_available",
          calculation_status: "user_input_required",
          requires_user_valuation: true,
          programs: [
            {
              program_id: "discount",
              label: "割引",
              rights_months: [3, 9],
              tiers: [
                {
                  minimum_shares: 100,
                  required_holding_months: 0,
                  groups: [
                    {
                      mode: "all",
                      allow_repeated_choices: false,
                      items: [
                        {
                          label: "運賃割引",
                          kind: "discount",
                          official_value_yen: null,
                          valuation_policy: "user_estimate_required",
                          discount_rate_pct: 50,
                          discount_terms: [
                            { discount_rate_pct: 50, label: "株主優待番号", quantity: 1, unit: "枚", notes: "国内線" },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const item = buildLaunchDisplayByKey(snapshot).get("9202:9")?.programs[0].tiers[0].groups[0].items[0];
    expect(item?.discountRatePct).toBe(50);
    expect(item?.discountTerms).toEqual([{ label: "株主優待番号", discountRatePct: 50, quantity: 1, unit: "枚", notes: "国内線" }]);
    expect(getLaunchDisplayHint(buildLaunchDisplayByKey(snapshot).get("9202:9"))).toBeNull();
  });


  it("移行期間の旧discount_termsフィールドも受け取る", () => {
    const snapshot = parseYutaiLaunchDisplaySnapshot({
      schema_version: 1,
      month: "2026-09",
      record_count: 1,
      counts: { conditions_available: 1, auto_calculable: 0, requires_user_valuation: 1 },
      generated_at: "2026-07-22T14:57:25.239015Z",
      records: [
        {
          month: "2026-09",
          code: "9202",
          company_name: "ANA",
          display_status: "conditions_available",
          calculation_status: "user_input_required",
          requires_user_valuation: true,
          programs: [
            {
              program_id: "discount",
              label: "割引",
              rights_months: [9],
              tiers: [
                {
                  minimum_shares: 100,
                  required_holding_months: 0,
                  groups: [
                    {
                      mode: "all",
                      allow_repeated_choices: false,
                      items: [
                        {
                          label: "運賃割引",
                          kind: "discount",
                          valuation_policy: "user_estimate_required",
                          discount_terms: [{ rate_pct: 50, label: "旧形式", applies_to: "国内線" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const item = buildLaunchDisplayByKey(snapshot).get("9202:9")?.programs[0].tiers[0].groups[0].items[0];
    expect(item?.discountTerms).toEqual([{ label: "旧形式", discountRatePct: 50, quantity: null, unit: null, notes: "国内線" }]);
  });

  it.each([null, {}, { schema_version: 2, records: [] }, { schema_version: 1, records: [] }])("必須メタデータがない応答は拒否する: %o", (value) => {
    expect(parseYutaiLaunchDisplaySnapshot(value)).toBeNull();
  });
});
