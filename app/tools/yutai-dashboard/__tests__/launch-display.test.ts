import { describe, expect, it } from "vitest";
import { buildLaunchDisplayByKey, getLaunchDisplayHint, parseYutaiLaunchDisplaySnapshot } from "../launch-display";

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

  it.each([null, {}, { schema_version: 2, records: [] }, { schema_version: 1, records: [] }])("必須メタデータがない応答は拒否する: %o", (value) => {
    expect(parseYutaiLaunchDisplaySnapshot(value)).toBeNull();
  });
});
