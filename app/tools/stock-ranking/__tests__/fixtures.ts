import type { RankingDayData, RankingManifest } from "../types";

export const SAMPLE_MANIFEST: RankingManifest = {
  dates: ["2025-04-01", "2025-04-02"],
  latest: "2025-04-02",
};

export const SAMPLE_DAY_DATA: RankingDayData = {
  date: "2025-04-02",
  records: [
    {
      date: "2025-04-02",
      market: "プライム",
      ranking: "値上がり率",
      page: 1,
      rank: 1,
      name: "テスト銘柄",
      code: "1234",
      marketLabel: "東証プライム",
      industry: "情報・通信業",
      price: 1234,
      time: "15:30",
      change: 120,
      changeRate: 10.77,
      volume: 123456,
      value: 98765432,
    },
  ],
};
