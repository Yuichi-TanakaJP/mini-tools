import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import { loadDisclosureEvents } from "../data-loader";

vi.mock("@/lib/market-api", () => ({
  fetchJson: vi.fn(),
  getApiBaseUrl: vi.fn(),
}));

const mockedFetchJson = vi.mocked(fetchJson);
const mockedGetApiBaseUrl = vi.mocked(getApiBaseUrl);

describe("loadDisclosureEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetApiBaseUrl.mockReturnValue("https://api.example.com");
  });

  it("manifestの直近30日を読み、event_idの重複を除いて新しい順に返す", async () => {
    mockedFetchJson.mockImplementation(async (url) => {
      if (url.endsWith("/latest")) {
        return {
          schema_version: "disclosure-events-v1",
          target_date: "2026-06-12",
          generated_at: "2026-06-12T22:00:00+09:00",
          total_count: 1,
          items: [
            {
              event_id: "latest",
              source: "tdnet",
              event_type: "yutai_change",
              audience: "all",
              priority: "medium",
              needs_review: false,
              disclosure_date: "2026-06-12",
              disclosure_time: "15:30",
              security_code: "12340",
              company_name: "最新",
              title: "優待変更",
              disclosure_category: "",
              source_url: "",
              pdf_url: "",
              html_url: "",
              xbrl_url: "",
            },
          ],
        };
      }
      if (url.endsWith("/manifest")) {
        return {
          schema_version: "disclosure-events-manifest-v1",
          generated_at: "2026-06-13T22:00:00+09:00",
          latest: "2026-06-12",
          dates: ["2026-05-01", "2026-06-12", "2026-06-13"],
        };
      }
      return {
        schema_version: "disclosure-events-v1",
        target_date: "2026-06-13",
        generated_at: "2026-06-13T22:00:00+09:00",
        total_count: 0,
        items: [],
      };
    });

    const result = await loadDisclosureEvents();

    expect(result?.latestDate).toBe("2026-06-12");
    expect(result?.referenceDate).toBe("2026-06-13");
    expect(result?.loadedDates).toEqual(["2026-06-12", "2026-06-13"]);
    expect(result?.items.map((item) => item.event_id)).toEqual(["latest"]);
    expect(mockedFetchJson).toHaveBeenCalledTimes(3);
  });
});
