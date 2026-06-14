import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson, getApiBaseUrl } from "@/lib/market-api";
import {
  loadDisclosureEventsByDate,
  loadDisclosureManifest,
} from "../data-loader";

vi.mock("@/lib/market-api", () => ({
  fetchJson: vi.fn(),
  getApiBaseUrl: vi.fn(),
}));

const mockedFetchJson = vi.mocked(fetchJson);
const mockedGetApiBaseUrl = vi.mocked(getApiBaseUrl);

describe("disclosure radar data loader", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetApiBaseUrl.mockReturnValue("https://api.example.com");
  });

  it("manifestだけを短期revalidateで取得する", async () => {
    const manifest = {
      schema_version: "disclosure-events-manifest-v1" as const,
      generated_at: "2026-06-13T22:00:00+09:00",
      latest: "2026-06-12",
      dates: ["2026-06-12", "2026-06-13"],
    };
    mockedFetchJson.mockResolvedValue(manifest);

    await expect(loadDisclosureManifest()).resolves.toEqual(manifest);
    expect(mockedFetchJson).toHaveBeenCalledWith(
      "https://api.example.com/disclosure-events/manifest",
      300,
    );
  });

  it("日付別JSONを長期revalidateで1件取得する", async () => {
    const payload = {
      schema_version: "disclosure-events-v1" as const,
      target_date: "2026-06-12",
      generated_at: "2026-06-12T22:00:00+09:00",
      total_count: 0,
      items: [],
    };
    mockedFetchJson.mockResolvedValue(payload);

    await expect(loadDisclosureEventsByDate("2026-06-12")).resolves.toEqual(
      payload,
    );
    expect(mockedFetchJson).toHaveBeenCalledWith(
      "https://api.example.com/disclosure-events/2026-06-12",
      31_536_000,
    );
  });
});
