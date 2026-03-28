import type { MemoItem } from "./types";
import { loadItems, saveItems } from "./storage";

export type MonthlyYutaiMemoSource = "minkabu";
export type MonthlyYutaiPickedFrom = "monthly_yutai_list";

export type MonthlyYutaiCandidateImport = {
  code: string;
  companyName: string;
  month: number;
  minimumInvestmentText?: string;
  benefitCategoryTags?: string[];
  minkabuYutaiUrl: string;
  officialBenefitUrl?: string;
  officialLinkStatus?: string;
  source?: MonthlyYutaiMemoSource;
  pickedFrom?: MonthlyYutaiPickedFrom;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function isImportedMonthlyYutaiCandidate(
  items: MemoItem[],
  candidate: Pick<MonthlyYutaiCandidateImport, "code" | "month">,
) {
  return items.some(
    (item) => item.code === candidate.code && Array.isArray(item.months) && item.months.includes(candidate.month),
  );
}

export function createMemoItemFromCandidate(
  candidate: MonthlyYutaiCandidateImport,
): MemoItem {
  const now = nowIso();
  const source = candidate.source ?? "minkabu";
  const pickedFrom = candidate.pickedFrom ?? "monthly_yutai_list";
  const memoLines = [
    pickedFrom === "monthly_yutai_list" ? "候補一覧から追加" : `追加元: ${pickedFrom}`,
    candidate.minimumInvestmentText ? `最低投資金額: ${candidate.minimumInvestmentText}` : "",
    candidate.benefitCategoryTags?.length
      ? `優待カテゴリ: ${candidate.benefitCategoryTags.join(", ")}`
      : "",
    candidate.officialLinkStatus === "missing" ? "企業リンク: なし" : "",
  ].filter(Boolean);

  return {
    id: uid(),
    name: candidate.companyName,
    code: candidate.code,
    createdAt: now,
    months: [candidate.month],
    tagIds: [],
    crossType: "長期優遇なし",
    acquired: false,
    priority: 2,
    memo: memoLines.join("\n"),
    updatedAt: now,
    relatedUrl: candidate.officialBenefitUrl || candidate.minkabuYutaiUrl,
    minkabuYutaiUrl: candidate.minkabuYutaiUrl,
    officialBenefitUrl: candidate.officialBenefitUrl,
    officialLinkStatus: candidate.officialLinkStatus,
    source,
    pickedFrom,
    minimumInvestmentText: candidate.minimumInvestmentText,
    benefitCategoryTags: candidate.benefitCategoryTags ?? [],
  };
}

export function addMemoItemFromCandidate(candidate: MonthlyYutaiCandidateImport) {
  if (typeof window === "undefined") {
    return { added: false, reason: "unavailable" as const };
  }

  const items = loadItems();
  if (isImportedMonthlyYutaiCandidate(items, candidate)) {
    return { added: false, reason: "duplicate" as const };
  }

  const next = [createMemoItemFromCandidate(candidate), ...items];
  saveItems(next);
  return { added: true, item: next[0] };
}
