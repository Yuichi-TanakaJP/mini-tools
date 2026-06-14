import { describe, expect, it } from "vitest";
import { filterDisclosureEvents, normalizeSecurityCode } from "../logic";
import type { DisclosureEventItem } from "../types";

function event(overrides: Partial<DisclosureEventItem>): DisclosureEventItem {
  return {
    event_id: "event-1",
    source: "tdnet",
    event_type: "yutai_change",
    audience: "all",
    priority: "medium",
    needs_review: false,
    disclosure_date: "2026-06-11",
    disclosure_time: "15:30",
    security_code: "12340",
    company_name: "テスト株式会社",
    title: "株主優待制度の変更",
    disclosure_category: "",
    source_url: "https://example.com",
    pdf_url: "",
    html_url: "",
    xbrl_url: "",
    ...overrides,
  };
}

describe("normalizeSecurityCode", () => {
  it("TDNETの5桁末尾0を4桁へ正規化する", () => {
    expect(normalizeSecurityCode("12340")).toBe("1234");
    expect(normalizeSecurityCode("1234")).toBe("1234");
    expect(normalizeSecurityCode("130a0")).toBe("130A");
  });
});

describe("filterDisclosureEvents", () => {
  it("優待ビューはマイ銘柄に関係なく audience=all を表示する", () => {
    const items = [
      event({ event_id: "yutai" }),
      event({
        event_id: "dividend",
        audience: "personal",
        event_type: "dividend_change",
      }),
    ];

    expect(
      filterDisclosureEvents(
        items,
        "yutai",
        new Set(),
        "",
        7,
        "2026-06-13",
        "all",
        false,
        new Set(),
      ),
    ).toEqual([items[0]]);
  });

  it("マイ銘柄ビューは端末内コードに一致する personal イベントだけ表示する", () => {
    const matching = event({
      event_id: "matching",
      audience: "personal",
      event_type: "performance_revision",
    });
    const other = event({
      event_id: "other",
      audience: "personal",
      security_code: "99990",
      event_type: "dividend_change",
    });

    expect(
      filterDisclosureEvents(
        [matching, other],
        "my-stocks",
        new Set(["1234"]),
        "",
        7,
        "2026-06-13",
        "all",
        false,
        new Set(),
      ),
    ).toEqual([matching]);
  });

  it("表示期間と分類、未確認だけを組み合わせて絞り込む", () => {
    const recent = event({
      event_id: "recent",
      disclosure_date: "2026-06-12",
      event_type: "yutai_new",
    });
    const old = event({
      event_id: "old",
      disclosure_date: "2026-05-01",
      event_type: "yutai_new",
    });
    const reviewed = event({
      event_id: "reviewed",
      disclosure_date: "2026-06-11",
      event_type: "yutai_expand",
    });

    expect(
      filterDisclosureEvents(
        [recent, old, reviewed],
        "yutai",
        new Set(),
        "",
        7,
        "2026-06-13",
        "new-expand",
        true,
        new Set(["reviewed"]),
      ),
    ).toEqual([recent]);
  });
});
