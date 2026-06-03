// app/tools/yutai-memo/types.ts
export type Tag = {
  id: string;
  name: string;
  createdAt: number;
};

export const CROSS_TYPES = [
  "長期優遇なし",
  "単発クロス",
  "連続クロス",
  "先行クロス",
  "1株放置",
] as const;

export type CrossType = (typeof CROSS_TYPES)[number];

export type MemoItem = {
  id: string;
  name: string;
  code?: string;
  createdAt: string; // ISO
  months: number[]; // 1-12 (複数可)
  tagIds: string[]; // ★ tags -> tagIds
  crossType: CrossType;
  entryTiming?: string; // 早打ち目安
  relatedUrl?: string; // 関連リンク
  tenureRule?: string; // 任期条件
  acquired: boolean; // 取得済みか
  oneShareStartedAt?: string; // YYYY-MM or freeform when legacy start month is unknown
  oneShareHold?: boolean; // legacy compatibility
  priority: 1 | 2 | 3;
  memo: string;
  source?: "manual" | "minkabu";
  pickedFrom?: "monthly_yutai_list";
  minkabuYutaiUrl?: string;
  officialBenefitUrl?: string;
  officialLinkStatus?: string;
  minimumInvestmentText?: string;
  benefitCategoryTags?: string[];
  updatedAt: string; // ISO
};

/**
 * 日興証券の信用売り残高（株数）。クロス取引が今可能かの判断材料。
 * market-info が「登録された銘柄コードだけ」取得して公開する JSON の shape。
 * 用途を信用売り残高に限定しているため項目は最小（買い残・前週比などは持たない）。
 */
export type NikkoShortBalanceRecord = {
  /** 信用売り残高（株数）。取得できなければ null。 */
  sellBalance: number | null;
};

export type NikkoShortBalanceData = {
  /** 基準日（YYYY-MM-DD）。取得できなければ null。 */
  asOf: string | null;
  /** code → 信用売り残高。market-info に登録済みのコードのみ載る。 */
  byCode: Record<string, NikkoShortBalanceRecord>;
};

export type ArchivedMemoItem = {
  id: string;
  memoId: string;
  code?: string;
  name: string;
  acquiredAt: string; // ISO
  entitlementMonthKey?: string; // YYYY-MM (権利月ベース)
  note?: string;
};

export const DEFAULT_TAGS: Tag[] = [
  { id: "early", name: "早取り", createdAt: 0 },
  { id: "one_share", name: "長期1株", createdAt: 0 },
  { id: "tenure", name: "任期注意", createdAt: 0 },
  { id: "failure", name: "失敗ログ", createdAt: 0 },
  { id: "must", name: "鉄板", createdAt: 0 },
];
