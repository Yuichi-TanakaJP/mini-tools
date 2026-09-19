import type { PortfolioInstrumentAnalysis, PortfolioPosition } from "./types";

export type PortfolioAllocationDimension =
  | "asset_type"
  | "account_type"
  | "sector_33"
  | "cycle_profile"
  | "income_profile"
  | "market_cap_profile"
  | "instrument";

export type PortfolioAllocationScope = "all" | "equity";

export type PortfolioAllocationItem = {
  key: string;
  label: string;
  marketValue: number;
  percentage: number;
  positionCount: number;
  instrumentCount: number;
  isUnclassified: boolean;
};

export type PortfolioAllocation = {
  totalMarketValue: number;
  missingMarketValueCount: number;
  items: PortfolioAllocationItem[];
};

export const portfolioAllocationDimensions: Record<
  PortfolioAllocationDimension,
  { label: string; preferredChart: "donut" | "bar" }
> = {
  asset_type: { label: "資産クラス", preferredChart: "donut" },
  account_type: { label: "口座種別", preferredChart: "donut" },
  sector_33: { label: "東証33業種", preferredChart: "bar" },
  cycle_profile: { label: "景気感応度", preferredChart: "donut" },
  income_profile: { label: "インカム特性", preferredChart: "donut" },
  market_cap_profile: { label: "時価総額帯", preferredChart: "donut" },
  instrument: { label: "銘柄別", preferredChart: "bar" },
};

const assetTypeLabels: Record<string, string> = {
  domestic_stock: "国内株",
  foreign_stock: "海外株",
  investment_fund: "投資信託",
  equity_fund: "株式ファンド",
  bond: "債券",
  bond_fund: "債券ファンド",
  fixed_deposit: "定期預金",
  cash: "現金",
  cash_equivalent: "現金同等物",
  mmf: "MMF",
  reit: "REIT",
  crypto: "暗号資産",
  real_estate_crowdfunding: "不動産クラウドファンディング",
  other: "その他",
};

const accountTypeLabels: Record<string, string> = {
  taxable: "課税口座",
  nisa_growth: "NISA成長投資枠",
  nisa_accumulation: "NISAつみたて投資枠",
  legacy_nisa: "旧NISA",
  pension: "年金",
  ideco: "iDeCo",
  corporate_dc: "企業型DC",
  foreign_brokerage: "海外証券口座",
  crypto_exchange: "暗号資産取引所",
  bank_cash: "銀行・現金",
  real_estate_crowdfunding: "不動産クラウドファンディング",
  other: "その他",
};

const profileLabels: Record<string, string> = {
  cyclical: "シクリカル",
  defensive: "ディフェンシブ",
  mixed: "ミックス",
  high_dividend: "高配当",
  balanced: "バランス",
  growth: "成長",
  mega: "超大型",
  large: "大型",
  mid: "中型",
  small: "小型",
};

const equityAssetTypes = new Set(["domestic_stock", "foreign_stock"]);

function bucketFor(
  position: PortfolioPosition,
  dimension: PortfolioAllocationDimension,
  analysis: PortfolioInstrumentAnalysis | undefined,
) {
  if (dimension === "instrument") {
    return { key: position.instrumentId, label: `${position.identifier} ${position.name}`, isUnclassified: false };
  }
  if (dimension === "asset_type") {
    return { key: position.assetType, label: assetTypeLabels[position.assetType] ?? position.assetType, isUnclassified: false };
  }
  if (dimension === "account_type") {
    return { key: position.accountType, label: accountTypeLabels[position.accountType] ?? position.accountType, isUnclassified: false };
  }

  const value = dimension === "sector_33"
    ? analysis?.sector33Name
    : dimension === "cycle_profile"
      ? analysis?.cycleProfile
      : dimension === "income_profile"
        ? analysis?.incomeProfile
        : analysis?.marketCapProfile;
  if (!value) return { key: "unclassified", label: "未分類", isUnclassified: true };
  return { key: value, label: profileLabels[value] ?? value, isUnclassified: false };
}

export function getPortfolioAllocation({
  positions,
  instrumentAnalysis,
  dimension,
  scope,
}: {
  positions: PortfolioPosition[];
  instrumentAnalysis: PortfolioInstrumentAnalysis[];
  dimension: PortfolioAllocationDimension;
  scope: PortfolioAllocationScope;
}): PortfolioAllocation {
  const analyses = new Map(instrumentAnalysis.map((item) => [item.instrumentId, item]));
  const groups = new Map<string, {
    label: string;
    marketValue: number;
    positionCount: number;
    instrumentIds: Set<string>;
    isUnclassified: boolean;
  }>();
  let totalMarketValue = 0;
  let missingMarketValueCount = 0;

  for (const position of positions) {
    if (scope === "equity" && !equityAssetTypes.has(position.assetType)) continue;
    if (position.marketValue === null) {
      missingMarketValueCount += 1;
      continue;
    }

    const bucket = bucketFor(position, dimension, analyses.get(position.instrumentId));
    const current = groups.get(bucket.key) ?? {
      label: bucket.label,
      marketValue: 0,
      positionCount: 0,
      instrumentIds: new Set<string>(),
      isUnclassified: bucket.isUnclassified,
    };
    current.marketValue += position.marketValue;
    current.positionCount += 1;
    current.instrumentIds.add(position.instrumentId);
    groups.set(bucket.key, current);
    totalMarketValue += position.marketValue;
  }

  const items = [...groups.entries()]
    .map(([key, item]) => ({
      key,
      label: item.label,
      marketValue: item.marketValue,
      percentage: totalMarketValue > 0 ? (item.marketValue / totalMarketValue) * 100 : 0,
      positionCount: item.positionCount,
      instrumentCount: item.instrumentIds.size,
      isUnclassified: item.isUnclassified,
    }))
    .sort((a, b) => b.marketValue - a.marketValue || a.label.localeCompare(b.label, "ja"));

  return { totalMarketValue, missingMarketValueCount, items };
}
