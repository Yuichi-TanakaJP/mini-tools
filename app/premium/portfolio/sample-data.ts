export type PortfolioHolding = {
  code: string;
  name: string;
  market: "東証プライム" | "東証スタンダード" | "東証グロース";
  sector: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
  dividendPerShare: number;
  nextDividendDate: string;
  nextEarningsDate: string;
  benefitMonth?: string;
  benefitSummary?: string;
  benefitCondition?: string;
  benefitExpiryDate?: string;
  memo: string;
  tags: string[];
  targetBuyPrice?: number;
  targetSellPrice?: number;
};

export type PortfolioEvent = {
  date: string;
  code: string;
  title: string;
  kind: "earnings" | "dividend" | "benefit" | "price";
};

export const sampleHoldings: PortfolioHolding[] = [
  {
    code: "7203",
    name: "トヨタ自動車",
    market: "東証プライム",
    sector: "輸送用機器",
    shares: 100,
    averagePrice: 2840,
    currentPrice: 3098,
    dividendPerShare: 75,
    nextDividendDate: "2026-06-26",
    nextEarningsDate: "2026-05-08",
    memo: "長期コア。円高局面の押し目だけ追加検討。",
    tags: ["大型", "配当", "景気敏感"],
    targetBuyPrice: 2850,
    targetSellPrice: 3400,
  },
  {
    code: "9432",
    name: "日本電信電話",
    market: "東証プライム",
    sector: "情報・通信業",
    shares: 500,
    averagePrice: 158,
    currentPrice: 151.4,
    dividendPerShare: 5.2,
    nextDividendDate: "2026-06-24",
    nextEarningsDate: "2026-05-13",
    benefitMonth: "3月",
    benefitSummary: "dポイント",
    benefitCondition: "100株以上を2年以上継続保有",
    benefitExpiryDate: "2026-08-31",
    memo: "利回り確認。優待条件は長期保有前提で監視。",
    tags: ["通信", "配当", "優待"],
    targetBuyPrice: 145,
  },
  {
    code: "8267",
    name: "イオン",
    market: "東証プライム",
    sector: "小売業",
    shares: 100,
    averagePrice: 3580,
    currentPrice: 3725,
    dividendPerShare: 40,
    nextDividendDate: "2026-05-01",
    nextEarningsDate: "2026-07-10",
    benefitMonth: "2月 / 8月",
    benefitSummary: "オーナーズカード",
    benefitCondition: "100株以上",
    benefitExpiryDate: "2026-09-30",
    memo: "生活圏メリット重視。値上がり益より継続利用を優先。",
    tags: ["小売", "優待", "生活"],
    targetSellPrice: 4100,
  },
  {
    code: "8591",
    name: "オリックス",
    market: "東証プライム",
    sector: "その他金融業",
    shares: 100,
    averagePrice: 2920,
    currentPrice: 3210,
    dividendPerShare: 98.6,
    nextDividendDate: "2026-06-29",
    nextEarningsDate: "2026-05-12",
    memo: "優待終了後は配当と事業分散で判断。",
    tags: ["金融", "配当"],
    targetBuyPrice: 3000,
  },
  {
    code: "6758",
    name: "ソニーグループ",
    market: "東証プライム",
    sector: "電気機器",
    shares: 100,
    averagePrice: 3180,
    currentPrice: 3525,
    dividendPerShare: 25,
    nextDividendDate: "2026-06-20",
    nextEarningsDate: "2026-05-14",
    memo: "エンタメと半導体の比率を見ながら継続保有。",
    tags: ["電機", "成長", "大型"],
    targetBuyPrice: 3200,
    targetSellPrice: 3900,
  },
];

export const sampleEvents: PortfolioEvent[] = [
  { date: "2026-05-01", code: "8267", title: "配当入金予定", kind: "dividend" },
  { date: "2026-05-08", code: "7203", title: "決算発表予定", kind: "earnings" },
  { date: "2026-05-12", code: "8591", title: "決算発表予定", kind: "earnings" },
  { date: "2026-05-13", code: "9432", title: "決算発表予定", kind: "earnings" },
  { date: "2026-05-14", code: "6758", title: "決算発表予定", kind: "earnings" },
  { date: "2026-06-24", code: "9432", title: "配当入金予定", kind: "dividend" },
  { date: "2026-06-26", code: "7203", title: "配当入金予定", kind: "dividend" },
  { date: "2026-08-31", code: "9432", title: "優待期限", kind: "benefit" },
  { date: "2026-09-30", code: "8267", title: "優待期限", kind: "benefit" },
];
