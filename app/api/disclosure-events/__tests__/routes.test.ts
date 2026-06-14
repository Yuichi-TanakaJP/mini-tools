import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadDisclosureEventsByDate,
  loadDisclosureManifest,
} from "@/app/tools/disclosure-radar/data-loader";
import { GET as getDate } from "../[date]/route";
import { GET as getManifest } from "../manifest/route";

vi.mock("@/app/tools/disclosure-radar/data-loader", () => ({
  loadDisclosureEventsByDate: vi.fn(),
  loadDisclosureManifest: vi.fn(),
}));

const mockedLoadDate = vi.mocked(loadDisclosureEventsByDate);
const mockedLoadManifest = vi.mocked(loadDisclosureManifest);

describe("disclosure events browser cache routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("manifestは5分のCache-Controlを返す", async () => {
    mockedLoadManifest.mockResolvedValue({
      schema_version: "disclosure-events-manifest-v1",
      generated_at: "2026-06-14T00:00:00Z",
      latest: "2026-06-12",
      dates: ["2026-06-12", "2026-06-13"],
    });

    const response = await getManifest();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("日付別JSONは1年間immutableを返す", async () => {
    mockedLoadDate.mockResolvedValue({
      schema_version: "disclosure-events-v1",
      target_date: "2026-06-12",
      generated_at: "2026-06-12T22:00:00+09:00",
      total_count: 0,
      items: [],
    });

    const response = await getDate(new Request("https://example.com"), {
      params: Promise.resolve({ date: "2026-06-12" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});
