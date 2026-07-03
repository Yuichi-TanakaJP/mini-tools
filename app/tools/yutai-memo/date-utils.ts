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

export function resolveEntitlementMonthKey(
  months: number[],
  acquiredAt: string,
): string | null {
  if (!Array.isArray(months) || months.length === 0) return toMonthKeyFromIso(acquiredAt);
  const t = Date.parse(acquiredAt);
  if (Number.isNaN(t)) return null;
  const ym = toJstYearMonth(new Date(t));
  const normalized = Array.from(
    new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)),
  ).sort((a, b) => a - b);

  if (normalized.length === 0) return toMonthKeyFromIso(acquiredAt);

  const candidate = [...normalized].reverse().find((m) => m <= ym.month);
  const targetMonth = candidate ?? normalized[normalized.length - 1];
  const targetYear = targetMonth <= ym.month ? ym.year : ym.year - 1;
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
