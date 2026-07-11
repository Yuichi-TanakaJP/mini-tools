export function toJstYearMonth(d: Date): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  return { year, month };
}

export function toMonthKeyFromIso(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const ym = toJstYearMonth(new Date(t));
  return `${ym.year}-${`${ym.month}`.padStart(2, "0")}`;
}

/**
 * 取得日（acquiredAt）を、どの権利月（YYYY-MM）に紐づけるかを決める。
 *
 * - `preparationMonthsBefore` を渡すと、仕込み開始〜権利月のリード期間中に取得した場合は
 *   「これから来る当年の権利月」に寄せる（権利確定前に取得済みにしても前年扱いにならない）。
 * - 未指定（= 0 扱い）のときは従来どおり「取得日以前の直近の権利月」に紐づける（後方互換）。
 */
export function resolveEntitlementMonthKey(
  months: number[],
  acquiredAt: string,
  preparationMonthsBefore?: number,
): string | null {
  if (!Array.isArray(months) || months.length === 0) return toMonthKeyFromIso(acquiredAt);
  const t = Date.parse(acquiredAt);
  if (Number.isNaN(t)) return null;
  const ym = toJstYearMonth(new Date(t));
  const normalized = Array.from(
    new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)),
  ).sort((a, b) => a - b);

  if (normalized.length === 0) return toMonthKeyFromIso(acquiredAt);

  const prep =
    typeof preparationMonthsBefore === "number" &&
    Number.isInteger(preparationMonthsBefore) &&
    preparationMonthsBefore >= 0 &&
    preparationMonthsBefore <= 11
      ? preparationMonthsBefore
      : 0;
  // 月を 0 起点の絶対インデックス（year*12 + (month-1)）に直して年跨ぎを扱う。
  const acquiredIdx = ym.year * 12 + (ym.month - 1);

  let bestUpcoming: number | null = null; // 仕込み開始〜権利月のリード窓に入る権利月（最も早いもの）
  let bestPast: number | null = null; // 取得日以前で直近の権利月（従来動作）
  for (const month of normalized) {
    for (const yearOffset of [-1, 0, 1, 2]) {
      const entitlementIdx = (ym.year + yearOffset) * 12 + (month - 1);
      // リード窓（権利月を含む prep か月手前まで）に取得日が入るなら、これから来る権利に寄せる
      if (acquiredIdx >= entitlementIdx - prep && acquiredIdx <= entitlementIdx) {
        if (bestUpcoming === null || entitlementIdx < bestUpcoming) bestUpcoming = entitlementIdx;
      }
      if (entitlementIdx <= acquiredIdx && (bestPast === null || entitlementIdx > bestPast)) {
        bestPast = entitlementIdx;
      }
    }
  }

  const chosen = bestUpcoming ?? bestPast ?? ym.year * 12 + (normalized[normalized.length - 1] - 1);
  const targetYear = Math.floor(chosen / 12);
  const targetMonth = (chosen % 12) + 1;
  return `${targetYear}-${`${targetMonth}`.padStart(2, "0")}`;
}

export function getPreparationMonth(
  entitlementMonth: number,
  monthsBefore: number,
): number | null {
  if (
    !Number.isInteger(entitlementMonth) || entitlementMonth < 1 || entitlementMonth > 12 ||
    !Number.isInteger(monthsBefore) || monthsBefore < 0 || monthsBefore > 11
  ) return null;
  return ((entitlementMonth - 1 - monthsBefore + 12) % 12) + 1;
}

export function isPreparationMonth(
  entitlementMonths: number[],
  monthsBefore: number | undefined,
  targetMonth: number,
): boolean {
  if (monthsBefore === undefined) return false;
  return entitlementMonths.some(
    (month) => getPreparationMonth(month, monthsBefore) === targetMonth,
  );
}
