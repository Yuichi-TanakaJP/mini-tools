export type YutaiLaunchDisplayItem = {
  label: string;
  kind: "discount" | "goods" | "money_voucher" | "points" | "service";
  officialValueYen: number | null;
  valuationPolicy: "face_value" | "official_equivalent" | "user_estimate_required";
  quantity: number | null;
  unit: string | null;
  notes: string | null;
};

export type YutaiLaunchDisplayGroup = {
  mode: "all" | "choose_one";
  allowRepeatedChoices: boolean;
  items: YutaiLaunchDisplayItem[];
};

export type YutaiLaunchDisplayTier = {
  minimumShares: number;
  maximumShares: number | null;
  requiredHoldingMonths: number;
  groups: YutaiLaunchDisplayGroup[];
};

export type YutaiLaunchDisplayProgram = {
  programId: string;
  label: string;
  rightsMonths: number[];
  tiers: YutaiLaunchDisplayTier[];
  notes: string | null;
};

export type YutaiLaunchDisplayRecord = {
  month: string;
  code: string;
  companyName: string;
  displayStatus: "conditions_available" | "needs_normalization";
  calculationStatus: "auto_calculable" | "mixed_user_input_required" | "no_conditions" | "user_input_required";
  requiresUserValuation: boolean;
  normalizedStatus: string | null;
  normalizedAsOfDate: string | null;
  programs: YutaiLaunchDisplayProgram[];
  notes: string | null;
};

export type YutaiLaunchDisplaySnapshot = {
  generatedAt: string;
  month: string;
  recordCount: number;
  conditionsAvailable: number;
  autoCalculable: number;
  requiresUserValuation: number;
  records: YutaiLaunchDisplayRecord[];
};

export type YutaiLaunchDisplayHint = {
  requiredShares: number;
  benefitValueYen: number;
  label: string;
};

const DISPLAY_STATUSES = ["conditions_available", "needs_normalization"] as const;
const CALCULATION_STATUSES = ["auto_calculable", "mixed_user_input_required", "no_conditions", "user_input_required"] as const;

function isDisplayStatus(value: unknown): value is YutaiLaunchDisplayRecord["displayStatus"] {
  return typeof value === "string" && DISPLAY_STATUSES.includes(value as YutaiLaunchDisplayRecord["displayStatus"]);
}

function isCalculationStatus(value: unknown): value is YutaiLaunchDisplayRecord["calculationStatus"] {
  return typeof value === "string" && CALCULATION_STATUSES.includes(value as YutaiLaunchDisplayRecord["calculationStatus"]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseItem(value: unknown): YutaiLaunchDisplayItem | null {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.kind !== "string" || typeof value.valuation_policy !== "string") {
    return null;
  }
  if (!["discount", "goods", "money_voucher", "points", "service"].includes(value.kind)) return null;
  if (!["face_value", "official_equivalent", "user_estimate_required"].includes(value.valuation_policy)) return null;
  return {
    label: value.label,
    kind: value.kind as YutaiLaunchDisplayItem["kind"],
    officialValueYen: optionalNumber(value.official_value_yen),
    valuationPolicy: value.valuation_policy as YutaiLaunchDisplayItem["valuationPolicy"],
    quantity: optionalNumber(value.quantity),
    unit: optionalString(value.unit),
    notes: optionalString(value.notes),
  };
}

function parseGroup(value: unknown): YutaiLaunchDisplayGroup | null {
  if (!isRecord(value) || (value.mode !== "all" && value.mode !== "choose_one") || typeof value.allow_repeated_choices !== "boolean" || !Array.isArray(value.items)) {
    return null;
  }
  const items = value.items.map(parseItem).filter((item): item is YutaiLaunchDisplayItem => item !== null);
  return { mode: value.mode, allowRepeatedChoices: value.allow_repeated_choices, items };
}

function parseTier(value: unknown): YutaiLaunchDisplayTier | null {
  if (!isRecord(value) || typeof value.minimum_shares !== "number" || typeof value.required_holding_months !== "number" || !Array.isArray(value.groups)) {
    return null;
  }
  const groups = value.groups.map(parseGroup).filter((group): group is YutaiLaunchDisplayGroup => group !== null);
  return {
    minimumShares: value.minimum_shares,
    maximumShares: optionalNumber(value.maximum_shares),
    requiredHoldingMonths: value.required_holding_months,
    groups,
  };
}

function parseProgram(value: unknown): YutaiLaunchDisplayProgram | null {
  if (!isRecord(value) || typeof value.program_id !== "string" || typeof value.label !== "string" || !Array.isArray(value.rights_months) || !Array.isArray(value.tiers)) {
    return null;
  }
  const rightsMonths = value.rights_months.filter((month): month is number => typeof month === "number" && Number.isInteger(month));
  const tiers = value.tiers.map(parseTier).filter((tier): tier is YutaiLaunchDisplayTier => tier !== null);
  return {
    programId: value.program_id,
    label: value.label,
    rightsMonths,
    tiers,
    notes: optionalString(value.notes),
  };
}

function parseDisplayRecord(value: unknown): YutaiLaunchDisplayRecord | null {
  if (
    !isRecord(value) ||
    typeof value.month !== "string" ||
    typeof value.code !== "string" ||
    typeof value.company_name !== "string" ||
    !isDisplayStatus(value.display_status) ||
    !isCalculationStatus(value.calculation_status) ||
    typeof value.requires_user_valuation !== "boolean" ||
    !Array.isArray(value.programs)
  ) {
    return null;
  }
  const programs = value.programs.map(parseProgram).filter((program): program is YutaiLaunchDisplayProgram => program !== null);
  return {
    month: value.month,
    code: value.code,
    companyName: value.company_name,
    displayStatus: value.display_status,
    calculationStatus: value.calculation_status,
    requiresUserValuation: value.requires_user_valuation,
    normalizedStatus: optionalString(value.normalized_status),
    normalizedAsOfDate: optionalString(value.normalized_as_of_date),
    programs,
    notes: optionalString(value.notes),
  };
}

export function parseYutaiLaunchDisplaySnapshot(value: unknown): YutaiLaunchDisplaySnapshot | null {
  if (!isRecord(value) || value.schema_version !== 1 || !Array.isArray(value.records) || !isRecord(value.counts)) return null;
  if (typeof value.generated_at !== "string" || typeof value.month !== "string" || typeof value.record_count !== "number") return null;
  const records = value.records.map(parseDisplayRecord).filter((record): record is YutaiLaunchDisplayRecord => record !== null);
  return {
    generatedAt: value.generated_at,
    month: value.month,
    recordCount: value.record_count,
    conditionsAvailable: typeof value.counts.conditions_available === "number" ? value.counts.conditions_available : 0,
    autoCalculable: typeof value.counts.auto_calculable === "number" ? value.counts.auto_calculable : 0,
    requiresUserValuation: typeof value.counts.requires_user_valuation === "number" ? value.counts.requires_user_valuation : 0,
    records,
  };
}

export function buildLaunchDisplayByKey(snapshot: YutaiLaunchDisplaySnapshot | null) {
  return new Map(snapshot?.records.map((record) => [`${record.code}:${Number(record.month.slice(5, 7))}`, record]) ?? []);
}

function groupValueYen(group: YutaiLaunchDisplayGroup) {
  const values = group.items
    .map((item) => item.officialValueYen)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (values.length === 0) return 0;
  return group.mode === "choose_one" ? Math.max(...values) : values.reduce((sum, value) => sum + value, 0);
}

export function getLaunchDisplayHint(record: YutaiLaunchDisplayRecord | null | undefined): YutaiLaunchDisplayHint | null {
  if (!record || record.calculationStatus === "no_conditions") return null;
  for (const program of record.programs) {
    const sortedTiers = [...program.tiers].sort((a, b) => a.minimumShares - b.minimumShares || a.requiredHoldingMonths - b.requiredHoldingMonths);
    for (const tier of sortedTiers) {
      const benefitValueYen = tier.groups.reduce((sum, group) => sum + groupValueYen(group), 0);
      if (benefitValueYen > 0) {
        const hold = tier.requiredHoldingMonths > 0 ? `・${tier.requiredHoldingMonths}ヶ月保有` : "";
        return {
          requiredShares: tier.minimumShares,
          benefitValueYen,
          label: `${program.label} ${tier.minimumShares}株${hold}`,
        };
      }
    }
  }
  return null;
}

