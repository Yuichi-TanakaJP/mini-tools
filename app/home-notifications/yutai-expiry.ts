import type { BenefitItemV2 } from "@/app/tools/yutai-expiry/benefits/store";

export const YUTAI_EXPIRY_NOTIFICATION_DAYS = 7;

export type UpcomingBenefitExpiry = {
  item: BenefitItemV2;
  daysUntilExpiry: number;
};

function parseDateKey(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const value = Date.UTC(year, month - 1, day);
  const parsed = new Date(value);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

export function selectUpcomingBenefitExpiries(
  items: BenefitItemV2[],
  today: string,
): UpcomingBenefitExpiry[] {
  const todayValue = parseDateKey(today);
  if (todayValue == null) return [];

  return items
    .flatMap((item) => {
      if (item.isUsed || item.archivedAt || !item.expiresOn) return [];
      const expiryValue = parseDateKey(item.expiresOn);
      if (expiryValue == null) return [];
      const daysUntilExpiry = Math.round((expiryValue - todayValue) / 86_400_000);
      if (
        daysUntilExpiry < 0 ||
        daysUntilExpiry > YUTAI_EXPIRY_NOTIFICATION_DAYS
      ) {
        return [];
      }
      return [{ item, daysUntilExpiry }];
    })
    .sort(
      (a, b) =>
        a.daysUntilExpiry - b.daysUntilExpiry ||
        a.item.title.localeCompare(b.item.title, "ja"),
    );
}
