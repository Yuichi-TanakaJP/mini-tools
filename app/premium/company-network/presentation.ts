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
    question: "企業・企業グループのつながりを全体ネットワークで見る。",
  },
  {
    mode: "radial",
    icon: "🌐",
    label: "放射",
    question: "選択した企業を中心に、1-hop / 2-hopの広がりを見る。",
  },
  {
    mode: "hierarchy",
    icon: "🗂",
    label: "系列",
    question: "親会社・支配・出資の向きを保ったまま上位 / 下位をたどる。",
  },
  {
    mode: "table",
    icon: "☰",
    label: "表",
    question: "関係種別・比率・検証状態・根拠日を正確に確認する。",
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
