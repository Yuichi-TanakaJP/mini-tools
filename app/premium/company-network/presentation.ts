import type { RelationCategory } from "./types";

export type CompanyNetworkViewMode = "network" | "radial" | "hierarchy" | "table";

export const CATEGORY_LABEL: Record<RelationCategory, string> = {
  capital: "資本",
  control: "支配",
  historical: "歴史",
};

export const CATEGORY_COLOR: Record<RelationCategory, string> = {
  capital: "#2563eb",
  control: "#7c3aed",
  historical: "#64748b",
};

export const RELATION_LABEL: Record<string, string> = {
  equity_ownership: "出資",
  parent_of: "親会社",
  controls: "支配",
  equity_method_investment: "持分法",
  spun_off: "分社",
  predecessor_of: "前身",
  merged_into: "統合",
};

export const GROUP_TYPE_LABEL: Record<string, string> = {
  corporate_group: "企業グループ",
  capital_group: "資本グループ",
  keiretsu: "系列",
  zaibatsu_lineage: "財閥系譜",
  historical_group: "歴史的グループ",
  strategic_alliance: "戦略連合",
  presidents_club: "社長会",
};

export const VIEWS: readonly {
  mode: CompanyNetworkViewMode;
  icon: string;
  label: string;
  question: string;
}[] = [
  {
    mode: "network",
    icon: "🕸",
    label: "関係",
    question: "グループ内で確認済みの企業間relationだけを見る。",
  },
  {
    mode: "radial",
    icon: "🌐",
    label: "放射",
    question: "企業グループに誰が所属しているかを見る。",
  },
  {
    mode: "hierarchy",
    icon: "🗂",
    label: "系列",
    question: "出資・親会社・支配・持分法の上下構造を見る。",
  },
  {
    mode: "table",
    icon: "☰",
    label: "表",
    question: "構成企業と確認済み事実を人が読みやすい一覧で確認する。",
  },
];

export function relationLabel(type: string, ownershipPct: number | null): string {
  const base = RELATION_LABEL[type] ?? type;
  return ownershipPct === null ? base : `${base} ${ownershipPct}%`;
}

export function groupTypeLabel(value: string): string {
  return GROUP_TYPE_LABEL[value] ?? value;
}

export function formatAsOf(value: string | null): string {
  return value ? value.slice(0, 10) : "基準日なし";
}